const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('🚀 Connecting to Supabase...');
console.log('URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigration() {
    try {
        const migrationSQL = fs.readFileSync('supabase/migrations/20260125_add_expenses_tracking.sql', 'utf8');
        
        console.log('📝 Migration SQL loaded, size:', migrationSQL.length, 'bytes');
        console.log('\n⚠️  NOTE: The Supabase anon key cannot run DDL statements.');
        console.log('You need to run this migration through the Supabase Dashboard SQL Editor.\n');
        console.log('='.repeat(80));
        console.log('COPY THE SQL BELOW AND PASTE IT IN YOUR SUPABASE SQL EDITOR:');
        console.log('='.repeat(80));
        console.log(migrationSQL);
        console.log('='.repeat(80));
        console.log('\nGo to: https://supabase.com/dashboard/project/uqjwfnevtefdfpbckuwf/sql/new');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

runMigration();
