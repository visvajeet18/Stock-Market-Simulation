const admin = require('firebase-admin');
const path = require('path');

const SERVICE_ACCOUNT_PATH = process.argv[2];
const serviceAccount = require(path.resolve(SERVICE_ACCOUNT_PATH));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function check() {
    console.log('Checking Firestore collections...');
    
    const collections = ['users', 'stocks', 'market_state', 'transactions'];
    
    for (const col of collections) {
        const snapshot = await db.collection(col).get();
        console.log(`Collection "${col}": ${snapshot.size} documents`);
        if (snapshot.size > 0 && col === 'market_state') {
            console.log('Market State data:', snapshot.docs[0].data());
        }
    }
    
    process.exit(0);
}

check().catch(err => {
    console.error('Check failed:', err);
    process.exit(1);
});
