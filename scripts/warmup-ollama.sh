#!/usr/bin/env bash
# Warm-load the default local model in Ollama (keep_alive=-1). Run after the stack is up.
# Usage: ./scripts/warmup-ollama.sh
# Env: OLLAMA_BASE_URL (default http://127.0.0.1:11434), WARMUP_MODEL (optional)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://127.0.0.1:11434}"

exec pnpm exec tsx scripts/warmup-ollama-cli.ts "$@"
