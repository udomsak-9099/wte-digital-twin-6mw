#!/usr/bin/env bash
# setup.sh — Supabase project setup guide
# Run this AFTER creating a project at supabase.com and copying .env

set -e
cd "$(dirname "$0")/../.."

echo "=== WtE Digital Twin — Supabase Setup ==="
echo ""

# 1. Check .env
if [ ! -f "config/.env" ]; then
  echo "❌ config/.env not found"
  echo "   → Copy config/.env.example to config/.env and fill in credentials"
  exit 1
fi
source config/.env
echo "✅ .env loaded"

# 2. Link project
echo ""
echo "→ Linking Supabase project..."
supabase link --project-ref "${SUPABASE_URL##*//}" 2>/dev/null || \
  echo "   Run manually: supabase link --project-ref <YOUR_PROJECT_REF>"

# 3. Run migration
echo ""
echo "→ Applying migration 001_plant_telemetry..."
supabase db push || echo "   Run manually: supabase db push"

echo ""
echo "✅ Done. Verify at: ${SUPABASE_URL}/project/default/editor"
