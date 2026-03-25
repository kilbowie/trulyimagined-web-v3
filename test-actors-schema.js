#!/usr/bin/env node
/**
 * Test Database Schema
 * Checks if actors table exists and has correct columns
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function testSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('🔍 Checking database connection...');
    
    // Test connection
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log(`   Time: ${connectionTest.rows[0].now}`);

    console.log('\n🔍 Checking actors table schema...');
    
    // Check if actors table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'actors'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ actors table does not exist!');
      console.log('   Run the migration: infra/database/migrations/001_initial_schema.sql');
      process.exit(1);
    }

    console.log('✅ actors table exists');

    // Get table columns
    const columnsQuery = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'actors'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 actors table columns:');
    columnsQuery.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(required)';
      console.log(`   - ${col.column_name}: ${col.data_type} ${nullable}`);
    });

    // Check specific required columns
    const requiredColumns = ['id', 'auth0_user_id', 'email', 'first_name', 'last_name', 'registry_id', 'location'];
    const actualColumns = columnsQuery.rows.map(c => c.column_name);
    
    console.log('\n🔍 Verifying required columns...');
    let missingColumns = [];
    requiredColumns.forEach(col => {
      if (actualColumns.includes(col)) {
        console.log(`   ✅ ${col}`);
      } else {
        console.log(`   ❌ ${col} (MISSING!)`);
        missingColumns.push(col);
      }
    });

    if (missingColumns.length > 0) {
      console.log(`\n❌ Missing columns: ${missingColumns.join(', ')}`);
      console.log('   The schema may need to be updated.');
    } else {
      console.log('\n✅ All required columns present');
    }

    // Check for any existing actors
    const actorCount = await pool.query('SELECT COUNT(*) FROM actors');
    console.log(`\n📊 Existing actors: ${actorCount.rows[0].count}`);

    if (parseInt(actorCount.rows[0].count) > 0) {
      const sampleActor = await pool.query('SELECT id, email, registry_id, verification_status FROM actors LIMIT 1');
      console.log('   Sample actor:');
      console.log(`   - ID: ${sampleActor.rows[0].id}`);
      console.log(`   - Email: ${sampleActor.rows[0].email}`);
      console.log(`   - Registry ID: ${sampleActor.rows[0].registry_id}`);
      console.log(`   - Status: ${sampleActor.rows[0].verification_status}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('   Details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testSchema();
