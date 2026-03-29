#!/usr/bin/env bash
# Double-click launcher (macOS): starts Virgil via Docker Compose and opens the browser.
# Symlink or copy this file to the desktop, or run from the repo. Requires Docker Desktop + Ollama.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec bash packaging/launch-virgil.sh
