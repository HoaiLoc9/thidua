#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env.prod ]; then
  echo "[ERROR] Missing .env.prod. Copy from .env.prod.example and update values."
  exit 1
fi

echo "[1/4] Pulling latest images and building..."
docker compose --env-file .env.prod pull || true
docker compose --env-file .env.prod build --pull

echo "[2/4] Starting core services..."
docker compose --env-file .env.prod up -d db clamav

echo "[3/4] Running database migrations..."
docker compose --env-file .env.prod run --rm backend npx prisma migrate deploy

echo "[4/4] Starting full stack..."
docker compose --env-file .env.prod up -d

echo "Done. Check status with: docker compose ps"
