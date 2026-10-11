#!/bin/bash
# ============================================================
# CrewRescue AI — Full System Startup & Port Forward Script
# Run this every time Windows/WSL restarts
# Usage: bash /mnt/f/i_p/crewrescue/infrastructure/scripts/start-system.sh
# ============================================================
set -e

NAMESPACE="crewrescue"
WEB_PORT=5173
PWA_PORT=5174
API_PORT=5000

echo "╔══════════════════════════════════════════════════════╗"
echo "║        CrewRescue AI — System Startup                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Wait for k3s ──────────────────────────────────────────
echo "[1/5] Waiting for k3s API..."
for i in $(seq 1 30); do
  if k3s kubectl get nodes > /dev/null 2>&1; then
    echo "   ✅ k3s ready"
    break
  fi
  echo "   ⏳ Waiting... ($i/30)"
  sleep 5
done

# ── 2. Deploy manifests ───────────────────────────────────────
echo ""
echo "[2/5] Applying Kubernetes manifests..."
k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/01-secrets.yaml 2>/dev/null
k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/02-network-policy.yaml 2>/dev/null
k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/03-mongodb.yaml 2>/dev/null
k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/04-redis.yaml 2>/dev/null
k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/05-api.yaml 2>/dev/null
k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/06-web.yaml 2>/dev/null
echo "   ✅ Manifests applied"

# ── 3. Wait for pods ──────────────────────────────────────────
echo ""
echo "[3/5] Waiting for pods to be ready (up to 3 min)..."
k3s kubectl wait --for=condition=ready pod -l app=crewrescue -n $NAMESPACE --timeout=180s 2>/dev/null || true
echo "   ✅ Pods ready"

# ── 4. Kill stale port-forwards ────────────────────────────────
echo ""
echo "[4/5] Resetting port-forwards..."
pkill -f "kubectl port-forward" 2>/dev/null || true
pkill socat 2>/dev/null || true
sleep 1

# ── 5. Start port-forwards (bind 0.0.0.0 so Windows can reach) ─
echo ""
echo "[5/5] Starting port-forwards..."

nohup k3s kubectl port-forward --address 0.0.0.0 \
  svc/crewrescue-api $API_PORT:5000 -n $NAMESPACE \
  > /tmp/pf-api.log 2>&1 &

nohup k3s kubectl port-forward --address 0.0.0.0 \
  svc/crewrescue-web $WEB_PORT:80 -n $NAMESPACE \
  > /tmp/pf-web.log 2>&1 &

nohup k3s kubectl port-forward --address 0.0.0.0 \
  svc/crewrescue-pwa $PWA_PORT:80 -n $NAMESPACE \
  > /tmp/pf-pwa.log 2>&1 &

sleep 3

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           🚀 System Online!                         ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Web Console:    http://localhost:5173              ║"
echo "║  Technician PWA: http://localhost:5174              ║"
echo "║  API Health:     http://localhost:5000/health       ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Admin:      admin@dhakapower.bd                    ║"
echo "║  Password:   Admin@CrewRescue2025                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Verify ports are actually responding
sleep 2
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$API_PORT/health | grep -q "200"; then
  echo "   ✅ API responding on :$API_PORT"
else
  echo "   ⚠️  API not yet ready on :$API_PORT — check: cat /tmp/pf-api.log"
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost:$WEB_PORT | grep -q "200"; then
  echo "   ✅ Web responding on :$WEB_PORT"
else
  echo "   ⚠️  Web not yet ready on :$WEB_PORT — check: cat /tmp/pf-web.log"
fi
