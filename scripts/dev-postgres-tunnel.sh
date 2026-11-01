#!/usr/bin/env bash

set -euo pipefail

LOCAL_PORT="${LOCAL_POSTGRES_TUNNEL_PORT:-15432}"
LOCAL_BIND_ADDRESS="${LOCAL_POSTGRES_TUNNEL_BIND_ADDRESS:-172.17.0.1}"
REMOTE_HOST="bxui9zxeulehv0d9ekmpnhbo"
REMOTE_PORT="5432"

REMOTE_IP="$(ssh -o BatchMode=yes -o ConnectTimeout=10 contabo \
  "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' '${REMOTE_HOST}'")"

if [[ -z "${REMOTE_IP}" ]]; then
  echo "Could not resolve ${REMOTE_HOST} on contabo" >&2
  exit 1
fi

if ss -ltn "sport = :${LOCAL_PORT}" | grep -q LISTEN; then
  echo "PostgreSQL dev tunnel already listening on ${LOCAL_BIND_ADDRESS}:${LOCAL_PORT}"
  exit 0
fi

exec ssh -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=60 \
  -o ServerAliveCountMax=3 \
  -N \
  -L "${LOCAL_BIND_ADDRESS}:${LOCAL_PORT}:${REMOTE_IP}:${REMOTE_PORT}" \
  contabo
