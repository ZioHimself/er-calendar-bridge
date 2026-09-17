# ER Calendar Bridge

Read-only sync from mailbox.org (CalDAV) to Google Calendar (v1.0 pilot), with per-event classification and content washing before data crosses to third parties. Microsoft 365 support is planned for v1.1 after the Google pilot is validated.

**Scope:** one-way propagation for members who use Google/Outlook. CalDAV-native clients (Apple Calendar, Thunderbird, Morgen) connect to mailbox.org directly — no bridge needed.

## How it works

```
mailbox.org (CalDAV, read-only) → BRIDGE → Google Calendar API  (v1.0)
                                        → SMTP (withhold notifications)
                                        → Microsoft Graph         (v1.1)
```

mailbox.org stays the source of truth. The bridge never writes to it.

## Classification

Tag events in mailbox.org with iCalendar `CATEGORIES`:

| Tag | Propagation |
|-----|-------------|
| `ER-PUBLIC` | Full event content |
| `ER-INTERNAL` | Busy-block only ("Busy") |
| `ER-SENSITIVE` | Not propagated |
| *(untagged)* | Busy-block (default) |

**Restrict-only:** only `ER-PUBLIC` enables full disclosure. Untagged events are never published in full.

Busy-blocks retain start, end, stable ID, and generic label only — title, description, location, attendees, organiser, attachments, and tags are stripped.

## Deployment

Docker image from **public GHCR**, orchestrated with Docker Compose — one container per synced member, each with only that member's secrets. SQLite persists on the host via bind mount `./data/<member>` (not a named Docker volume).

| Phase | Host | Scope |
|-------|------|-------|
| Pilot (v1.0) | Operator laptop (encrypted) | Operator's calendar → Google only |
| v1.1 | Same or server | Add Microsoft Graph write path |
| Production | Organisation server | Active schedulers, then others |

**Operator runbooks:**

- [Docker pilot, migration, Google re-auth](docs/runbooks/docker-pilot.md) — `IMAGE=ghcr.io/europeanresolve/er-calendar-bridge:0.1.1`, `secrets/operator/*`, `docker compose up -d`
- [Offboarding (SYNC-18)](docs/runbooks/offboarding.md) — revoke credentials, `compose down`, optional `bridge.db` backup

Secrets: Compose file mounts under `secrets/<member>/` for v1.0 (gitignored). **Vault / OpenBao** is the target for server-era deployments (documented follow-up, D-23).

## Development

This project uses trunk-based development: push directly to `main`. Pull requests are not required for now, though CI also runs on `pull_request` targeting `main` when used.

GitHub Actions runs on every push to `main` and on pull requests targeting `main` with **five** jobs: `test`, `lint`, `typecheck`, `build`, and **`docker-build`**. The image job runs after the four npm jobs succeed; it builds on every workflow run and **pushes to public GHCR** only on pushes to `main` (semver tag from `package.json`, currently `0.1.1`).

If you enable **branch protection** on `main`, mark all five jobs — including **`docker-build`** — as required status checks so trunk commits cannot merge with a broken image (D-19). Direct pushes to `main` still rely on CI going green before you push.

Before pushing, run the local gate:

```bash
npm test && npm run lint && npm run typecheck && npm run build
# optional when changing Docker packaging:
docker build -t er-calendar-bridge:local .
```

CI uses Node.js 24 (see `engines.node` in `package.json`). Local Node 22 may show EBADENGINE warnings — use nvm or fnm to align with CI.

## Operator pilot (Google sync)

**Docker (recommended for v1.0):** follow [docs/runbooks/docker-pilot.md](docs/runbooks/docker-pilot.md).

**Host CLI (development):** configure environment variables (see `.env.example`):

- `MAILBOX_CALDAV_URL`, `MAILBOX_CALENDAR_URL`, `MAILBOX_USERNAME`, `MAILBOX_APP_PASSWORD`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`
- `SQLITE_PATH` or `DATA_DIR` (defaults to `./data/bridge.db`)
- `SYNC_INTERVAL_SECONDS` (default `300`) for watch mode
- `LOG_LEVEL` (default `info`)

Run one sync cycle:

```bash
npm run build && node dist/index.js sync
# or during development:
tsx src/index.ts sync
```

Watch mode (repeats every `SYNC_INTERVAL_SECONDS`):

```bash
tsx src/index.ts sync --watch
```

Each cycle logs aggregate counts (`created`, `updated`, `cancelled`, `dropped`, `errors`) and persists `last_success_at` in SQLite for operator visibility (OPS-03). CalDAV horizon limits are described under [CalDAV horizon (SYNC-13)](#caldav-horizon-sync-13) below.

### Withhold audit (OPS-03)

When events are withheld or downgraded, the bridge appends rows to the `withhold_audit` table in SQLite (PII-free: uid, tier, propagation, notify status, dedup key — no event titles).

Inspect the audit log after sync:

```bash
tsx src/index.ts audit list
# only rows recorded at or after a timestamp:
tsx src/index.ts audit list --since 2026-09-16T00:00:00.000Z
```

Optional email alerts to the calendar owner use `NOTIFY_OWNER_EMAIL` plus SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and optionally `SMTP_USER` / `SMTP_PASSWORD`). When `NOTIFY_OWNER_EMAIL` is unset, withhold transitions are still audited with `notify_status=disabled` and no SMTP is attempted.

`TAG_GUIDANCE_URL` (optional) is included in withhold notification emails so owners can read tagging guidance (D-12); leave empty to omit the link line.

## Status

Pre-implementation. **v1.0 pilot** validates CalDAV read → classify → wash → Google write, deletions, recurrence, and withhold notifications. **v1.1** adds Microsoft Graph.

## CalDAV horizon (SYNC-13)

mailbox.org CalDAV typically returns events within roughly a **one-year** future window (community reports; exact limits can vary by account). The bridge does **not** apply an extra client-side far-future filter in Phase 3 — it syncs whatever CalDAV reports on each poll. Operators who need events beyond that horizon should plan mailbox.org-side visibility or accept that distant events may not appear in Google until CalDAV exposes them. See the [mailbox.org user forum](https://userforum-en.mailbox.org/topic/2526) for CalDAV collection URL and query discussion.

## Documentation

Full requirements and architecture live in the NGO IT strategy repo:

- `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md`
- `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md`

## License

[MIT](LICENSE) — European Resolve VZW
