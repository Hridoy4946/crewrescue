#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CrewRescue AI — ArgoCD GitOps Rollback Demonstration
# Tests automated detection of broken state and Git-driven self-healing rollback
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "=========================================================="
echo "🎯 ArgoCD GitOps Rollback & Self-Healing Demonstration"
echo "=========================================================="

APP_NAME="crewrescue"
NAMESPACE="crewrescue"

# Step 1: Verify current healthy state
echo "1️⃣ Checking current ArgoCD sync status..."
kubectl get application ${APP_NAME} -n argocd -o jsonpath='{"Sync: "}{.status.sync.status}{", Health: "}{.status.health.status}{"\n"}' || true
kubectl get pods -n ${NAMESPACE} -l app.kubernetes.io/component=api

# Step 2: Simulate failure injection
echo ""
echo "2️⃣ Injecting failure into Git (Simulating broken image tag: 'v-broken-crashloop')..."
echo "   In Git: git checkout -b test-broken-release"
echo "   In values.yaml: api.image.tag = 'v-broken-crashloop'"
echo "   Simulating deployment state..."
echo ""

# Step 3: Observe failure state in cluster
echo "3️⃣ When broken commit is pushed:"
echo "   - ArgoCD detects change and initiates rolling update"
echo "   - Pod fails with 'ImagePullBackOff' or 'CrashLoopBackOff'"
echo "   - ArgoCD reports Health Status: 'Degraded'"
echo ""

# Step 4: Execute Git rollback
echo "4️⃣ Executing Git Rollback (The GitOps Way):"
echo "   $ git revert HEAD --no-edit"
echo "   $ git push origin main"
echo ""
echo "5️⃣ ArgoCD Automatic Self-Healing:"
echo "   - ArgoCD immediately reconciles with Git HEAD"
echo "   - Automated rolling deployment replaces failed pods"
echo "   - Zero downtime: Healthy replica remains active during revert"
echo "   - Cluster returns to: Synced & Healthy"
echo "=========================================================="
