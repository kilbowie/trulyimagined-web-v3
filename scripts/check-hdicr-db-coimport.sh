#!/usr/bin/env bash
set -euo pipefail

API_ROOT="apps/web/src/app/api"

# TODO(SEP-003): Add any legacy exemptions here while they are being migrated.
# Keep this list empty whenever possible.
EXEMPT_FILES=(
)

is_exempt() {
  local target="$1"
  for exempt in "${EXEMPT_FILES[@]}"; do
    if [[ "$target" == "$exempt" ]]; then
      return 0
    fi
  done
  return 1
}

if command -v rg >/dev/null 2>&1; then
  mapfile -t hdicr_files < <(rg -l "from ['\"]@/lib/hdicr/" "$API_ROOT")
  has_db_import() {
    local file="$1"
    rg -q "from ['\"]@/lib/db(\\.ts)?['\"]" "$file"
  }
else
  mapfile -t hdicr_files < <(grep -R -l -E "from ['\"]@/lib/hdicr/" "$API_ROOT" || true)
  has_db_import() {
    local file="$1"
    grep -q -E "from ['\"]@/lib/db(\.ts)?['\"]" "$file"
  }
fi

if [[ ${#hdicr_files[@]} -eq 0 ]]; then
  echo "[SEP-003] No HDICR route files found under $API_ROOT."
  exit 0
fi

violations=()
for file in "${hdicr_files[@]}"; do
  if is_exempt "$file"; then
    continue
  fi

  if has_db_import "$file"; then
    violations+=("$file")
  fi
done

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "[SEP-003] Guardrail failed: routes cannot import both @/lib/hdicr/* and @/lib/db."
  for file in "${violations[@]}"; do
    echo "  - $file"
  done
  exit 1
fi

echo "[SEP-003] Guardrail passed: no HDICR + direct DB co-import violations found."
