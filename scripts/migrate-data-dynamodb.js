const fs = require('fs/promises');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config({ path: '.env.local' });

const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

const ddb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true
    }
});

const DATA_DIR = path.join(process.cwd(), 'data');

async function migrateFile(filename) {
    const collectionName = filename.replace('.json', '');
    const filePath = path.join(DATA_DIR, filename);

    try {
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        console.log(`📂 Processing '${filename}' (${collectionName})...`);

        if (filename === 'market_state.json') {
            await ddb.send(new PutCommand({
                TableName: collectionName,
                Item: { id: 'current', data }
            }));
            console.log(`✅ Migrated '${filename}' (Single Item)`);
        } else if (Array.isArray(data)) {
            const payload = data.map(item => {
                const id = item.id ? String(item.id) : require('crypto').randomUUID();
                const { id: _, ...cleanItem } = item;
                return { id, data: cleanItem };
            });

            if (payload.length > 0) {
                console.log(`⏳ Migrating ${payload.length} items for '${collectionName}'...`);
                for (let i = 0; i < payload.length; i += 25) {
                    const chunk = payload.slice(i, i + 25);
                    const writeRequests = chunk.map(item => ({
                        PutRequest: { Item: item }
                    }));

                    await ddb.send(new BatchWriteCommand({
                        RequestItems: { [collectionName]: writeRequests }
                    }));
                }
                console.log(`✅ Migrated ${payload.length} items to '${collectionName}'`);
            } else {
                console.log(`ℹ️ '${filename}' is empty, skipping migration.`);
            }
        } else {
            console.log(`⚠️ '${filename}' is not an array or market_state, skipping.`);
        }
    } catch (error) {
        console.error(`❌ Error migrating '${filename}':`, error);
    }
}

async function main() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.error("❌ Error: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set in .env.local");
        process.exit(1);
    }

    try {
        const files = await fs.readdir(DATA_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        console.log(`🚀 Starting Data Migration to DynamoDB...`);
        for (const file of jsonFiles) {
            await migrateFile(file);
        }
        console.log("🏁 Migration Finished.");
    } catch (error) {
        console.error("❌ Migration failed:", error);
    }
}

main();
