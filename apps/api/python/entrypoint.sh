#!/bin/bash
set -e

echo "[entrypoint] Starting Pi gateway..."

# Parent process provisions the SQLite DB before spawn; ensure data dir exists.
mkdir -p /app/data

echo "[entrypoint] Starting gateway server..."
exec npx tsx /app/server.ts
