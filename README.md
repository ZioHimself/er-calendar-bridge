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

Docker image, orchestrated with Docker Compose — one container per synced member, each with only that member's secrets.

| Phase | Host | Scope |
|-------|------|-------|
| Pilot (v1.0) | Operator laptop (encrypted) | Operator's calendar → Google only |
| v1.1 | Same or server | Add Microsoft Graph write path |
| Production | Organisation server | Active schedulers, then others |

Secrets: Docker secrets / `sops`+`age` (interim) → Vault or OpenBao (target).

## Development

This project uses trunk-based development: push directly to `main`. Pull requests are not required for now, though CI also runs on `pull_request` targeting `main` when used.

GitHub Actions runs on every push to `main` with four parallel jobs: test, lint, typecheck, and build.

Before pushing, run the local gate:

```bash
npm test && npm run lint && npm run typecheck && npm run build
```

CI uses Node.js 24 (see `engines.node` in `package.json`). Local Node 22 may show EBADENGINE warnings — use nvm or fnm to align with CI.

## Status

Pre-implementation. **v1.0 pilot** validates CalDAV read → classify → wash → Google write, deletions, recurrence, and withhold notifications. **v1.1** adds Microsoft Graph.

## Documentation

Full requirements and architecture live in the NGO IT strategy repo:

- `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md`
- `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md`

## License

[MIT](LICENSE) — European Resolve VZW
