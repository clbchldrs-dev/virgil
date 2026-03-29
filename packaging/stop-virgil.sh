#!/usr/bin/env bash
# Stop Virgil Docker Compose stack (from repo root).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "Virgil: docker compose down"
docker compose down
