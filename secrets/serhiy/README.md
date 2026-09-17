# serhiy — member secrets

Create **one file per credential** in this directory (short filenames, **no** `serhiy_` prefix on disk). Copy from the matching `*.example` file (remove `.example`, add your value). Real credential files are **gitignored** — never commit them.

Compose mounts them as **`serhiy_<file>`** secret names (see `compose.yaml`). The app maps `*_<base>` mount names to env vars via `COMPOSE_SECRET_TO_ENV` in `src/secrets/resolve-env.ts`.

Used by service **`bridge-serhiy`** and bind mount **`./data/serhiy`**.

## Required for `docker compose up` (base `compose.yaml`)

| File on disk | Compose secret name | Env var (runtime) |
|--------------|---------------------|-------------------|
| `mailbox_app_password` | `serhiy_mailbox_app_password` | `MAILBOX_APP_PASSWORD` |
| `google_client_id` | `serhiy_google_client_id` | `GOOGLE_CLIENT_ID` |
| `google_client_secret` | `serhiy_google_client_secret` | `GOOGLE_CLIENT_SECRET` |
| `google_refresh_token` | `serhiy_google_refresh_token` | `GOOGLE_REFRESH_TOKEN` |

Each file should contain a single secret value (no quotes; trailing newlines are trimmed).

## Optional — withhold email (`compose.notify.yaml`)

When `NOTIFY_OWNER_EMAIL` is set in `.env`, deploy with:

```bash
docker compose -f compose.yaml -f compose.notify.yaml up -d
```

Add:

| File on disk | Compose secret name | Env var |
|--------------|---------------------|---------|
| `smtp_password` | `serhiy_smtp_password` | `SMTP_PASSWORD` |

## Google token refresh (D-07)

Re-authenticate on the host (CLI outside the container), then update `google_refresh_token` and restart:

```bash
docker compose restart bridge-serhiy
```
