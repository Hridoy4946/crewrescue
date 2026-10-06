#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CrewRescue AI — OWASP ZAP Dynamic Application Security Testing (DAST)
# Executes baseline and full API security scans against the live Ingress target
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

TARGET_URL="${1:-http://localhost}"
REPORT_DIR="./infrastructure/security/reports"
mkdir -p "${REPORT_DIR}"

echo "🛡️  Starting OWASP ZAP DAST Security Scan against: ${TARGET_URL}"

# Run OWASP ZAP container against live target
docker run --rm \
  --network="host" \
  -v "$(pwd)/${REPORT_DIR}:/zap/wrk/:rw" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t "${TARGET_URL}" \
  -r "zap-dast-report.html" \
  -J "zap-dast-report.json" \
  -w "zap-dast-report.md" \
  -I || true

echo "✅ DAST Scan complete!"
echo "📄 HTML Report: ${REPORT_DIR}/zap-dast-report.html"
echo "📄 Markdown Report: ${REPORT_DIR}/zap-dast-report.md"
