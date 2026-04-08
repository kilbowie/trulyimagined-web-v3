#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

function check(file, predicate, message) {
  const content = read(file);
  if (!predicate(content)) {
    throw new Error(`${file}: ${message}`);
  }
}

function main() {
  const checks = [];

  checks.push(() =>
    check(
      'infra/database/migrations/018_neutral_schema_aliases.sql',
      (c) => c.includes('CREATE OR REPLACE VIEW v_identity_subjects'),
      'missing neutral identity-subject view'
    )
  );

  checks.push(() =>
    check(
      'services/identity-service/openapi.yaml',
      (c) => c.includes('identitySubjectId:') && c.includes('displayName:'),
      'missing neutral response aliases in identity OpenAPI'
    )
  );

  checks.push(() =>
    check(
      'services/identity-service/openapi.yaml',
      (c) => c.includes('x-tenant-specific: trulyimagined'),
      'missing tenant-specific metadata marker'
    )
  );

  checks.push(() =>
    check(
      'services/identity-service/src/index.ts',
      (c) => c.includes('identitySubjectId: actor.id') && c.includes('displayName:'),
      'missing neutral aliases in identity API payloads'
    )
  );

  checks.push(() =>
    check(
      'docs/HDICR_TENANT_ONBOARDING_GUIDE.md',
      (c) => c.includes('No schema migration required') && c.includes('tenant_id'),
      'missing onboarding guidance'
    )
  );

  for (const run of checks) {
    run();
  }

  console.log('tenant-neutral readiness check passed');
}

try {
  main();
} catch (error) {
  console.error(`tenant-neutral readiness check failed: ${error.message}`);
  process.exit(1);
}
