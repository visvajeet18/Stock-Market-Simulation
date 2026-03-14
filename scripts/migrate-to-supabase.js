const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DATA_DIR = path.join(process.cwd(), 'data');

async function migrate() {
  console.log('🔄 Starting Data Migration to Supabase...');
  try {
    const files = await fs.readdir(DATA_DIR);
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const collectionName = file.replace('.json', '');
      const filePath = path.join(DATA_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (!content.trim()) continue;
      
      const data = JSON.parse(content);
      
      console.log(`\n📦 Migrating [${collectionName}]...`);
      
      if (file === 'market_state.json') {
        const { error } = await supabase.from(collectionName).upsert({
          id: 'current',
          data: data
        });
        
        if (error) {
          console.error(`❌ Error migrating market_state:`, error);
        } else {
          console.log(`✅ Migrated market_state successfully.`);
        }
      } else if (Array.isArray(data)) {
        if (data.length === 0) {
          console.log(`⏭️  Skipping empty array in ${file}`);
          continue;
        }

        const payload = data.map(item => {
          const id = item.id ? String(item.id) : require('crypto').randomUUID();
          const { id: _, ...cleanItem } = item;
          return { id, data: cleanItem };
        });

        // Supabase limits payload size for bulk inserts, batch in chunks of 500
        const CHUNK_SIZE = 500;
        let successCount = 0;
        for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
            const chunk = payload.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase.from(collectionName).upsert(chunk);
            if (error) {
                console.error(`❌ Error migrating chunk of ${collectionName}:`, error);
            } else {
                successCount += chunk.length;
            }
        }
        console.log(`✅ Migrated ${successCount} records to ${collectionName}.`);
        
      }
    }
    console.log('\n🎉 Migration to Supabase Complete!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrate();
