#!/usr/bin/env bash
set -euo pipefail

TARGET_ROOT="apps/web/src"

# These tables are owned by HDICR domains and must not be queried directly by TI web runtime code.
TABLE_PATTERN="identity_links|consent_ledger|licenses|license_usage_log|bitstring_status_lists|credential_status_entries|verifiable_credentials"
SQL_PATTERN="(FROM|JOIN|UPDATE)[[:space:]]+(${TABLE_PATTERN})|INSERT[[:space:]]+INTO[[:space:]]+(${TABLE_PATTERN})|DELETE[[:space:]]+FROM[[:space:]]+(${TABLE_PATTERN})"

if command -v rg >/dev/null 2>&1; then
  if rg \
    --glob '*.{ts,tsx,js,jsx}' \
    --glob '!**/*.test.*' \
    --glob '!**/*.spec.*' \
    --glob '!**/*.contract.test.*' \
    --glob '!**/__tests__/**' \
    -n -i -e "$SQL_PATTERN" "$TARGET_ROOT"; then
    echo "[SEP-042] Guardrail failed: apps/web runtime code cannot query HDICR-owned tables directly."
    exit 1
  fi
else
  if grep -RInE \
    --include='*.ts' \
    --include='*.tsx' \
    --include='*.js' \
    --include='*.jsx' \
    --exclude='*.test.*' \
    --exclude='*.spec.*' \
    --exclude='*.contract.test.*' \
    "$SQL_PATTERN" "$TARGET_ROOT"; then
    echo "[SEP-042] Guardrail failed: apps/web runtime code cannot query HDICR-owned tables directly."
    exit 1
  fi
fi

echo "[SEP-042] Guardrail passed: no direct HDICR-owned table SQL found in apps/web runtime code."