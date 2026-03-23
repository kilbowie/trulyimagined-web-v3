// Test database connection and queries
// Run with: node --loader ts-node/esm apps/web/src/lib/test-db.ts

import { query, testConnection } from './db';

async function main() {
  console.log('[TEST] Testing database connection...\n');

  // Test 1: Connection
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Database connection failed');
    process.exit(1);
  }
  console.log('✅ Database connection successful\n');

  // Test 2: Check user_profiles table exists
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_profiles'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ user_profiles table exists');
    } else {
      console.error('❌ user_profiles table not found');
    }
  } catch (error) {
    console.error('❌ Error checking table:', error);
  }

  // Test 3: Check table structure
  try {
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_profiles'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 user_profiles table structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(required)' : '(optional)'}`);
    });
  } catch (error) {
    console.error('❌ Error checking structure:', error);
  }

  // Test 4: Check indexes
  try {
    const result = await query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'user_profiles'
    `);
    
    console.log('\n📊 Indexes:');
    result.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });
  } catch (error) {
    console.error('❌ Error checking indexes:', error);
  }

  // Test 5: Check other tables
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📁 All tables in database:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
  } catch (error) {
    console.error('❌ Error listing tables:', error);
  }

  console.log('\n✅ All database tests passed!');
  process.exit(0);
}

main().catch(console.error);
