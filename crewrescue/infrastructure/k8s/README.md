# 🚀 CrewRescue AI — Multi-Node Kubernetes & GitOps Infrastructure

This directory contains the production-grade **Multi-Node Kubernetes Topology**, **Helm Charts**, and **ArgoCD GitOps** specifications for CrewRescue AI.

---

## 1. Cluster Topology (3-Node Multi-Node Architecture)

The cluster is defined in [`kind-cluster.yaml`](kind-cluster.yaml) implementing strict workload separation across compute and edge zones:

```
                                  ┌─────────────────────────────┐
                                  │     crewrescue-cluster      │
                                  └──────────────┬──────────────┘
                                                 │
          ┌──────────────────────────────────────┼──────────────────────────────────────┐
          ▼                                      ▼                                      ▼
  ┌──────────────────────────────┐       ┌──────────────────────────────┐       ┌──────────────────────────────┐
  │        control-plane         │       │           worker-1           │       │           worker-2           │
  │     (Kubernetes Master)      │       │      (workload=frontend-api) │       │      (workload=compute-db)   │
  ├──────────────────────────────┤       ├──────────────────────────────┤       ├──────────────────────────────┤
  │ • kube-apiserver             │       │ • crewrescue-web (React)     │       │ • crewrescue-worker (BullMQ) │
  │ • etcd & kube-scheduler      │       │ • crewrescue-pwa (Field App) │       │ • SA/GA Metaheuristic Solver │
  │ • NGINX Ingress Controller   │       │ • crewrescue-api (Node.js)   │       │ • MongoDB 7 (StatefulSet)    │
  │ • ArgoCD Server (:30080)     │       │ • Socket.IO Gateway          │       │ • Redis 7 (In-Memory Cache)  │
  └──────────────────────────────┘       └──────────────────────────────┘       └──────────────────────────────┘
```

### Workload Separation Labels
* **`worker-1`**: Labeled `workload=frontend-api` and `node-role.kubernetes.io/worker=web-api` (Zone A).
* **`worker-2`**: Labeled `workload=compute-db` and `node-role.kubernetes.io/worker=compute` (Zone B).
* **Scheduling**: Pods use `nodeSelector: { workload: "..." }` and `affinity` in Helm templates to guarantee that heavy heuristic optimization algorithms (Simulated Annealing & Genetic Algorithm) never starve user-facing API or Web ingress threads.

---

## 2. ArgoCD GitOps Engine

ArgoCD is configured to continuously monitor the repository and automatically reconcile cluster state against the Helm charts.

* **Application Manifest**: [`gitops/argocd/application.yaml`](../../gitops/argocd/application.yaml)
* **AppProject**: [`gitops/argocd/project.yaml`](../../gitops/argocd/project.yaml)
* **Sync Policy**:
  * `automated.prune: true` (removes deleted manifests)
  * `automated.selfHeal: true` (reverts manual cluster drift)
  * `CreateNamespace=true` (provisions namespace `crewrescue`)

---

## 3. Automated Setup (1-Click)

### From Windows PowerShell:
```powershell
.\infrastructure\scripts\setup-cluster.ps1
```

### From WSL2 (Ubuntu):
```bash
bash /mnt/f/i_p/crewrescue/infrastructure/scripts/setup-cluster.sh
```

---

## 4. Verification & Access

| Component | URL | Credentials |
| :--- | :--- | :--- |
| **ArgoCD Web UI** | `http://localhost:30080` | `admin` / *(run command below)* |
| **Application Ingress** | `http://localhost:8088` | Control room web interface |
| **HTTPS Ingress** | `https://localhost:8443` | Secure traffic |

### Useful Verification Commands:
```bash
# 1. Inspect cluster nodes & labels
kubectl get nodes -L workload,node-role.kubernetes.io/worker

# 2. Verify workload placement across nodes
kubectl get pods -n crewrescue -o wide

# 3. Get ArgoCD Admin Password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# 4. Check ArgoCD sync status
kubectl get applications -n argocd
```
