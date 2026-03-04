#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/var/www/volm_krikstynoms}"
WEB_DIR="$ROOT_DIR/web"
API_BIN="$ROOT_DIR/go-ecommerce-api"
SKIP_API_RESTART="${SKIP_API_RESTART:-0}"

echo "[1/7] Go to project root: $ROOT_DIR"
cd "$ROOT_DIR"

echo "[2/7] Reset tracked API binary before pull"
git restore go-ecommerce-api || true

echo "[3/7] Pull latest changes"
git pull --ff-only

echo "[4/7] Ensure API binary executable"
chmod +x "$API_BIN"

echo "[5/7] Build web"
cd "$WEB_DIR"
npm run build

echo "[6/7] Restart web"
sudo systemctl restart volm-web

if [[ "$SKIP_API_RESTART" != "1" ]]; then
  echo "[7/7] Restart API"
  sudo systemctl restart volm-api
else
  echo "[7/7] Skip API restart (SKIP_API_RESTART=1)"
fi

echo "Done."
