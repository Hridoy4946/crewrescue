# 🛠️ CrewRescue AI — System Operations & Maintenance Guide

This document provides a comprehensive guide to starting, stopping, maintaining, and troubleshooting the CrewRescue AI Emergency Operations platform running on k3s within Windows Subsystem for Linux (WSL).

---

## 1. 🚀 Starting the System

### Standard Startup
If the host machine (Windows) has been restarted, follow these steps to bring the system online:

1. **Open PowerShell as Administrator**.
2. **Start WSL and launch k3s**:
   ```powershell
   wsl -u root -- bash -c "cd /mnt/f/i_p/crewrescue && bash infrastructure/scripts/setup-k3s-wsl.sh"
   ```
3. **Wait for Pods to Initialize** (approx 2-3 minutes). You can check status with:
   ```powershell
   wsl -u root -- bash -c "k3s kubectl get pods -n crewrescue"
   ```
   *All pods should display `STATUS: Running` and `READY: 1/1`.*
4. **Access the Application**:
   - **Main Web Dashboard:** `http://localhost:5000`
   - **Mobile PWA:** `http://localhost:5001`
   - **Admin Login:** `admin@dhakapower.bd` / `Admin@CrewRescue2025`

---

## 2. 🛑 Stopping the System

### Graceful Shutdown (Recommended)
To pause the system while preserving all data (databases, queues, state):
```powershell
wsl --shutdown
```
*Note: When you restart WSL or run the startup script again, k3s will resume exactly where it left off.*

### Full Clean Teardown (Destructive)
To completely remove the deployment, including all databases and stored data, use this command:
```powershell
wsl -u root -- bash -c "k3s kubectl delete namespace crewrescue"
```
*Warning: This wipes MongoDB and Redis data.*

---

## 3. 🔧 Maintenance & Management

### Viewing Live Logs
To monitor what the backend or frontend is doing in real-time:

**API Logs:**
```powershell
wsl -u root -- bash -c "k3s kubectl logs -n crewrescue deploy/crewrescue-api -f"
```
**Web Logs:**
```powershell
wsl -u root -- bash -c "k3s kubectl logs -n crewrescue deploy/crewrescue-web -f"
```
**Worker Logs (Background Jobs/AI):**
```powershell
wsl -u root -- bash -c "k3s kubectl logs -n crewrescue deploy/crewrescue-worker -f"
```

### Rebuilding Images (After Code Changes)
If you modify the source code (e.g., in `frontend/web/` or `backend/api/`), the running Docker containers need to be updated. A helper script is available in your workspace:

1. Run the full rebuild script:
   ```powershell
   wsl -u root -e bash /mnt/c/Users/hrido/.gemini/antigravity-ide/brain/535ca1f5-28b2-48cd-98a0-becd0a80c32f/scratch/full_rebuild.sh
   ```
2. This script automatically:
   - Builds new Docker images for the API and Web components.
   - Imports the new images into the local k3s registry.
   - Performs a rolling restart of the deployments so the new code takes effect.

### Manual Pod Restart
If a service is stuck or behaving unexpectedly, you can force a restart without rebuilding the image:
```powershell
# Restart API
wsl -u root -- bash -c "k3s kubectl rollout restart deploy/crewrescue-api -n crewrescue"

# Restart Web
wsl -u root -- bash -c "k3s kubectl rollout restart deploy/crewrescue-web -n crewrescue"
```

---

## 4. 🚑 Troubleshooting

### Issue: The Web Interface (`localhost:5000`) is not loading.
**Cause:** The port-forwarding process (`socat`) might have died or Windows networking reset.
**Fix:** Restart the port forwarding.
```powershell
wsl -u root -- bash -c "pkill socat; sleep 1; WEB_IP=\$(k3s kubectl get svc crewrescue-web -n crewrescue -o jsonpath='{.spec.clusterIP}'); nohup socat TCP-LISTEN:5000,fork,reuseaddr TCP:\${WEB_IP}:80 &>/tmp/socat-web.log &"
```

### Issue: Pods are stuck in `CrashLoopBackOff` or `Error` state.
**Cause:** Usually a configuration error, missing environment variable, or database connection failure.
**Fix:** Check the logs of the failing pod to identify the error:
```powershell
wsl -u root -- bash -c "k3s kubectl logs -n crewrescue deploy/crewrescue-api --previous"
```

### Issue: Data seems stale or missing (e.g., no technicians available).
**Cause:** Test data might need refreshing.
**Fix:** Run the database fix script directly inside the API pod:
```powershell
wsl -u root -- bash -c "k3s kubectl exec -n crewrescue deploy/crewrescue-api -- node src/scripts/fixDatabaseState.mjs"
```

### Issue: AI Assistant responses are slow or failing.
**Cause:** The system might be failing to reach external APIs and is falling back to the local heuristic engine, or the Redis queue (BullMQ) is backlogged.
**Fix:** 
1. Check worker logs: `wsl -u root -- bash -c "k3s kubectl logs -n crewrescue deploy/crewrescue-worker"`
2. Restart the worker: `wsl -u root -- bash -c "k3s kubectl rollout restart deploy/crewrescue-worker -n crewrescue"`

---

## 5. 🗄️ Database Access

### MongoDB Access
To interact directly with the database:
```powershell
wsl -u root -- bash -c "k3s kubectl exec -it -n crewrescue crewrescue-mongo-0 -- mongosh crewrescue"
```

### Redis Access
To flush queues or clear cache:
```powershell
wsl -u root -- bash -c "k3s kubectl exec -it -n crewrescue deploy/crewrescue-redis -- redis-cli"
```
*(Type `FLUSHALL` in the redis-cli prompt to clear everything if needed).*
