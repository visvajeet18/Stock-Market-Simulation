require('dotenv').config({ path: '.env.local' });
// Removed unused ts import

// Wait, scripts/verify-dynamodb.js will import lib/db
// In Node with ES modules, need to handle typescript or use ts-node
// Since the project is Next.js with TS, running `.js` calling `.ts` works if using `ts-node` or if we create a `.ts` script and run it via `tsx` or `ts-node`.
// Or we can just use AWS SDK directly in a .js script to read users table
console.log("Checking tables...");
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

async function checkTable(tableName) {
    try {
        const res = await client.send(new ScanCommand({ TableName: tableName, Limit: 5 }));
        console.log(`✅ Table '${tableName}' has ${res.Count} items (Sample read).`);
    } catch (error) {
        console.error(`❌ Error reading table '${tableName}':`, error.message);
    }
}

async function main() {
    const tables = ['users', 'stocks', 'market_state'];
    for (const table of tables) {
        await checkTable(table);
    }
}

main();
