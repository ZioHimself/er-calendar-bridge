# Docker pilot runbook (v1.0)

Operator guide for running the ER Calendar Bridge on an **encrypted laptop** with Docker Compose: one container per synced member, GHCR image pull, file-based secrets, and bind-mounted SQLite state.

**Requirements:** SYNC-17, OPS-01, OPS-02, SEC-03  
**Related:** [Offboarding](./offboarding.md) (SYNC-18), [Operator secrets layout](../../secrets/operator/README.md)

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Docker Compose V2 | `docker compose version` |
| Full-disk encryption | Host treated as sensitive-tier infrastructure |
| GitHub GHCR pull access | Public package `ghcr.io/europeanresolve/er-calendar-bridge` (no auth for anonymous pull when package is public) |
| mailbox.org + Google pilot accounts | CalDAV app password; Google OAuth client (calendar scope only) |

Do **not** bake credentials into the image or commit secret files. Use gitignored paths under `secrets/<member>/` only.

---

## Onboarding (single operator member)

### 1. Clone and configure non-secrets

```bash
cp .env.example .env
```

Edit `.env`:

- Set **`IMAGE=ghcr.io/europeanresolve/er-calendar-bridge:0.1.1`** (stable semver tag from CI; bump when you intentionally upgrade).
- Fill mailbox.org URLs, `MAILBOX_USERNAME`, `GOOGLE_CALENDAR_ID`, optional SMTP / notify settings.
- Tune **`SYNC_INTERVAL_SECONDS`** (default `300`) for watch polling (D-13).

Secrets (`MAILBOX_APP_PASSWORD`, Google client id/secret, refresh token) are **not** set in `.env` for Compose pilot — they come from secret files (D-01, D-02).

### 2. Create secret files

Create one file per credential under `secrets/operator/` (see [secrets/operator/README.md](../../secrets/operator/README.md)):

| File | Purpose |
|------|---------|
| `mailbox_app_password` | mailbox.org app-specific password |
| `google_client_id` | OAuth client ID |
| `google_client_secret` | OAuth client secret |
| `google_refresh_token` | Offline refresh token (calendar scope) |

Each file contains a single value; trailing newlines are trimmed at runtime.

Optional withhold email: add `smtp_password` and use `compose.notify.yaml` when `NOTIFY_OWNER_EMAIL` is set.

### 3. Persistent data directory

```bash
mkdir -p data/operator
```

SQLite and sync state live on the host at `./data/operator` → container `DATA_DIR=/data` (bind mount, D-10).

### 4. Pull image and start stack

```bash
docker compose pull
docker compose up -d
```

Default container command is **`sync --watch`** (D-13). No `ports:` are published — outbound-only CalDAV, Google, and SMTP (D-11).

Verify logs (structured JSON on stdout, D-15):

```bash
docker logs -f bridge-operator
```

---

## Runtime operations

| Topic | Guidance |
|-------|----------|
| Sync mode | Continuous watch; interval from `SYNC_INTERVAL_SECONDS` in `.env` |
| One-shot sync | Override command temporarily: `docker compose run --rm bridge-operator node dist/index.js sync` |
| Restart policy | `unless-stopped` (D-14) |
| Withhold audit | On host or via exec: `docker compose exec bridge-operator node dist/index.js audit list` — same CLI as Phase 4 (OPS-03). Filter: `audit list --since 2026-01-01T00:00:00.000Z` |
| Upgrade image | Update `IMAGE` in `.env`, `docker compose pull`, `docker compose up -d` |

---

## Google OAuth and host re-auth (D-05–D-09, SEC-03)

v1.0 uses a **personal Google account** refresh token in `secrets/operator/google_refresh_token` (D-05, D-06). Scopes remain **calendar-only** (unchanged from Phase 3, D-08). Regular sync keeps the refresh token active; Google may still invalidate it (revocation, password change, idle policy).

### When to re-authenticate

- Container logs show Google auth / `invalid_grant` errors
- You revoked the app under Google account **Third-party access**
- You rotated OAuth client secret (update `google_client_secret` too)

### Procedure (host, outside container — D-07)

1. **Obtain a new offline refresh token** using your OAuth client with calendar scope and `access_type=offline` (and usually `prompt=consent` on first consent). Use your organisation’s approved OAuth flow (e.g. Google Cloud OAuth client + one-off consent in the browser). The bridge does not run a browser inside the container in v1.0.
2. **Write the token to the secret file** (never commit):

   ```bash
   printf '%s' "$NEW_REFRESH_TOKEN" > secrets/operator/google_refresh_token
   ```

3. **Restart the service** so Compose remounts secrets:

   ```bash
   docker compose restart bridge-operator
   ```

4. **Revocation hygiene:** After offboarding or compromise, remove third-party access in [Google Account → Security → Third-party access](https://myaccount.google.com/permissions) and revoke the mailbox.org app password separately.

### Offline consent notes (D-09)

- Store only the **refresh token** in the secret file; access tokens are fetched at runtime.
- If sync runs regularly, refresh tokens typically remain valid; re-auth is expected occasionally.
- Do not log or paste refresh tokens into tickets or chat.

---

## Host migration (D-21, D-22, OPS-02)

Moving the pilot to another machine is a **deployment change**, not an application rewrite (D-20: no hardcoded host paths in `src/` — config via env, secret mounts, and `DATA_DIR` only).

1. On the **old host**, stop the stack: `docker compose down` (see [offboarding](./offboarding.md) for optional DB backup).
2. Copy to the **new host**:
   - `./data/<member>/` (e.g. `data/operator/`) — SQLite UID map and audit tables
   - `./secrets/<member>/` — all secret files including `google_refresh_token` (D-22: copy token; re-auth optional if still valid)
   - `compose.yaml`, `.env` (non-secrets), and repo checkout for runbooks
3. On the **new host**, install Docker, restore paths, set `.env` (including `IMAGE`), then:

   ```bash
   docker compose pull
   docker compose up -d
   ```

Server-era deployments use the same pattern; **Vault / OpenBao** for secrets is a documented follow-up, not Phase 5 scope (D-23). v1.0 remains file-based secrets on an encrypted host.

---

## Multiple members (D-04)

Duplicate the `bridge-operator` service block in `compose.yaml` with:

- Unique service name (e.g. `bridge-member2`)
- `./data/<member>` volume and `./secrets/<member>/` secret file paths
- Separate `.env` or env overrides for calendar URLs and usernames

Copy `secrets/operator/` as a template to `secrets/<member>/`.

---

## Operator UAT checklist (manual)

Use this before declaring the v1.0 pilot healthy:

- [ ] Encrypted disk enabled on laptop
- [ ] `docker compose up -d` succeeds; container stays running
- [ ] `docker logs` shows JSON sync cycles without auth errors
- [ ] Google Calendar receives expected busy/full blocks for tagged test events
- [ ] Withheld events appear in `audit list` (and notify email if configured)
- [ ] Restart container: UID map persists (events update, not duplicate)
- [ ] Documented re-auth path understood (secret file + restart)

---

## References

- `.env.example` — non-secret variables and `IMAGE`
- `compose.yaml` — secrets and bind mounts
- README — development CLI and classification tags
