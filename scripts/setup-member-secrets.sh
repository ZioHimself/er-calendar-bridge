#!/usr/bin/env bash
# Create empty gitignored secret files for a Compose member (default: serhiy).
set -euo pipefail

MEMBER="${1:-serhiy}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${ROOT}/secrets/${MEMBER}"

required=(
  mailbox_app_password
  google_client_id
  google_client_secret
  google_refresh_token
)

mkdir -p "$DIR"

for name in "${required[@]}"; do
  path="${DIR}/${name}"
  if [[ ! -f "$path" ]]; then
    : >"$path"
    echo "Created empty ${path}"
  fi
  chmod 600 "$path"
done

echo "Optional: ${DIR}/smtp_password (withhold email overlay)"
echo "Service: bridge-${MEMBER}  |  data: ./data/${MEMBER}"
echo "See secrets/${MEMBER}/README.md"
