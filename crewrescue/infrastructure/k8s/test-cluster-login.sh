#!/usr/bin/env bash
kubectl exec deployment/crewrescue-api -n crewrescue -- node -e '
(async () => {
  const res = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@dhakapower.bd", password: "Admin@CrewRescue2025" })
  });
  const data = await res.json();
  console.log("K8s Cluster Login Result:", data.success ? "SUCCESS" : "FAILED", "Role:", data.user ? data.user.role : null);
})();
'
