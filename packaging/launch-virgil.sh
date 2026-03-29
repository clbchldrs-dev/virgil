#!/usr/bin/env bash
# Start Virgil via Docker Compose: bootstrap .env.docker, wait for HTTP, open browser.
# Prerequisites: Docker Desktop (or compatible engine) + Ollama on the host for local models.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

die() {
  echo "Virgil launcher: $*" >&2
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  die "Docker is not installed or not on PATH. Install Docker Desktop: https://docs.docker.com/desktop/"
fi

if ! docker compose version >/dev/null 2>&1; then
  die "Docker Compose v2 is required (use 'docker compose', not legacy 'docker-compose')."
fi

if [ ! -f ".env.docker" ]; then
  echo "Virgil launcher: creating .env.docker from .env.docker.example"
  cp .env.docker.example .env.docker
fi

# Ensure AUTH_SECRET is non-empty (required by docker/entrypoint.sh)
if ! grep -qE '^AUTH_SECRET=.' .env.docker; then
  echo "Virgil launcher: generating AUTH_SECRET in .env.docker"
  SECRET="$(openssl rand -base64 32 | tr -d '\n')"
  tmp="$(mktemp)"
  awk -v s="$SECRET" '
    BEGIN { replaced = 0 }
    /^AUTH_SECRET=/ { print "AUTH_SECRET=" s; replaced = 1; next }
    { print }
    END { if (!replaced) print "AUTH_SECRET=" s }
  ' .env.docker > "$tmp" && mv "$tmp" .env.docker
fi

BASE_URL="${VIRGIL_OPEN_URL:-}"
if [ -z "$BASE_URL" ]; then
  if [ -f ".env" ] && grep -qE '^NEXT_PUBLIC_APP_URL=' .env; then
    BASE_URL="$(grep -E '^NEXT_PUBLIC_APP_URL=' .env | head -1 | cut -d= -f2- | tr -d '\r')"
  elif grep -qE '^NEXT_PUBLIC_APP_URL=' .env.docker 2>/dev/null; then
    BASE_URL="$(grep -E '^NEXT_PUBLIC_APP_URL=' .env.docker | head -1 | cut -d= -f2- | tr -d '\r')"
  else
    BASE_URL="http://localhost:3000"
  fi
fi

if command -v pnpm >/dev/null 2>&1 && [ -f "scripts/virgil-preflight.ts" ]; then
  pnpm exec tsx scripts/virgil-preflight.ts --strict || die "Preflight failed (see messages above)."
fi

echo "Virgil launcher: starting stack (docker compose up --build -d)..."
docker compose up --build -d

echo "Virgil launcher: waiting for ${BASE_URL} ..."
ok=0
for _ in $(seq 1 90); do
  if curl -sf -o /dev/null --connect-timeout 2 "$BASE_URL" 2>/dev/null; then
    ok=1
    break
  fi
  sleep 2
done

if [ "$ok" != 1 ]; then
  echo "Virgil launcher: server did not become ready in time. Check: docker compose logs -f virgil-app" >&2
  exit 1
fi

echo "Virgil launcher: opening ${BASE_URL}"
if command -v open >/dev/null 2>&1; then
  open "$BASE_URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$BASE_URL"
else
  echo "Virgil launcher: open this URL in your browser: ${BASE_URL}"
fi

echo "Virgil launcher: running. To stop: ./packaging/stop-virgil.sh (or: docker compose down)"
