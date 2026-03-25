/**
 * Seed Test Headshot
 * Seeds the database with a test headshot using a local file as proxy
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function seedTestHeadshot() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Seeding test headshot...\n');

    // 1. Get the actor by auth0_user_id (you'll need to replace this with your actual Auth0 user ID)
    // For now, let's get the first actor
    const actorResult = await client.query('SELECT id, email FROM actors LIMIT 1');
    
    if (actorResult.rows.length === 0) {
      console.error('❌ No actors found in database. Please create an actor first.');
      return;
    }

    const actor = actorResult.rows[0];
    console.log(`✓ Found actor: ${actor.email} (ID: ${actor.id})`);

    // 2. Check if test headshot already exists
    const existingCheck = await client.query(
      'SELECT id FROM actor_media WHERE actor_id = $1 AND title = $2',
      [actor.id, 'Adam Ross Greene 001']
    );

    if (existingCheck.rows.length > 0) {
      console.log('⚠️  Test headshot already exists. Skipping seed.');
      return;
    }

    // 3. Copy the local file to dev-uploads directory
    const sourceFile = 'c:\\Users\\adamr\\Downloads\\a-r-greene_headshot.webp';
    const devUploadsDir = path.join(__dirname, '..', 'apps', 'web', 'public', 'dev-uploads');
    
    if (!fs.existsSync(devUploadsDir)) {
      fs.mkdirSync(devUploadsDir, { recursive: true });
    }

    // Generate a key similar to production
    const timestamp = Date.now();
    const s3Key = `actors/${actor.id}/headshots/${timestamp}-a-r-greene_headshot.webp`;
    const localFileName = s3Key.replace(/\//g, '_');
    const destFile = path.join(devUploadsDir, localFileName);

    // Copy file if source exists
    if (fs.existsSync(sourceFile)) {
      fs.copyFileSync(sourceFile, destFile);
      console.log(`✓ Copied file to: ${destFile}`);
    } else {
      console.log(`⚠️  Source file not found: ${sourceFile}`);
      console.log('   Will create database record anyway (you can add the file later)');
    }

    // Get file stats
    let fileSize = 0;
    if (fs.existsSync(destFile)) {
      const stats = fs.statSync(destFile);
      fileSize = stats.size;
    }

    // 4. Insert media record into database
    const insertQuery = `
      INSERT INTO actor_media (
        actor_id,
        media_type,
        file_name,
        s3_key,
        s3_url,
        file_size_bytes,
        mime_type,
        title,
        photo_credit,
        description,
        is_primary,
        display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `;

    const localUrl = `/dev-uploads/${localFileName}`;

    const result = await client.query(insertQuery, [
      actor.id,                           // actor_id
      'headshot',                         // media_type
      'a-r-greene_headshot.webp',        // file_name
      s3Key,                              // s3_key
      localUrl,                           // s3_url (local dev URL)
      fileSize,                           // file_size_bytes
      'image/webp',                       // mime_type
      'Adam Ross Greene 001',             // title
      'Michael Shelford',                 // photo_credit
      'Main headshot.',                   // description
      true,                               // is_primary
      0,                                  // display_order
    ]);

    console.log(`✓ Created media record with ID: ${result.rows[0].id}`);
    console.log('\n📊 Test Headshot Details:');
    console.log(`   Actor ID: ${actor.id}`);
    console.log(`   Title: Adam Ross Greene 001`);
    console.log(`   Photo Credit: Michael Shelford`);
    console.log(`   Description: Main headshot.`);
    console.log(`   Local URL: ${localUrl}`);
    console.log(`   S3 Key: ${s3Key}`);
    console.log(`   File Size: ${fileSize} bytes`);
    
    console.log('\n✅ Test headshot seeded successfully!');
    console.log('\n💡 To view in app:');
    console.log('   1. Make sure USE_MOCK_S3=true in your .env.local');
    console.log('   2. Run: pnpm dev');
    console.log('   3. Navigate to: http://localhost:3000/dashboard/profile');

  } catch (error) {
    console.error('❌ Error seeding test headshot:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed
seedTestHeadshot().catch(console.error);
