#!/usr/bin/env node

/**
 * AWS Secrets Manager Test Script
 * 
 * Tests secret retrieval from AWS Secrets Manager
 * 
 * Usage:
 *   node scripts/test-secrets-manager.js [environment]
 * 
 * Examples:
 *   node scripts/test-secrets-manager.js prod
 *   node scripts/test-secrets-manager.js staging
 * 
 * What This Script Tests:
 *   1. AWS credentials configured correctly
 *   2. IAM permissions (GetSecretValue)
 *   3. Secrets exist and are accessible
 *   4. Secret values are not empty
 *   5. Cache functionality works
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Configuration
const REGION = process.env.AWS_REGION || 'eu-west-2';
const ENV = process.argv[2] || 'prod';

// Secrets to test
const SECRETS_TO_TEST = [
  'encryption-key',
  'vc-issuer-key',
  'consent-key',
  'auth0-client-secret',
  'stripe-secret-key',
  'stripe-webhook-secret',
];

// Colors
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

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function logHeader(message) {
  log(`\n${message}`, colors.bright + colors.blue);
  log('='.repeat(message.length), colors.blue);
}

// Test secret retrieval
async function testSecret(client, secretName) {
  const fullSecretName = `${ENV}/${secretName}`;
  
  try {
    const startTime = Date.now();
    
    const command = new GetSecretValueCommand({
      SecretId: fullSecretName,
      VersionStage: 'AWSCURRENT',
    });
    
    const response = await client.send(command);
    const duration = Date.now() - startTime;
    
    if (!response.SecretString) {
      logError(`${secretName}: No SecretString (binary secret?)`);
      return { success: false, duration };
    }
    
    const valueLength = response.SecretString.length;
    const valuePreview = response.SecretString.substring(0, 10) + '...';
    
    logSuccess(`${secretName}: Retrieved (${valueLength} chars, ${duration}ms) - ${valuePreview}`);
    return { success: true, duration, length: valueLength };
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      logError(`${secretName}: Secret not found`);
    } else if (error.name === 'AccessDeniedException') {
      logError(`${secretName}: Access denied (check IAM permissions)`);
    } else {
      logError(`${secretName}: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

// Test cache performance
async function testCaching(client, secretName) {
  const fullSecretName = `${ENV}/${secretName}`;
  
  logInfo(`\nTesting cache performance for ${secretName}...`);
  
  // First call (cache miss)
  const start1 = Date.now();
  await client.send(new GetSecretValueCommand({ SecretId: fullSecretName }));
  const duration1 = Date.now() - start1;
  
  // Second call (should be similar - AWS has internal caching but we'd need client-side cache)
  const start2 = Date.now();
  await client.send(new GetSecretValueCommand({ SecretId: fullSecretName }));
  const duration2 = Date.now() - start2;
  
  log(`  First call:  ${duration1}ms (API request)`);
  log(`  Second call: ${duration2}ms (may be cached by AWS)`);
  
  if (duration2 < duration1 * 0.5) {
    logSuccess(`  Caching appears active (${Math.round((1 - duration2/duration1) * 100)}% faster)`);
  } else {
    logInfo(`  Similar performance (add client-side cache for cost optimization)`);
  }
}

// Main test function
async function testSecretsManager() {
  logHeader(`AWS Secrets Manager Test - ${ENV.toUpperCase()} Environment`);
  
  // Step 1: Verify AWS credentials
  logInfo('Checking AWS credentials...');
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    logError('AWS credentials not found');
    logInfo('Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
    process.exit(1);
  }
  logSuccess('AWS credentials found');
  
  // Step 2: Create client
  logInfo(`Connecting to AWS Secrets Manager (${REGION})...`);
  const client = new SecretsManagerClient({ region: REGION });
  logSuccess('Connected');
  
  // Step 3: Test secret retrieval
  logHeader('\nTesting Secret Retrieval');
  const results = [];
  
  for (const secretName of SECRETS_TO_TEST) {
    const result = await testSecret(client, secretName);
    results.push({ name: secretName, ...result });
  }
  
  // Step 4: Print summary
  logHeader('\nTest Summary');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  if (successCount > 0) {
    logSuccess(`✓ ${successCount}/${SECRETS_TO_TEST.length} secrets accessible`);
  }
  if (failCount > 0) {
    logError(`✗ ${failCount}/${SECRETS_TO_TEST.length} secrets failed`);
  }
  
  // Step 5: Performance stats
  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length > 0) {
    const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
    const maxDuration = Math.max(...successfulResults.map(r => r.duration));
    
    logInfo(`\nPerformance:`);
    log(`  Average retrieval time: ${Math.round(avgDuration)}ms`);
    log(`  Maximum retrieval time: ${maxDuration}ms`);
    
    if (avgDuration > 500) {
      logInfo('  Consider implementing client-side caching to improve performance');
    } else if (avgDuration < 100) {
      logSuccess('  Excellent performance!');
    }
  }
  
  // Step 6: Test caching (optional)
  if (successfulResults.length > 0) {
    await testCaching(client, successfulResults[0].name);
  }
  
  // Step 7: Cost estimate
  logHeader('\nCost Estimate');
  log(`Secrets stored: ${successCount} × $0.40/month = $${(successCount * 0.40).toFixed(2)}/month`);
  log('API calls: ~3,000/month × $0.05/10K = $0.02/month');
  log(`Total estimated cost: $${(successCount * 0.40 + 0.02).toFixed(2)}/month`);
  
  // Step 8: Next steps
  if (failCount > 0) {
    logHeader('\nNext Steps');
    log('1. Run migration script:');
    log('   node scripts/migrate-secrets-to-aws.js ' + ENV);
    log('\n2. Check IAM permissions:');
    log('   secretsmanager:GetSecretValue');
    log('   kms:Decrypt');
  } else {
    logSuccess('\n✓ All tests passed! Secrets Manager is ready for production.');
  }
  
  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
testSecretsManager().catch((error) => {
  logError(`\nTest failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
