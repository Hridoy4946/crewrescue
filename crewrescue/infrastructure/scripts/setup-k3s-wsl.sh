#!/bin/bash
set -e

echo "=== CrewRescue AI — WSL Kubernetes Setup & Deploy ==="
echo "Start time: $(date)"
echo ""

# ── 1. Enable passwordless sudo for phoenix user ────────────────────────────────
echo "[1/6] Enabling passwordless sudo..."
if ! sudo -n true 2>/dev/null; then
    echo 'phoenix ALL=(ALL) NOPASSWD:ALL' | sudo EDITOR='tee -a' visudo
    echo "   ✅ Passwordless sudo configured"
else
    echo "   ✅ Sudo already works without password"
fi

# ── 2. Wait for k3s to be ready ────────────────────────────────────────────
echo ""
echo "[2/6] Waiting for k3s API..."
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if sudo k3s kubectl get nodes > /dev/null 2>&1; then
        echo "   ✅ k3s API is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   ⏳ Waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 10
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "   ❌ k3s failed to become ready after $((MAX_RETRIES * 10)) seconds"
    exit 1
fi

echo ""
echo "   Kubernetes nodes:"
sudo k3s kubectl get nodes

# ── 3. Set up kubeconfig ───────────────────────────────────────────────────
echo ""
echo "[3/6] Setting up kubeconfig..."
mkdir -p ~/.kube
sudo k3s kubectl config view --raw > ~/.kube/config
chmod 600 ~/.kube/config
echo "   ✅ kubeconfig saved to ~/.kube/config"

# ── 4. Deploy CrewRescue to Kubernetes ────────────────────────────────────
echo ""
echo "[4/6] Deploying CrewRescue to Kubernetes..."

# Create namespace
echo "   Creating namespace..."
sudo k3s kubectl create namespace crewrescue --dry-run=client -o yaml | sudo k3s kubectl apply -f -

# Deploy secrets
echo "   Deploying secrets..."
sudo k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/01-secrets.yaml

# Deploy network policy
echo "   Deploying network policies..."
sudo k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/02-network-policy.yaml

# Deploy MongoDB
echo "   Deploying MongoDB..."
sudo k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/03-mongodb.yaml

# Deploy Redis
echo "   Deploying Redis..."
sudo k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/04-redis.yaml

# Deploy API
echo "   Deploying API..."
sudo k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/05-api.yaml

# Deploy Web
echo "   Deploying Web..."
sudo k3s kubectl apply -f /mnt/f/i_p/crewrescue/infrastructure/helm/crewrescue/templates/06-web.yaml

echo "   ✅ All manifests applied"

# ── 5. Wait for pods to be ready ──────────────────────────────────────────
echo ""
echo "[5/6] Waiting for pods to be ready..."
sleep 30

echo ""
echo "   Pod status:"
sudo k3s kubectl get pods -n crewrescue

echo ""
echo "   Services:"
sudo k3s kubectl get svc -n crewrescue

echo ""
echo "   Storage:"
sudo k3s kubectl get pvc -n crewrescue

# ── 6. Port-forward for local access ──────────────────────────────────────
echo ""
echo "[6/6] Setting up port-forwards..."

# Kill existing port-forwards if any
pkill -f "kubectl port-forward svc/api" 2>/dev/null || true
pkill -f "kubectl port-forward svc/web" 2>/dev/null || true

# Start new port-forwards in background
sudo k3s kubectl port-forward svc/api 5000:5000 -n crewrescue &
sleep 3

sudo k3s kubectl port-forward svc/web 5173:80 -n crewrescue &
sleep 3

echo "   ✅ API available at http://localhost:5000"
echo "   ✅ Web available at http://localhost:5173"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "=== Deployment Complete ==="
echo "End time: $(date)"
echo ""
echo "📋 Access Points:"
echo "   Web Console: http://localhost:5173"
echo "   API:         http://localhost:5000"
echo "   Health:      http://localhost:5000/health"
echo "   Metrics:     http://localhost:5000/metrics"
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
echo "   Check pods:     sudo k3s kubectl get pods -n crewrescue"
echo "   Check logs:     sudo k3s kubectl logs -n crewrescue -l app=crewrescue,component=api"
echo "   Restart API:    sudo k3s kubectl rollout restart deployment/api -n crewrescue"
echo "   Stop all:       sudo k3s kubectl delete namespace crewrescue"
echo ""
