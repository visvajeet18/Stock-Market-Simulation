const admin = require('firebase-admin');
const path = require('path');

const SERVICE_ACCOUNT_PATH = process.argv[2];
const serviceAccount = require(path.resolve(SERVICE_ACCOUNT_PATH));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function check() {
    console.log('--- Inspecting Stocks ---');
    const stocksSnapshot = await db.collection('stocks').limit(2).get();
    stocksSnapshot.forEach(doc => {
        console.log(`\nDoc ID: ${doc.id}`);
        const data = doc.data();
        Object.keys(data).forEach(key => {
            if (key === 'history') {
                console.log(`  ${key}: Array(${data[key].length}) [${data[key].slice(0, 3)}...]`);
            } else {
                console.log(`  ${key}: ${JSON.stringify(data[key])}`);
            }
        });
    });

    console.log('\n--- Inspecting Market State ---');
    const marketSnapshot = await db.collection('market_state').get();
    marketSnapshot.forEach(doc => {
        console.log(`\nDoc ID: ${doc.id}`);
        const data = doc.data();
        Object.keys(data).forEach(key => {
            console.log(`  ${key}: ${JSON.stringify(data[key])}`);
        });
    });
    
    process.exit(0);
}

check().catch(err => {
    console.error('Check failed:', err);
    process.exit(1);
});
