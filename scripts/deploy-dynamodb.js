const { DynamoDBClient, CreateTableCommand, ListTablesCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
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

async function waitForTableActive(tableName) {
    console.log(`⏳ Waiting for table '${tableName}' to become ACTIVE...`);
    while (true) {
        try {
            const res = await client.send(new DescribeTableCommand({ TableName: tableName }));
            if (res.Table && res.Table.TableStatus === 'ACTIVE') {
                console.log(`✅ Table '${tableName}' is ACTIVE.`);
                return;
            }
        } catch (error) {
            // Ignore error if description fails temporarily during creation
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

async function createTableIfNotExists(tableName) {
    try {
        const listRes = await client.send(new ListTablesCommand({}));
        if (listRes.TableNames && listRes.TableNames.includes(tableName)) {
            console.log(`✅ Table '${tableName}' already exists.`);
            return;
        }

        console.log(`⏳ Creating table '${tableName}'...`);
        const command = new CreateTableCommand({
            TableName: tableName,
            AttributeDefinitions: [
                { AttributeName: 'id', AttributeType: 'S' }
            ],
            KeySchema: [
                { AttributeName: 'id', KeyType: 'HASH' }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1
            }
        });
        await client.send(command);
        console.log(`✅ Table '${tableName}' created successfully.`);
        await waitForTableActive(tableName);
    } catch (error) {
        console.error(`❌ Error creating table '${tableName}':`, error);
    }
}

async function main() {
    if (!process.env.MY_AWS_ACCESS_KEY_ID || !process.env.MY_AWS_SECRET_ACCESS_KEY) {
        console.error("❌ Error: MY_AWS_ACCESS_KEY_ID and MY_AWS_SECRET_ACCESS_KEY must be set in .env.local");
        process.exit(1);
    }

    console.log("🚀 Starting DynamoDB Table Provisioning...");
    for (const table of tables) {
        await createTableIfNotExists(table);
    }
    console.log("🏁 Finished Provisioning.");
}

main();
