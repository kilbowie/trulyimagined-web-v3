const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

// Parse connection string manually to configure SSL
const dbUrl = new URL(connectionString.replace('postgresql://', 'postgres://'));
const client = new Client({
  host: dbUrl.hostname,
  port: dbUrl.port || 5432,
  database: dbUrl.pathname.split('/')[1].split('?')[0],
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  ssl: { rejectUnauthorized: false },
});

async function checkProfiles() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check profiles for adamrossgreene@gmail.com
    const result = await client.query(`
      SELECT 
        id,
        auth0_user_id,
        email,
        role,
        username,
        created_at
      FROM user_profiles 
      WHERE email = 'adamrossgreene@gmail.com'
      ORDER BY created_at
    `);

    console.log('=== USER PROFILES FOR adamrossgreene@gmail.com ===');
    console.log(`Found ${result.rows.length} profile(s)\n`);

    if (result.rows.length === 0) {
      console.log('❌ NO PROFILES FOUND');
      console.log('\nThis explains the issue:');
      console.log('- The database has no profile for this email');
      console.log('- System tries to redirect to /select-role');
      console.log('- But middleware might be blocking or causing issues');
    } else {
      result.rows.forEach((row, i) => {
        console.log(`Profile ${i + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Auth0 ID: ${row.auth0_user_id}`);
        console.log(`  Email: ${row.email}`);
        console.log(`  Role: ${row.role}`);
        console.log(`  Username: ${row.username}`);
        console.log(`  Created: ${row.created_at}`);
        console.log('');
      });

      if (result.rows.length > 1) {
        console.log('⚠️  WARNING: Multiple profiles found!');
        console.log('This could cause login issues.');
      }
    }

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

checkProfiles();
