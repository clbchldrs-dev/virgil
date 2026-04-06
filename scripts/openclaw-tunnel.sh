#!/usr/bin/env bash
# Create a hardened local SSH tunnel for OpenClaw.
# Usage:
#   OPENCLAW_SSH_HOST=caleb@192.168.1.81 ./scripts/openclaw-tunnel.sh
#   OPENCLAW_SSH_HOST=user@lan-host ./scripts/openclaw-tunnel.sh
# Optional env:
#   OPENCLAW_LOCAL_PORT (default 13100)
#   OPENCLAW_REMOTE_PORT (default 3100)
#   OPENCLAW_REMOTE_HOST (default 127.0.0.1)
#   OPENCLAW_ALLOW_NON_LOOPBACK_REMOTE=1 (unsafe override)

set -euo pipefail

if [[ -z "${OPENCLAW_SSH_HOST:-}" ]]; then
  echo "Missing OPENCLAW_SSH_HOST (example: caleb@192.168.1.81)." >&2
  exit 1
fi

OPENCLAW_LOCAL_PORT="${OPENCLAW_LOCAL_PORT:-13100}"
OPENCLAW_REMOTE_PORT="${OPENCLAW_REMOTE_PORT:-3100}"
OPENCLAW_REMOTE_HOST="${OPENCLAW_REMOTE_HOST:-127.0.0.1}"
OPENCLAW_ALLOW_NON_LOOPBACK_REMOTE="${OPENCLAW_ALLOW_NON_LOOPBACK_REMOTE:-0}"

if ! [[ "${OPENCLAW_LOCAL_PORT}" =~ ^[0-9]+$ ]] || (( OPENCLAW_LOCAL_PORT < 1 || OPENCLAW_LOCAL_PORT > 65535 )); then
  echo "Invalid OPENCLAW_LOCAL_PORT: ${OPENCLAW_LOCAL_PORT} (expected 1-65535)." >&2
  exit 1
fi

if ! [[ "${OPENCLAW_REMOTE_PORT}" =~ ^[0-9]+$ ]] || (( OPENCLAW_REMOTE_PORT < 1 || OPENCLAW_REMOTE_PORT > 65535 )); then
  echo "Invalid OPENCLAW_REMOTE_PORT: ${OPENCLAW_REMOTE_PORT} (expected 1-65535)." >&2
  exit 1
fi

if [[ "${OPENCLAW_REMOTE_HOST}" != "127.0.0.1" && "${OPENCLAW_REMOTE_HOST}" != "localhost" ]]; then
  if [[ "${OPENCLAW_ALLOW_NON_LOOPBACK_REMOTE}" != "1" ]]; then
    echo "Refusing non-loopback OPENCLAW_REMOTE_HOST=${OPENCLAW_REMOTE_HOST}." >&2
    echo "Set OPENCLAW_ALLOW_NON_LOOPBACK_REMOTE=1 to override (not recommended)." >&2
    exit 1
  fi
  echo "Warning: non-loopback OPENCLAW_REMOTE_HOST is enabled via OPENCLAW_ALLOW_NON_LOOPBACK_REMOTE=1." >&2
fi

echo "Opening SSH tunnel:"
echo "  local  127.0.0.1:${OPENCLAW_LOCAL_PORT}"
echo "  remote ${OPENCLAW_REMOTE_HOST}:${OPENCLAW_REMOTE_PORT} via ${OPENCLAW_SSH_HOST}"
echo
echo "Keep this process running while Virgil uses OpenClaw."

exec ssh \
  -N \
  -T \
  -L "127.0.0.1:${OPENCLAW_LOCAL_PORT}:${OPENCLAW_REMOTE_HOST}:${OPENCLAW_REMOTE_PORT}" \
  -o ClearAllForwardings=yes \
  -o ExitOnForwardFailure=yes \
  -o PasswordAuthentication=no \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o StrictHostKeyChecking=yes \
  -o IdentitiesOnly=yes \
  "${OPENCLAW_SSH_HOST}"
