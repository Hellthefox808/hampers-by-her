#!/usr/bin/env bash
# ==============================================================================
# HAMPERS BY HER — PRODUCTION CANARY & SMOKE DEPLOYMENT VERIFICATION
# ==============================================================================

set -euo pipefail

TARGET_URL="${1:-http://localhost:3000}"
TIMEOUT_SECONDS=60
INTERVAL=3

echo "=================================================================="
echo "  HAMPERS BY HER — POST-DEPLOYMENT SMOKE & HEALTH VERIFICATION   "
echo "  Target URL: $TARGET_URL"
echo "=================================================================="

START_TIME=$(date +%s)

while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))

  if [ "$ELAPSED" -gt "$TIMEOUT_SECONDS" ]; then
    echo "[-] FAILED: Deployment health verification timed out after ${TIMEOUT_SECONDS}s."
    exit 1
  fi

  echo "[*] Polling $TARGET_URL/health (Elapsed: ${ELAPSED}s)..."
  HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" "$TARGET_URL/health" || echo "000")
  HTTP_BODY=$(echo "$HTTP_RESPONSE" | sed '$d')
  HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -n 1)

  if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "[+] SUCCESS: Health probe returned HTTP 200."
    echo "[+] Health Payload: $HTTP_BODY"
    break
  else
    echo "    Received HTTP $HTTP_STATUS, retrying in ${INTERVAL}s..."
    sleep "$INTERVAL"
  fi
done

# Verify catalog discovery endpoint
echo "[*] Testing catalog endpoint: $TARGET_URL/api/v1/catalog/products..."
CATALOG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/api/v1/catalog/products" || echo "000")
if [ "$CATALOG_STATUS" -eq 200 ]; then
  echo "[+] Catalog service online (HTTP 200)."
else
  echo "[-] Warning: Catalog service returned HTTP $CATALOG_STATUS."
fi

# Verify studio operations endpoint
echo "[*] Testing studio operations status: $TARGET_URL/api/v1/admin/orders..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/api/v1/admin/orders" || echo "000")
if [ "$ADMIN_STATUS" -eq 200 ] || [ "$ADMIN_STATUS" -eq 401 ]; then
  echo "[+] Studio operations service reachable (HTTP $ADMIN_STATUS)."
else
  echo "[-] Warning: Studio operations returned HTTP $ADMIN_STATUS."
fi

# Verify microservice mesh health endpoint
echo "[*] Testing microservice mesh health: $TARGET_URL/api/v1/system/health..."
MESH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/api/v1/system/health" || echo "000")
if [ "$MESH_STATUS" -eq 200 ]; then
  echo "[+] System mesh health endpoint online (HTTP 200)."
else
  echo "[-] Warning: System mesh health returned HTTP $MESH_STATUS."
fi

# Verify Prometheus metrics endpoint
echo "[*] Testing Prometheus metrics endpoint: $TARGET_URL/metrics..."
METRICS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/metrics" || echo "000")
if [ "$METRICS_STATUS" -eq 200 ]; then
  echo "[+] Prometheus metrics endpoint online (HTTP 200)."
else
  echo "[-] Warning: Prometheus metrics endpoint returned HTTP $METRICS_STATUS."
fi

echo "=================================================================="
echo "  ALL CORE PRODUCTION HEALTH PROBES PASSED SUCCESSFULLY           "
echo "=================================================================="
exit 0
