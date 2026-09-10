# ER Calendar Bridge

Read-only sync from mailbox.org (CalDAV) to Google Calendar and Microsoft 365, with per-event classification and content washing before data crosses to third parties.

**Scope:** one-way propagation for members who use Google/Outlook. CalDAV-native clients (Apple Calendar, Thunderbird, Morgen) connect to mailbox.org directly — no bridge needed.

## How it works

```
mailbox.org (CalDAV, read-only) → BRIDGE → Google Calendar API
                                        → Microsoft Graph
                                        → SMTP (withhold notifications)
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
| Pilot | Operator laptop (encrypted) | Operator's calendar only |
| Production | Organisation server | Active schedulers, then others |

Secrets: Docker secrets / `sops`+`age` (interim) → Vault or OpenBao (target).

## Status

Pre-implementation. Pilot validates CalDAV read → classify → wash → Google/Microsoft write, deletions, recurrence, and withhold notifications.

## Documentation

Full requirements and architecture live in the NGO IT strategy repo:

- `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md`
- `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md`

## License

[MIT](LICENSE) — European Resolve VZW
