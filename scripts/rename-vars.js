const fs = require('fs/promises');
const path = require('path');

const filesToFix = [
    'lib/dynamodb.ts',
    'scripts/deploy-dynamodb.js',
    'scripts/migrate-data-dynamodb.js',
    'scripts/update-billing-mode.js',
    'scripts/verify-dynamodb.js',
    '.env.local'
];

async function fixFile(filename) {
    const filePath = path.join(process.cwd(), filename);
    try {
        let content = await fs.readFile(filePath, 'utf-8');
        let changed = false;

        const maps = [
            { from: 'AWS_ACCESS_KEY_ID', to: 'MY_AWS_ACCESS_KEY_ID' },
            { from: 'AWS_SECRET_ACCESS_KEY', to: 'MY_AWS_SECRET_ACCESS_KEY' },
            { from: 'AWS_REGION', to: 'MY_AWS_REGION' }
        ];

        for (const map of maps) {
            if (content.includes(map.from)) {
                content = content.replaceAll(map.from, map.to);
                changed = true;
            }
        }

        if (changed) {
            await fs.writeFile(filePath, content, 'utf-8');
            console.log(`✅ Fixed environment variables in '${filename}'`);
        } else {
            console.log(`ℹ️ No matching variables in '${filename}', skipped.`);
        }
    } catch (error) {
        console.error(`❌ Error fixing '${filename}':`, error.message);
    }
}

async function main() {
    console.log("🚀 Starting environment variable rename...");
    for (const file of filesToFix) {
        await fixFile(file);
    }
    console.log("🏁 Rename complete.");
}

main();
