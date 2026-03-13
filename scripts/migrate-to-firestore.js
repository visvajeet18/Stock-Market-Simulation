const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// UPDATE THIS PATH to your actual JSON file path
const SERVICE_ACCOUNT_PATH = process.argv[2];

if (!SERVICE_ACCOUNT_PATH) {
    console.error('Please provide the path to your service account JSON file.');
    console.error('Example: node scripts/migrate-to-firestore.js C:\\Users\\...\\your-file.json');
    process.exit(1);
}

const serviceAccount = require(path.resolve(SERVICE_ACCOUNT_PATH));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const DATA_DIR = path.join(__dirname, '../data');

async function migrate() {
    console.log('Starting migration to Firestore...');
    
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
        const collectionName = file.replace('.json', '');
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
        
        console.log(`Migrating ${file} to collection "${collectionName}"...`);
        
        const batch = db.batch();
        
        if (file === 'market_state.json') {
            const docRef = db.collection(collectionName).doc('current');
            batch.set(docRef, data);
        } else if (Array.isArray(data)) {
            data.forEach(item => {
                const id = item.id ? String(item.id) : db.collection(collectionName).doc().id;
                const { id: _, ...cleanItem } = item;
                batch.set(db.collection(collectionName).doc(id), cleanItem);
            });
        }
        
        await batch.commit();
        console.log(`Successfully migrated ${collectionName}.`);
    }
    
    console.log('Migration completed successfully!');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
