#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CrewRescue AI — Multi-Node Kubernetes & ArgoCD Automated Setup Script
# Runs inside WSL2 Ubuntu environment.
# Sets up:
#   1. 3-Node KIND Cluster (Control-Plane + Worker-1 [web-api] + Worker-2 [compute-db])
#   2. NGINX Ingress Controller (with HostPort mappings)
#   3. ArgoCD GitOps Engine
#   4. CrewRescue Helm Release with Multi-Node Scheduling
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${INFRA_DIR}/.." && pwd)"

KIND_CONFIG="${INFRA_DIR}/k8s/kind-cluster.yaml"
ARGOCD_APP="${INFRA_DIR}/k8s/argocd-application.yaml"
if [[ ! -f "${ARGOCD_APP}" ]]; then
  ARGOCD_APP="${REPO_ROOT}/gitops/argocd/application.yaml"
fi

echo ""
echo "🚀 ════════════════════════════════════════════════════════════════"
echo "   CrewRescue AI — Multi-Node Kubernetes & ArgoCD GitOps Setup"
echo "════════════════════════════════════════════════════════════════════"
echo ""

# ── 1. Check & Install KIND ──────────────────────────────────────────────────
if ! command -v kind &>/dev/null; then
  echo "📦 Installing kind (Kubernetes in Docker)..."
  KIND_VERSION="v0.27.0"
  curl -Lo /tmp/kind "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-amd64"
  chmod +x /tmp/kind
  if [[ "$(id -u)" -eq 0 ]]; then
    mv /tmp/kind /usr/local/bin/kind
  else
    sudo mv /tmp/kind /usr/local/bin/kind || mv /tmp/kind ~/.local/bin/kind
  fi
  echo "   ✅ kind $(kind --version) installed"
else
  echo "   ✅ kind already installed ($(kind --version))"
fi

# ── 2. Create 3-Node Cluster ─────────────────────────────────────────────────
CLUSTER_NAME="crewrescue-cluster"
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "ℹ️  Cluster '${CLUSTER_NAME}' already exists."
  read -p "   Do you want to recreate it? (y/N): " -r RECREATE || RECREATE="n"
  if [[ "${RECREATE}" =~ ^[Yy]$ ]]; then
    echo "🗑️  Deleting existing cluster..."
    kind delete cluster --name "${CLUSTER_NAME}"
    echo "🏗️  Creating fresh 3-node cluster from ${KIND_CONFIG}..."
    kind create cluster --config "${KIND_CONFIG}"
  else
    echo "   Using existing cluster."
    kubectl cluster-info --context "kind-${CLUSTER_NAME}"
  fi
else
  echo "🏗️  Creating 3-node cluster from ${KIND_CONFIG}..."
  kind create cluster --config "${KIND_CONFIG}"
fi

echo ""
echo "📋 Cluster Nodes:"
kubectl get nodes -o wide --show-labels

# ── 3. Install NGINX Ingress Controller for KIND ─────────────────────────────
echo ""
echo "🌐 Installing NGINX Ingress Controller..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "⏳ Waiting for Ingress Controller to be ready (up to 90s)..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s || echo "⚠️  Ingress pod still starting in background."

# ── 4. Install ArgoCD ────────────────────────────────────────────────────────
echo ""
echo "🐙 Installing ArgoCD GitOps Controller..."
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Patch ArgoCD server to NodePort 30080 for easy browser access from Windows
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort", "ports": [{"port": 80, "targetPort": 8080, "nodePort": 30080}]}}' || true

echo "⏳ Waiting for ArgoCD Server deployment to be available (up to 120s)..."
kubectl rollout status deployment/argocd-server -n argocd --timeout=120s || echo "⚠️  ArgoCD server still initializing."

# ── 5. Retrieve Initial ArgoCD Admin Password ────────────────────────────────
echo ""
echo "🔑 Retrieving initial ArgoCD admin password..."
ARGOCD_PW=""
for i in {1..12}; do
  ARGOCD_PW=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" 2>/dev/null | base64 -d || true)
  if [[ -n "${ARGOCD_PW}" ]]; then break; fi
  sleep 5
done

# ── 6. Apply ArgoCD Application ──────────────────────────────────────────────
if [[ -f "${ARGOCD_APP}" ]]; then
  echo ""
  echo "📦 Applying CrewRescue ArgoCD Application manifest..."
  kubectl apply -f "${ARGOCD_APP}"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "🎉 Multi-Node Kubernetes & ArgoCD Installation Complete!"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "📊 Cluster Nodes Overview:"
kubectl get nodes -L workload,node-role.kubernetes.io/worker
echo ""
echo "🔗 Access URLs:"
echo "   • ArgoCD Web UI:      http://localhost:30080"
echo "     Username:           admin"
echo "     Password:           ${ARGOCD_PW:-<retrieving... run: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d>}"
echo ""
echo "   • Application Ingress: http://localhost:8088"
echo "   • HTTPS Ingress:       https://localhost:8443"
echo ""
echo "🛠️  Helpful Verification Commands:"
echo "   kubectl get nodes -o wide"
echo "   kubectl get pods -A -o wide"
echo "   kubectl get applications -n argocd"
echo "   kubectl get pods -n crewrescue -o wide   # Shows pod-to-node placement"
echo "════════════════════════════════════════════════════════════════════"
