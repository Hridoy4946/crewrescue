# 🦅 CrewRescue AI — System Operations Guide

> Emergency Field Operations Platform · DhakaPower Utilities Network

---

## 🚀 1. Starting the System (After Windows Restart)

### ✅ The One Command — Do This Every Time

Open **PowerShell** (does NOT need to be admin) and run:

```powershell
wsl -u root -- bash /mnt/f/i_p/crewrescue/infrastructure/scripts/start-system.sh
```

Wait about **60–90 seconds** for pods to be ready. You will see:

```
╔══════════════════════════════════════════════════════╗
║           🚀 System Online!                         ║
╠══════════════════════════════════════════════════════╣
║  Web Console:    http://localhost:5173              ║
║  Technician PWA: http://localhost:5174              ║
║  API Health:     http://localhost:5000/health       ║
╚══════════════════════════════════════════════════════╝
```

### 🌐 Access Points

| Panel | URL | Who Uses It |
|-------|-----|-------------|
| **Web Dashboard** | http://localhost:5173 | Admin, Dispatcher, Supervisor, Executive |
| **Technician PWA** | http://localhost:5174 | Field Workers & Technicians |
| **API Health** | http://localhost:5000/health | Monitoring |

---

## 🔐 2. Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@dhakapower.bd` | `Admin@CrewRescue2025` |
| **Dispatcher** | `dispatcher@dhakapower.bd` | `Dispatch@2025` |
| **Emergency Mgr** | `emergency@dhakapower.bd` | `Emergency@2025` |
| **Supervisor** | `supervisor@dhakapower.bd` | `Supervisor@2025` |
| **Executive** | `executive@dhakapower.bd` | `Executive@2025` |
| **Technician 1** | `tech1@dhakapower.bd` | `Tech@2025` |
| **Technician 2** | `tech2@dhakapower.bd` | `Tech@2025` |

---

## 🔧 3. Port-Forward Troubleshooting

### Problem: Site shows "Unable to connect"

The port-forward process likely died (this happens after a pod restart or WSL network reset).

**Fix — Re-run the startup script:**
```powershell
wsl -u root -- bash /mnt/f/i_p/crewrescue/infrastructure/scripts/start-system.sh
```

**Or manually restart just the port-forwards:**
```powershell
# Web Dashboard (5173)
wsl -u root -- bash -c "pkill -f 'kubectl port-forward' || true; nohup sudo k3s kubectl port-forward --address 0.0.0.0 svc/crewrescue-web 5173:80 -n crewrescue > /tmp/pf-web.log 2>&1 &"

# Technician PWA (5174)
wsl -u root -- bash -c "nohup sudo k3s kubectl port-forward --address 0.0.0.0 svc/crewrescue-pwa 5174:80 -n crewrescue > /tmp/pf-pwa.log 2>&1 &"

# API (5000)
wsl -u root -- bash -c "nohup sudo k3s kubectl port-forward --address 0.0.0.0 svc/crewrescue-api 5000:5000 -n crewrescue > /tmp/pf-api.log 2>&1 &"
```

> **Why does this happen?** WSL2 uses a virtual network adapter. When Windows or a pod restarts, the port-forward process needs to be re-established. The `--address 0.0.0.0` flag is critical — without it, the forward only listens inside WSL and Windows can't reach it.

---

## 🛑 4. Stopping the System

### Graceful Pause (keeps all data)
```powershell
wsl --shutdown
```
When you restart WSL, run the startup script again — all your data (MongoDB, Redis) is preserved.

### Full Wipe (destroys all data ⚠️)
```powershell
wsl -u root -- bash -c "k3s kubectl delete namespace crewrescue"
```

---

## 📊 5. Live Monitoring

### Check Pod Status
```powershell
wsl -u root -- bash -c "k3s kubectl get pods -n crewrescue"
```
All pods should show `Running` and `1/1`.

### Stream Logs
```powershell
# API logs
wsl -u root -- bash -c "k3s kubectl logs -n crewrescue deploy/crewrescue-api -f"

# Worker/AI logs
wsl -u root -- bash -c "k3s kubectl logs -n crewrescue deploy/crewrescue-worker -f"

# Web frontend logs
wsl -u root -- bash -c "k3s kubectl logs -n crewrescue deploy/crewrescue-web -f"
```

### Check port-forward logs
```powershell
wsl -u root -- bash -c "cat /tmp/pf-web.log; cat /tmp/pf-api.log"
```

---

## 🔁 6. After Code Changes (Rebuild)

If you edit source files (`frontend/web/src/` or `backend/api/src/`):

```powershell
# Rebuild Web Dashboard
wsl -u root -- bash -c "cd /mnt/f/i_p/crewrescue && docker build -t crewrescue-web:latest -f infrastructure/docker/web.Dockerfile . && k3s ctr images import <(docker save crewrescue-web:latest) && k3s kubectl rollout restart deployment/crewrescue-web -n crewrescue"

# Rebuild API
wsl -u root -- bash -c "cd /mnt/f/i_p/crewrescue && docker build -t crewrescue-api:latest -f infrastructure/docker/api.Dockerfile . && k3s ctr images import <(docker save crewrescue-api:latest) && k3s kubectl rollout restart deployment/crewrescue-api -n crewrescue"

# Rebuild Technician PWA
wsl -u root -- bash -c "cd /mnt/f/i_p/crewrescue && docker build -t crewrescue-pwa:latest -f infrastructure/docker/pwa.Dockerfile . && k3s ctr images import <(docker save crewrescue-pwa:latest) && k3s kubectl rollout restart deployment/crewrescue-pwa -n crewrescue"
```

> After rebuilding, re-run the port-forward step since pods restart.

---

## 🚑 7. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Unable to connect` on 5173/5174 | Port-forward died | Re-run startup script |
| `Route not found` on localhost:5000 | API is up but no route at `/` — this is normal | Visit `/health` to verify |
| Pod in `CrashLoopBackOff` | Config error or DB connection failure | `k3s kubectl logs -n crewrescue deploy/crewrescue-api --previous` |
| Data stale / no technicians | Test data needs refresh | `wsl -u root -- bash -c "k3s kubectl exec -n crewrescue deploy/crewrescue-api -- node src/scripts/fixDatabaseState.mjs"` |
| Toast notifications not disappearing | Hard refresh browser | `Ctrl+Shift+R` on the page |

---

## 🗄️ 8. Database Access

### MongoDB
```powershell
wsl -u root -- bash -c "k3s kubectl exec -it -n crewrescue crewrescue-mongo-0 -- mongosh crewrescue"
```

### Redis
```powershell
wsl -u root -- bash -c "k3s kubectl exec -it -n crewrescue deploy/crewrescue-redis -- redis-cli"
```
*(Type `FLUSHALL` to clear queues if needed)*

---

## 🦅 9. About This System

**CrewRescue AI** is an emergency field workforce re-optimization platform for DhakaPower Utilities Network.

| Component | Technology |
|-----------|-----------|
| Backend API | Node.js + Express + MongoDB + Redis/BullMQ |
| AI/Optimization | Gemini AI + Simulated Annealing + Genetic Algorithm |
| Web Dashboard | React + Vite + Leaflet Maps |
| Technician PWA | React + Vite + PWA (installable) |
| Infrastructure | k3s (Kubernetes in WSL2) + Docker |
| Icon | 🦅 Falcon — speed, precision, tactical response |
