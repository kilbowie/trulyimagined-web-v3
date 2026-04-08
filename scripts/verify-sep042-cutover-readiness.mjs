#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();

const runtimeRoot = path.join(repoRoot, 'apps', 'web', 'src');
const hdicrClientRoot = path.join(runtimeRoot, 'lib', 'hdicr');
const dbClientFile = path.join(runtimeRoot, 'lib', 'db.ts');

const sourceExt = new Set(['.ts', '.tsx', '.js', '.jsx']);

const hdicrOwnedTables = [
  'identity_links',
  'consent_ledger',
  'licenses',
  'license_usage_log',
  'bitstring_status_lists',
  'credential_status_entries',
  'verifiable_credentials',
];

const sqlPattern = new RegExp(
  `(FROM|JOIN|UPDATE)\\s+(${hdicrOwnedTables.join('|')})|INSERT\\s+INTO\\s+(${hdicrOwnedTables.join('|')})|DELETE\\s+FROM\\s+(${hdicrOwnedTables.join('|')})`,
  'i'
);

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') {
        continue;
      }
      walk(full, out);
      continue;
    }

    const ext = path.extname(entry.name);
    if (!sourceExt.has(ext)) {
      continue;
    }

    const lower = entry.name.toLowerCase();
    if (
      lower.includes('.test.') ||
      lower.includes('.spec.') ||
      lower.includes('.contract.test.')
    ) {
      continue;
    }

    out.push(full);
  }

  return out;
}

function fail(message) {
  console.error(`sep-042 readiness failed: ${message}`);
  process.exit(1);
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function checkDbClientFallback() {
  if (!fs.existsSync(dbClientFile)) {
    fail('apps/web/src/lib/db.ts not found');
  }

  const content = fs.readFileSync(dbClientFile, 'utf8');
  if (!content.includes('process.env.TI_DATABASE_URL')) {
    fail('db client does not prefer TI_DATABASE_URL');
  }

  console.log('ok: db client prefers TI_DATABASE_URL');
}

function checkNoLocalAdapterPaths() {
  if (!fs.existsSync(hdicrClientRoot)) {
    fail('apps/web/src/lib/hdicr not found');
  }

  const files = walk(hdicrClientRoot);
  const offenders = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('function ') && content.includes('Local(')) {
      offenders.push(relative(file));
    }
    if (content.includes('async function ') && content.includes('Local(')) {
      offenders.push(relative(file));
    }
  }

  if (offenders.length > 0) {
    fail(`local adapter paths found in HDICR clients: ${offenders.join(', ')}`);
  }

  console.log('ok: no Local adapter functions detected in apps/web/src/lib/hdicr');
}

function checkNoHdicrOwnedSqlInRuntime() {
  const files = walk(runtimeRoot);
  const offenders = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (sqlPattern.test(content)) {
      offenders.push(relative(file));
    }
  }

  if (offenders.length > 0) {
    fail(`runtime code still references HDICR-owned SQL tables: ${offenders.join(', ')}`);
  }

  console.log('ok: no direct SQL against HDICR-owned tables in apps/web runtime source');
}

function checkRunbookExists() {
  const runbook = path.join(repoRoot, 'docs', 'SEP042_CUTOVER_RUNBOOK.md');
  if (!fs.existsSync(runbook)) {
    fail('missing docs/SEP042_CUTOVER_RUNBOOK.md');
  }
  console.log('ok: cutover runbook exists');
}

function main() {
  checkDbClientFallback();
  checkNoLocalAdapterPaths();
  checkNoHdicrOwnedSqlInRuntime();
  checkRunbookExists();
  console.log('sep-042 readiness check passed');
}

main();
