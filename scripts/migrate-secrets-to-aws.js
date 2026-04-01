#!/usr/bin/env node

/**
 * AWS Secrets Manager Migration Script
 *
 * Migrates secrets from .env.local to AWS Secrets Manager
 *
 * Usage:
 *   node scripts/migrate-secrets-to-aws.js [environment]
 *
 * Examples:
 *   node scripts/migrate-secrets-to-aws.js prod
 *   node scripts/migrate-secrets-to-aws.js staging
 *
 * Prerequisites:
 *   1. AWS CLI configured (`aws configure`)
 *   2. IAM permissions: secretsmanager:CreateSecret, kms:Encrypt
 *   3. Environment variables set in .env.local
 *
 * What This Script Does:
 *   1. Reads secrets from .env.local
 *   2. Creates secrets in AWS Secrets Manager
 *   3. Adds tags (Environment, Application, ManagedBy)
 *   4. Enables encryption with KMS
 *   5. Prints ARNs for Vercel configuration
 */

const {
  SecretsManagerClient,
  CreateSecretCommand,
  DescribeSecretCommand,
} = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const REGION = process.env.AWS_REGION || 'eu-west-2';
const ENV = process.argv[2] || 'prod'; // prod or staging

// Secrets to migrate
const SECRETS_TO_MIGRATE = [
  {
    name: 'encryption-key',
    envVar: 'ENCRYPTION_KEY',
    description: 'AES-256 key for database field encryption (Step 11)',
    rotationDays: 90,
    required: true, // Required for Step 11
  },
  {
    name: 'vc-issuer-key',
    envVar: 'VC_ISSUER_PRIVATE_KEY',
    description: 'Ed25519 private key for signing W3C Verifiable Credentials (Step 9)',
    rotationDays: 365,
    required: false, // Optional: Will be configured in Step 9
  },
  {
    name: 'consent-key',
    envVar: 'CONSENT_SIGNING_PRIVATE_KEY',
    description: 'RSA-2048 private key for signing JWT consent proofs (Step 10)',
    rotationDays: 365,
    required: false, // Optional: Will be configured in Step 10
  },
  {
    name: 'auth0-client-secret',
    envVar: 'AUTH0_CLIENT_SECRET',
    description: 'Auth0 Management API client secret',
    rotationDays: 90,
    required: false, // Optional: Will be added when Auth0 configured
  },
  {
    name: 'stripe-secret-key',
    envVar: 'STRIPE_SECRET_KEY',
    description: 'Stripe API secret key',
    rotationDays: 365,
    required: false, // Optional: Will be added when Stripe configured
  },
  {
    name: 'stripe-webhook-secret',
    envVar: 'STRIPE_WEBHOOK_SECRET',
    description: 'Stripe webhook signing secret',
    rotationDays: 365,
    required: false, // Optional: Will be added when Stripe configured
  },
];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function logHeader(message) {
  log(`\n${message}`, colors.bright + colors.blue);
  log('='.repeat(message.length), colors.blue);
}

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), 'apps', 'web', '.env.local');

  if (!fs.existsSync(envPath)) {
    logError(`Environment file not found: ${envPath}`);
    logInfo('Create apps/web/.env.local with your secrets first');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) {
      const [, key, value] = match;
      envVars[key] = value.replace(/^["']|["']$/g, ''); // Remove quotes
    }
  }

  return envVars;
}

