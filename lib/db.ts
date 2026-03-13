import fs from 'fs/promises';
import path from 'path';
import { db } from './firebase-admin';

const DATA_DIR = path.join(process.cwd(), 'data');

// Per-file write lock to prevent concurrent writes corrupting JSON (Local only)
const writeLocks: Record<string, Promise<void>> = {};

const USE_FIRESTORE = process.env.USE_FIRESTORE === 'true' || process.env.NODE_ENV === 'production';

// ─── Simple In-Memory Cache ──────────────────────────────────────────────────
const cache: Record<string, { data: any; expires: number }> = {};
const CACHE_TTL = 2000; // 2 seconds cache for reads

export async function readDB(filename: string) {
    const collectionName = filename.replace('.json', '');

    if (USE_FIRESTORE) {
        // Check cache first
        if (cache[filename] && cache[filename].expires > Date.now()) {
            return cache[filename].data;
        }

        try {
            const snapshot = await db.collection(collectionName).get();
            let result: any;

            if (snapshot.empty) {
                result = filename === 'market_state.json' ? {} : [];
            } else if (filename === 'market_state.json') {
                const currentDoc = snapshot.docs.find(d => d.id === 'current');
                result = currentDoc ? currentDoc.data() : snapshot.docs[0].data();
            } else {
                result = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            // Update cache
            cache[filename] = { data: result, expires: Date.now() + CACHE_TTL };
            return result;
        } catch (error) {
            console.error(`Firestore Read Error [${collectionName}]:`, error);
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

    if (USE_FIRESTORE) {
        try {
            const batch = db.batch();
            
            if (filename === 'market_state.json') {
                const docRef = db.collection(collectionName).doc('current');
                batch.set(docRef, data);
            } else if (Array.isArray(data)) {
                // Optimized Update: Set documents without deleting the entire collection
                data.forEach(item => {
                    const id = item.id ? String(item.id) : db.collection(collectionName).doc().id;
                    const { id: _, ...cleanItem } = item;
                    batch.set(db.collection(collectionName).doc(id), cleanItem);
                });
            }
            
            await batch.commit();
            return;
        } catch (error) {
            console.error(`Firestore Write Error [${collectionName}]:`, error);
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
