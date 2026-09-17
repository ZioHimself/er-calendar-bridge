#!/usr/bin/env bash
# Scaffold gitignored operator secret files for Docker Compose (secrets/operator/).
# Does not print or store real credentials — you edit files locally after this runs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${ROOT}/secrets/operator"
PLACEHOLDER='ci-placeholder'

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
  elif grep -qxF "$PLACEHOLDER" "$path" 2>/dev/null; then
    : >"$path"
    echo "Cleared CI placeholder in ${path} — add your real value"
  fi
  chmod 600 "$path"
done

optional="${DIR}/smtp_password"
if [[ ! -f "$optional" ]]; then
  echo "Optional: create ${optional} when using compose.notify.yaml + NOTIFY_OWNER_EMAIL"
fi

echo ""
echo "Edit each file (single line, no quotes, no trailing spaces):"
echo "  secrets/operator/mailbox_app_password   — mailbox.org app-specific password"
echo "  secrets/operator/google_client_id       — Google Cloud OAuth client ID"
echo "  secrets/operator/google_client_secret   — Google Cloud OAuth client secret"
echo "  secrets/operator/google_refresh_token   — offline refresh token (calendar scope)"
echo ""
echo "See secrets/operator/README.md and docs/runbooks/docker-pilot.md"
echo "Verify (no secret values printed):"
echo "  test -s secrets/operator/mailbox_app_password && test -s secrets/operator/google_refresh_token"
