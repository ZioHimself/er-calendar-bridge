# Operator secrets (pilot)

Create **one file per credential** in this directory (short filenames on disk). Compose uses **`<member>_`**-prefixed secret names pointing at these files — see `secrets/serhiy/` + `compose.yaml` for the reference member layout. Copy from the matching `*.example` file (remove `.example`, add your value). Real credential files are **gitignored** — never commit them.

## Required for `docker compose up` (base `compose.yaml`)

| File | Env var (resolved at runtime) |
|------|-------------------------------|
| `mailbox_app_password` | `MAILBOX_APP_PASSWORD` |
| `google_client_id` | `GOOGLE_CLIENT_ID` |
| `google_client_secret` | `GOOGLE_CLIENT_SECRET` |
| `google_refresh_token` | `GOOGLE_REFRESH_TOKEN` |

Each file should contain a single secret value (no quotes; trailing newlines are trimmed).

## Optional — withhold email (`compose.notify.yaml`)

When `NOTIFY_OWNER_EMAIL` is set in `.env`, deploy with:

```bash
docker compose -f compose.yaml -f compose.notify.yaml up -d
```

Add:

| File | Env var |
|------|---------|
| `smtp_password` | `SMTP_PASSWORD` |

## Another member (D-01)

Copy this folder to `secrets/<member>/`, duplicate the `bridge-operator` service block in `compose.yaml` with paths under `secrets/<member>/` and `./data/<member>`, and use a separate `.env` or env overrides for calendar URLs and usernames.

## Google token refresh (D-07)

Re-authenticate on the host (CLI outside the container), then update `google_refresh_token` and restart the service.
