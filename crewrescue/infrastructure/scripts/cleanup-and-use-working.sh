#!/bin/bash
set -e

echo "============================================================"
echo "  CrewRescue AI — Cleanup & Use Working Deployment"
echo "============================================================"
echo "Start time: $(date)"
echo ""

K3S_NAMESPACE="crewrescue"

# ── Step 1: Delete broken deployments ─────────────────────────────────────
log_step() {
    echo ""
    echo "━━━ $1 ━━━"
}

log_info() {
    echo "  ✅ $1"
}

log_step "Step 1/4: Cleaning Up Broken Deployments"

echo "  Deleting failing 'api' deployment..."
sudo k3s kubectl delete deployment api -n ${K3S_NAMESPACE} --ignore-not-found=true --wait=false
log_info "Deleted 'api' deployment"

echo "  Deleting failing 'web' deployment..."
sudo k3s kubectl delete deployment web -n ${K3S_NAMESPACE} --ignore-not-found=true --wait=false
log_info "Deleted 'web' deployment"

echo "  Deleting orphaned MongoDB deployment..."
sudo k3s kubectl delete deployment mongo -n ${K3S_NAMESPACE} --ignore-not-found=true --wait=false
log_info "Deleted 'mongo' deployment"

echo "  Deleting orphaned Redis deployment..."
sudo k3s kubectl delete deployment redis -n ${K3S_NAMESPACE} --ignore-not-found=true --wait=false
log_info "Deleted 'redis' deployment"

echo "  Waiting for pods to stabilize..."
sleep 10

echo ""
echo "  Current working pods:"
sudo k3s kubectl get pods -n ${K3S_NAMESPACE}

# ── Step 2: Verify services ───────────────────────────────────────────────
log_step "Step 2/4: Verifying Services"

echo ""
echo "  Active services:"
sudo k3s kubectl get svc -n ${K3S_NAMESPACE}

# ── Step 3: Setup port-forwards ──────────────────────────────────────────
log_step "Step 3/4: Setting Up Port-Forwards"

echo "  Killing existing port-forwards..."
pkill -f "kubectl port-forward svc/crewrescue-api" 2>/dev/null || true
pkill -f "kubectl port-forward svc/crewrescue-web" 2>/dev/null || true
sleep 2

echo "  Starting port-forward for API..."
sudo k3s kubectl port-forward svc/crewrescue-api 5000:5000 -n ${K3S_NAMESPACE} &
PF_API_PID=$!
sleep 3

echo "  Starting port-forward for Web..."
sudo k3s kubectl port-forward svc/crewrescue-web 5173:80 -n ${K3S_NAMESPACE} &
PF_WEB_PID=$!
sleep 3

log_info "API port-forwarded to http://localhost:5000 (PID: $PF_API_PID)"
log_info "Web port-forwarded to http://localhost:5173 (PID: $PF_WEB_PID)"

# ── Step 4: Test connectivity ────────────────────────────────────────────
log_step "Step 4/4: Testing System"

echo ""
echo "  Testing API health..."
sleep 5

if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    log_info "API health check passed"
    curl -s http://localhost:5000/health | grep -o '"status":"[^"]*"' | head -1 || true
else
    echo "  ⚠️  API not ready yet, waiting..."
    sleep 15
    curl -s http://localhost:5000/health || echo "  ❌ API health check failed"
fi

echo ""
echo "  Testing Web frontend..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    log_info "Web frontend accessible"
    echo "  Content length: $(curl -s http://localhost:5173 | wc -c) bytes"
else
    echo "  ⚠️  Web not ready yet, waiting..."
    sleep 15
    curl -s http://localhost:5173 | wc -c || echo "  ❌ Web frontend not accessible"
fi

# ── Summary ──────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  🎉 CLEANUP COMPLETE"
echo "============================================================"
echo "End time: $(date)"
echo ""
echo "📋 Access Points:"
echo "   Web Console:  http://localhost:5173"
echo "   API:          http://localhost:5000"
echo "   Health:       http://localhost:5000/health"
echo "   Metrics:      http://localhost:5000/metrics"
echo ""
echo "🔐 Quick Demo Logins:"
echo "   Admin:            admin@dhakapower.bd / Admin@CrewRescue2025"
echo "   Dispatcher:       dispatcher@dhakapower.bd / Dispatch@2025"
echo "   Emergency Mgr:    emergency@dhakapower.bd / Emergency@2025"
echo "   Supervisor:       supervisor@dhakapower.bd / Supervisor@2025"
echo "   Executive:        executive@dhakapower.bd / Executive@2025"
echo "   Technician 1:     tech1@dhakapower.bd / Tech@2025"
echo "   Technician 2:     tech2@dhakapower.bd / Tech@2025"
echo ""
echo "📊 Useful Commands:"
echo "   Check pods:     sudo k3s kubectl get pods -n ${K3S_NAMESPACE}"
echo "   Check logs:     sudo k3s kubectl logs -n ${K3S_NAMESPACE} -l app=crewrescue,component=api"
echo "   Check services: sudo k3s kubectl get svc -n ${K3S_NAMESPACE}"
echo "   Restart API:    sudo k3s kubectl rollout restart deployment/crewrescue-api -n ${K3S_NAMESPACE}"
echo "   Restart Web:    sudo k3s kubectl rollout restart deployment/crewrescue-web -n ${K3S_NAMESPACE}"
echo "   Stop all:       sudo k3s kubectl delete namespace ${K3S_NAMESPACE}"
echo ""
echo "🔄 Port-forward PIDs:"
echo "   API: $PF_API_PID"
echo "   Web: $PF_WEB_PID"
echo ""
echo "To stop port-forwards:"
echo "   kill $PF_API_PID $PF_WEB_PID"
echo ""
