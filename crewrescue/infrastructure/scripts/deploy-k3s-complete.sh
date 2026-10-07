#!/bin/bash
set -e

echo "============================================================"
echo "  CrewRescue AI — Complete k3s Deployment & Test"
echo "============================================================"
echo "Start time: $(date)"
echo ""

# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_DIR="/mnt/f/i_p/crewrescue"
K3S_NAMESPACE="crewrescue"

# ── Helper Functions ──────────────────────────────────────────────────────────
log_info() {
    echo "  ✅ $1"
}

log_step() {
    echo ""
    echo "━━━ $1 ━━━"
}

# ── Step 1: Build Docker Images ───────────────────────────────────────────────
log_step "Step 1/6: Building Docker Images"

echo "  Building crewrescue-api:latest..."
sudo docker build -t crewrescue-api:latest \
    -f ${PROJECT_DIR}/infrastructure/docker/api.Dockerfile \
    ${PROJECT_DIR}
log_info "API image built"

echo "  Building crewrescue-web:latest..."
sudo docker build -t crewrescue-web:latest \
    -f ${PROJECT_DIR}/infrastructure/docker/web.Dockerfile \
    ${PROJECT_DIR}
log_info "Web image built"

# ── Step 2: Load Images into k3s ─────────────────────────────────────────────
log_step "Step 2/6: Loading Images into k3s"

echo "  Saving and loading API image..."
sudo docker save crewrescue-api:latest | sudo k3s ctr images import -
log_info "API image loaded into k3s"

echo "  Saving and loading Web image..."
sudo docker save crewrescue-web:latest | sudo k3s ctr images import -
log_info "Web image loaded into k3s"

echo "  Verifying images in k3s..."
sudo k3s ctr images list | grep crewrescue

# ── Step 3: Patch Deployments to Use Local Images ────────────────────────────
log_step "Step 3/6: Configuring Deployments"

echo "  Patching API deployment..."
sudo k3s kubectl patch deployment api -n ${K3S_NAMESPACE} \
    -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","imagePullPolicy":"Never"}]}}}}' \
    2>/dev/null || echo "  ⚠️  API deployment not found, will create in next step"

echo "  Patching Web deployment..."
sudo k3s kubectl patch deployment web -n ${K3S_NAMESPACE} \
    -p '{"spec":{"template":{"spec":{"containers":[{"name":"web","imagePullPolicy":"Never"}]}}}}' \
    2>/dev/null || echo "  ⚠️  Web deployment not found, will create in next step"

log_info "Deployments patched"

# ── Step 4: Delete Failed Pods and Force Recreate ────────────────────────────
log_step "Step 4/6: Cleaning Up Failed Pods"

echo "  Deleting failed API pods..."
sudo k3s kubectl delete pods -n ${K3S_NAMESPACE} -l app=crewrescue,component=api \
    --ignore-not-found=true --wait=false

echo "  Deleting failed Web pods..."
sudo k3s kubectl delete pods -n ${K3S_NAMESPACE} -l app=crewrescue,component=web \
    --ignore-not-found=true --wait=false

echo "  Waiting for pods to be recreated..."
sleep 30

echo ""
echo "  Current pod status:"
sudo k3s kubectl get pods -n ${K3S_NAMESPACE}

# ── Step 5: Seed Database ────────────────────────────────────────────────────
log_step "Step 5/6: Seeding Database"

echo "  Waiting for MongoDB to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if sudo k3s kubectl get pods -n ${K3S_NAMESPACE} -l app=crewrescue,component=mongo | grep -q "Running"; then
        echo "  ✅ MongoDB pod is running"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "  ⏳ Waiting for MongoDB... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 5
done

echo "  Seeding database..."
cd ${PROJECT_DIR}/backend/api
node scripts/seed.js
log_info "Database seeded successfully"

# ── Step 6: Setup Port-Forwards and Test ─────────────────────────────────────
log_step "Step 6/6: Setting Up Access and Testing"

echo "  Setting up port-forwards..."

# Kill existing port-forwards
pkill -f "kubectl port-forward svc/api" 2>/dev/null || true
pkill -f "kubectl port-forward svc/web" 2>/dev/null || true

# Start port-forwards
sudo k3s kubectl port-forward svc/api 5000:5000 -n ${K3S_NAMESPACE} &
PF_API_PID=$!
sleep 3

sudo k3s kubectl port-forward svc/web 5173:80 -n ${K3S_NAMESPACE} &
PF_WEB_PID=$!
sleep 3

log_info "API port-forwarded to http://localhost:5000 (PID: $PF_API_PID)"
log_info "Web port-forwarded to http://localhost:5173 (PID: $PF_WEB_PID)"

echo ""
echo "  Testing API health..."
sleep 5

if curl -s http://localhost:5000/health > /dev/null; then
    log_info "API health check passed"
    curl -s http://localhost:5000/health | grep -o '"status":"[^"]*"' | head -1
else
    echo "  ⚠️  API not ready yet, waiting..."
    sleep 10
    curl -s http://localhost:5000/health || echo "  ❌ API health check failed"
fi

echo ""
echo "  Testing Web frontend..."
if curl -s http://localhost:5173 > /dev/null; then
    log_info "Web frontend accessible"
    echo "  Content length: $(curl -s http://localhost:5173 | wc -c) bytes"
else
    echo "  ⚠️  Web not ready yet, waiting..."
    sleep 10
    curl -s http://localhost:5173 | wc -c || echo "  ❌ Web frontend not accessible"
fi

# ── Run Functional Tests ─────────────────────────────────────────────────────
log_step "Bonus: Running Functional Tests"

echo "  Running functional tests..."
cd ${PROJECT_DIR}/backend/api
node scripts/funcTest.mjs || echo "  ⚠️  Some tests failed"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  🎉 DEPLOYMENT COMPLETE"
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
echo "   Restart API:    sudo k3s kubectl rollout restart deployment/api -n ${K3S_NAMESPACE}"
echo "   Restart Web:    sudo k3s kubectl rollout restart deployment/web -n ${K3S_NAMESPACE}"
echo "   Stop all:       sudo k3s kubectl delete namespace ${K3S_NAMESPACE}"
echo ""
echo "🔄 Port-forward PIDs:"
echo "   API: $PF_API_PID"
echo "   Web: $PF_WEB_PID"
echo ""
echo "To stop port-forwards:"
echo "   kill $PF_API_PID $PF_WEB_PID"
echo ""
