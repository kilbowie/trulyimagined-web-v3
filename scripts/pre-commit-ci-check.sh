#!/usr/bin/env bash
# Pre-commit CI gates validator
# Run this before pushing to catch issues early

set -e

echo "════════════════════════════════════════════════════════════"
echo "  CI GATES PRE-CHECK · Local Validation Before Push"
echo "════════════════════════════════════════════════════════════"
echo ""

# Graceful exit on error with advisory
trap 'echo ""; echo "❌ Failed at step: $BASH_COMMAND"; echo "Please fix and try again. See CI_GATES.md for details."; exit 1' ERR

# Step 1: Type Check (Hard Gate)
echo "📋 [1/5] Running TypeScript type-check..."
pnpm type-check
echo "✅ Type-check passed"
echo ""

# Step 2: Lint (Hard Gate)
echo "🎨 [2/5] Running linter..."
pnpm lint
echo "✅ Lint passed"
echo ""

# Step 3: Guardrails
echo "🧱 [3/5] Running HDICR boundary guardrails..."
pnpm check:hdicr-db-coimport
pnpm check:hdicr-owned-table-access
echo "✅ Guardrails passed"
echo ""

# Step 4: Unit Tests
echo "🧪 [4/5] Running unit tests..."
pnpm test
echo "✅ Unit tests passed"
echo ""

# Step 5: Integration Tests (web only)
echo "🔗 [5/5] Running web integration contract tests..."
pnpm --filter @trulyimagined/web test:integration
echo "✅ Integration tests passed"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "  ✨ All CI gates passed! Safe to push."
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next: git push"
