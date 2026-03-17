const { DynamoDBClient, UpdateTableCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config({ path: '.env.local' });

const client = new DynamoDBClient({
    region: process.env.MY_AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
    }
});

const tables = [
    'announcements',
    'loans',
    'market_state',
    'orders',
    'stocks',
    'support_messages',
    'transactions',
    'users'
];

async function updateBillingMode(tableName) {
    try {
        console.log(`⏳ Updating billing mode for '${tableName}' to PAY_PER_REQUEST...`);
        const command = new UpdateTableCommand({
            TableName: tableName,
            BillingMode: 'PAY_PER_REQUEST'
        });
        await client.send(command);
        console.log(`✅ Table '${tableName}' updated successfully.`);
    } catch (error) {
        if (error.name === 'ValidationException' && error.message.includes('No update is required')) {
            console.log(`✅ Table '${tableName}' is already in PAY_PER_REQUEST mode.`);
        } else {
            console.error(`❌ Error updating table '${tableName}':`, error);
        }
    }
}

async function main() {
    if (!process.env.MY_AWS_ACCESS_KEY_ID || !process.env.MY_AWS_SECRET_ACCESS_KEY) {
        console.error("❌ Error: MY_AWS_ACCESS_KEY_ID and MY_AWS_SECRET_ACCESS_KEY must be set in .env.local");
        process.exit(1);
    }

    console.log("🚀 Updating DynamoDB Billing Modes for scalability...");
    for (const table of tables) {
        await updateBillingMode(table);
    }
    console.log("🏁 Finished updating billing modes.");
}

main();
