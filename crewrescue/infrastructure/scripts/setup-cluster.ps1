# ─────────────────────────────────────────────────────────────────────────────
# CrewRescue AI — Windows PowerShell Launcher for Multi-Node KIND + ArgoCD
# Invokes the bash setup script inside WSL2
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n🚀 Launching CrewRescue Multi-Node Kubernetes & ArgoCD Setup in WSL2...`n" -ForegroundColor Cyan

# Check WSL
$wslCheck = wsl --status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "WSL2 is not properly configured or running. Please ensure WSL2 is enabled."
    exit 1
}

# Convert Windows path to WSL path
$scriptPath = "/mnt/f/i_p/crewrescue/infrastructure/scripts/setup-cluster.sh"

# Fix line endings if needed and execute
wsl -u root bash -c "sed -i 's/\r$//' $scriptPath && chmod +x $scriptPath && $scriptPath"
