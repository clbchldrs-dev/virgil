#!/bin/sh
set -e
if [ -z "${AUTH_SECRET:-}" ] && [ -z "${NEXTAUTH_SECRET:-}" ]; then
  echo "AUTH_SECRET is required. Copy .env.docker.example to .env.docker and set AUTH_SECRET (see AGENTS.md)."
  exit 1
fi
cd /app
tsx lib/db/migrate.ts
exec node server.js