// Check if secret already exists
async function secretExists(client, secretName) {
  try {
    await client.send(new DescribeSecretCommand({ SecretId: secretName }));
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

// Create secret in AWS Secrets Manager
async function createSecret(client, secretConfig, secretValue) {
  const secretName = `${ENV}/${secretConfig.name}`;

  try {
    // Check if secret already exists
    if (await secretExists(client, secretName)) {
      logWarning(`Secret already exists: ${secretName} (skipping)`);
      return null;
    }

    const command = new CreateSecretCommand({
      Name: secretName,
      Description: secretConfig.description,
      SecretString: secretValue,
      Tags: [
        { Key: 'Environment', Value: ENV },
        { Key: 'Application', Value: 'trulyimagined' },
        { Key: 'ManagedBy', Value: 'terraform' },
        { Key: 'RotationDays', Value: secretConfig.rotationDays.toString() },
      ],
      // Optional: Specify KMS key
      // KmsKeyId: 'alias/trulyimagined-secrets',
    });

    const response = await client.send(command);
    logSuccess(`Created secret: ${secretName}`);
    return response;
  } catch (error) {
    logError(`Failed to create secret ${secretName}: ${error.message}`);
    throw error;
  }
}

// Confirm before proceeding
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Main migration function
async function migrate() {
  logHeader(`AWS Secrets Manager Migration - ${ENV.toUpperCase()} Environment`);

  // Step 1: Load environment variables
  logInfo('Loading environment variables from .env.local...');
  const envVars = loadEnvFile();
  logSuccess(`Loaded ${Object.keys(envVars).length} environment variables`);

  // Step 2: Validate required secrets exist, warn about optional ones
  logInfo('\nValidating secrets...');
  const missingRequired = [];
  const missingOptional = [];
  const foundSecrets = [];

  for (const secret of SECRETS_TO_MIGRATE) {
    if (!envVars[secret.envVar]) {
      if (secret.required) {
        missingRequired.push(secret.envVar);
        logError(`Missing (REQUIRED): ${secret.envVar}`);
      } else {
        missingOptional.push(secret.envVar);
        logWarning(`Missing (optional): ${secret.envVar}`);
      }
    } else {
      foundSecrets.push(secret);
      const valuePreview = envVars[secret.envVar].substring(0, 10) + '...';
      logSuccess(`Found: ${secret.envVar} = ${valuePreview}`);
    }
  }

  if (missingRequired.length > 0) {
    logError(`\n${missingRequired.length} required secrets missing from .env.local`);
    logInfo('Add missing required secrets and try again');
    process.exit(1);
  }

  if (missingOptional.length > 0) {
    logInfo(`\n${missingOptional.length} optional secrets will be skipped (configure later)`);
  }

  // Step 3: Confirm migration
  logWarning('\n⚠️  WARNING: This will create secrets in AWS Secrets Manager');
  logInfo(`Environment: ${ENV}`);
  logInfo(`Region: ${REGION}`);
  logInfo(`Secrets to create: ${foundSecrets.length}`);

  const confirmed = await confirm('\nProceed with migration?');
  if (!confirmed) {
    logInfo('Migration cancelled');
    process.exit(0);
  }

  // Step 4: Create AWS Secrets Manager client
  logInfo('\nConnecting to AWS Secrets Manager...');
  const client = new SecretsManagerClient({ region: REGION });
  logSuccess(`Connected to ${REGION}`);

  // Step 5: Migrate secrets (only those with values)
  logHeader('\nMigrating Secrets');
  const results = [];

  for (const secret of foundSecrets) {
    const secretValue = envVars[secret.envVar];
    const response = await createSecret(client, secret, secretValue);

    if (response) {
      results.push({
        name: `${ENV}/${secret.name}`,
        arn: response.ARN,
        versionId: response.VersionId,
      });
    }
  }

  // Step 6: Print results
  if (results.length > 0) {
    logHeader('\nMigration Results');
    logSuccess(`Successfully created ${results.length} secrets`);

    log('\nSecret ARNs (save these for Vercel configuration):\n', colors.cyan);
    for (const result of results) {
      log(`${result.name}:`, colors.bright);
      log(`  ARN: ${result.arn}`);
      log(`  Version: ${result.versionId}\n`);
    }

    // Step 7: Next steps
    logHeader('Next Steps');
    log('1. Configure Vercel environment variables:');
    log('   AWS_REGION=' + REGION);
    log('   AWS_ACCESS_KEY_ID=<your-access-key>');
    log('   AWS_SECRET_ACCESS_KEY=<your-secret-key>\n');

    log('2. Test secret retrieval with AWS CLI:');
    log(
      '   aws secretsmanager get-secret-value --secret-id ' +
        results[0].name +
        ' --region ' +
        REGION +
        '\n'
    );

    log('3. Deploy application:');
    log('   vercel --prod\n');

    log('4. Set up rotation (optional):');
    log('   aws secretsmanager rotate-secret --secret-id ' + results[0].name);
  } else {
    logInfo('\nNo new secrets created (all already exist)');
  }

  logSuccess('\n✓ Migration complete!');
}

// Run migration
migrate().catch((error) => {
  logError(`\nMigration failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
