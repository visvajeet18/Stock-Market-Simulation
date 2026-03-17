import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ddbDocClient as ddb } from './dynamodb';
import { ScanCommand, PutCommand, BatchWriteCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const DATA_DIR = path.join(process.cwd(), 'data');

// Per-file write lock to prevent concurrent writes corrupting JSON (Local only)
const writeLocks: Record<string, Promise<void>> = {};

const USE_CLOUD_DB = process.env.USE_FIRESTORE === 'true' || process.env.NODE_ENV === 'production';

// ─── Simple In-Memory Cache ──────────────────────────────────────────────────
const cache: Record<string, { data: any; expires: number }> = {};
const CACHE_TTL = 0; // Disable memory cache for DynamoDB too initially

export async function readDB(filename: string) {
    const collectionName = filename.replace('.json', '');

    if (USE_CLOUD_DB) {
        if (cache[filename] && cache[filename].expires > Date.now()) {
            return cache[filename].data;
        }

        try {
            if (filename === 'market_state.json') {
                const { Item } = await ddb.send(new GetCommand({ TableName: collectionName, Key: { id: 'current' } }));
                const result = Item ? Item.data : {};
                cache[filename] = { data: result, expires: Date.now() + CACHE_TTL };
                return result;
            } else {
                const { Items } = await ddb.send(new ScanCommand({ TableName: collectionName }));
                const result = (Items || []).map((doc: any) => ({ id: doc.id, ...doc.data }));
                cache[filename] = { data: result, expires: Date.now() + CACHE_TTL };
                return result;
            }
        } catch (error) {
            console.error(`DynamoDB Read Error [${collectionName}]:`, error);
            if (cache[filename]) return cache[filename].data;
            return filename === 'market_state.json' ? {} : [];
        }
    }

    // Local JSON Fallback
    try {
        const filePath = path.join(DATA_DIR, filename);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            if (filename === 'market_state.json') return {};
            return [];
        }
        throw error;
    }
}

export async function writeDB(filename: string, data: any) {
    const collectionName = filename.replace('.json', '');

    if (USE_CLOUD_DB) {
        try {
            if (filename === 'market_state.json') {
                await ddb.send(new PutCommand({
                    TableName: collectionName,
                    Item: { id: 'current', data }
                }));
            } else if (Array.isArray(data)) {
                const payload = data.map(item => {
                    const id = item.id ? String(item.id) : crypto.randomUUID();
                    const { id: _, ...cleanItem } = item;
                    return { id, data: cleanItem };
                });

                if (payload.length > 0) {
                    for (let i = 0; i < payload.length; i += 25) {
                        const chunk = payload.slice(i, i + 25);
                        const writeRequests = chunk.map(item => ({
                            PutRequest: { Item: item }
                        }));
                        await ddb.send(new BatchWriteCommand({
                            RequestItems: { [collectionName]: writeRequests }
                        }));
                    }
                } else if (data.length === 0) {
                    const { Items } = await ddb.send(new ScanCommand({ TableName: collectionName, ProjectionExpression: 'id' }));
                    if (Items && Items.length > 0) {
                        const ids = Items.map((i: any) => i.id);
                        await deleteManyDB(filename, ids);
                    }
                }
            }
            cache[filename] = { data: data, expires: Date.now() + CACHE_TTL };
            return;
        } catch (error) {
            console.error(`DynamoDB Write Error [${collectionName}]:`, error);
            throw error;
        }
    }

    const prev = writeLocks[filename] ?? Promise.resolve();
    const next = prev.then(async () => {
        const filePath = path.join(DATA_DIR, filename);
        const tmpPath = filePath + '.tmp';
        await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
        await fs.rename(tmpPath, filePath);
    });
    writeLocks[filename] = next.catch(() => { });
    return next;
}

export async function deleteDB(filename: string, id: string) {
    const collectionName = filename.replace('.json', '');
    if (USE_CLOUD_DB) {
        try {
            await ddb.send(new DeleteCommand({ TableName: collectionName, Key: { id } }));
            if (cache[filename] && Array.isArray(cache[filename].data)) {
                cache[filename].data = cache[filename].data.filter((i: any) => i.id !== id);
            }
        } catch (error) {
            console.error(`DynamoDB Delete Error [${collectionName}]:`, error);
            throw error;
        }
    } else {
        const data = await readDB(filename);
        if (Array.isArray(data)) {
            const filtered = data.filter((i: any) => i.id !== id);
            await writeDB(filename, filtered);
        }
    }
}

export async function deleteManyDB(filename: string, ids: string[]) {
    if (ids.length === 0) return;
    const collectionName = filename.replace('.json', '');
    if (USE_CLOUD_DB) {
        try {
            for (let i = 0; i < ids.length; i += 25) {
                const chunk = ids.slice(i, i + 25);
                const deleteRequests = chunk.map(id => ({
                    DeleteRequest: { Key: { id } }
                }));
                await ddb.send(new BatchWriteCommand({
                    RequestItems: { [collectionName]: deleteRequests }
                }));
            }
            if (cache[filename] && Array.isArray(cache[filename].data)) {
                cache[filename].data = cache[filename].data.filter((i: any) => !ids.includes(i.id));
            }
        } catch (error) {
            console.error(`DynamoDB DeleteMany Error [${collectionName}]:`, error);
            throw error;
        }
    } else {
        const data = await readDB(filename);
        if (Array.isArray(data)) {
            const filtered = data.filter((i: any) => !ids.includes(i.id));
            await writeDB(filename, filtered);
        }
    }
}
