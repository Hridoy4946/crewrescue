#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CrewRescue AI — Emergency Storm Load Generator
# Triggers massive GA/SA optimization runs to spike Worker CPU > 70% and verify HPA
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

API_URL="${API_URL:-http://localhost:5000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@dhakapower.bd}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@CrewRescue2025}"
STORM_CONCURRENCY="${STORM_CONCURRENCY:-10}"

echo "🌪️  Initiating CrewRescue AI Emergency Storm Scenario..."

# 1. Authenticate
echo "🔑 Logging in as Admin..."
LOGIN_RES=$(curl -s -X POST "${API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")

TOKEN=$(echo "${LOGIN_RES}" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "${TOKEN}" ]; then
  echo "❌ Login failed: ${LOGIN_RES}"
  exit 1
fi
echo "✅ Authenticated. Token acquired."

# 2. Declare Critical Emergency (Level 3)
echo "🚨 Declaring Emergency Level 3 (Critical)..."
curl -s -X POST "${API_URL}/api/emergency/declare" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"level":3,"reason":"Cyclone Storm Inbound — Automated Grid Rescheduling"}' > /dev/null || true

# 3. Fire concurrent Genetic Algorithm runs
echo "⚡ Firing ${STORM_CONCURRENCY} concurrent Genetic Algorithm optimization jobs..."
for i in $(seq 1 "${STORM_CONCURRENCY}"); do
  (
    curl -s -X POST "${API_URL}/api/optimization/run" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"algorithm":"GENETIC_ALGORITHM","trigger":"EMERGENCY_DECLARED"}' > /dev/null
    echo "  → Job #${i} queued"
  ) &
done

wait

echo ""
echo "🔥 Emergency Storm workload dispatched to BullMQ!"
echo "📊 Monitoring HPA status: kubectl get hpa -w"
