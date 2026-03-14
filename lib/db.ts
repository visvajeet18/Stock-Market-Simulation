import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { supabase } from './supabase';

const DATA_DIR = path.join(process.cwd(), 'data');

// Per-file write lock to prevent concurrent writes corrupting JSON (Local only)
const writeLocks: Record<string, Promise<void>> = {};

const USE_CLOUD_DB = process.env.USE_FIRESTORE === 'true' || process.env.NODE_ENV === 'production';

// ─── Simple In-Memory Cache ──────────────────────────────────────────────────
const cache: Record<string, { data: any; expires: number }> = {};
const CACHE_TTL = 2000; // 2 seconds cache for reads

export async function readDB(filename: string) {
    const collectionName = filename.replace('.json', '');

    if (USE_CLOUD_DB) {
        // Check cache first
        if (cache[filename] && cache[filename].expires > Date.now()) {
            return cache[filename].data;
        }

        try {
            const { data: snapshot, error } = await supabase.from(collectionName).select('*');
            if (error) throw error;
            let result: any;

            if (!snapshot || snapshot.length === 0) {
                result = filename === 'market_state.json' ? {} : [];
            } else if (filename === 'market_state.json') {
                const currentDoc = snapshot.find((d: any) => d.id === 'current');
                result = currentDoc ? currentDoc.data : snapshot[0].data;
            } else {
                result = snapshot.map((doc: any) => ({ id: doc.id, ...doc.data }));
            }

            // Update cache
            cache[filename] = { data: result, expires: Date.now() + CACHE_TTL };
            return result;
        } catch (error) {
            console.error(`Supabase Read Error [${collectionName}]:`, error);
            // Fallback to cache if available
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
                const { error } = await supabase.from(collectionName).upsert({ id: 'current', data });
                if (error) throw error;
            } else if (Array.isArray(data)) {
                // Optimized Update: Delete missing, then UPSERT
                const payload = data.map(item => {
                    const id = item.id ? String(item.id) : crypto.randomUUID();
                    const { id: _, ...cleanItem } = item;
                    return { id, data: cleanItem };
                });
                
                const currentIds = payload.map(p => p.id);
                if (currentIds.length > 0) {
                    // Delete items that are no longer in the payload
                    await supabase.from(collectionName).delete().not('id', 'in', `(${currentIds.join(',')})`);
                    
                    const { error } = await supabase.from(collectionName).upsert(payload);
                    if (error) throw error;
                } else {
                    // Payload is empty, delete everything
                    await supabase.from(collectionName).delete().neq('id', 'dummy_id_to_clear_table');
                }
            }
            
            // Sync cache
            cache[filename] = { data: data, expires: Date.now() + CACHE_TTL };
            return;
        } catch (error) {
            console.error(`Supabase Write Error [${collectionName}]:`, error);
            throw error;
        }
    }

    // Local JSON Fallback with Locks
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

