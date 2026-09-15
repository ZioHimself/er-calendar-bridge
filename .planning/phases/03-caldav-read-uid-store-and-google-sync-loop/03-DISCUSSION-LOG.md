# Phase 3: CalDAV read, UID store, and Google sync loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-15
**Phase:** 03-caldav-read-uid-store-and-google-sync-loop
**Areas discussed:** CalDAV read & deltas, UID store & idempotency, Google writer & recurrence, Sync loop & pilot run

---

## CalDAV read & deltas

| Option | Description | Selected |
|--------|-------------|----------|
| Single configured calendar | One pilot calendar URL/ID in config | ✓ (via one-person model) |
| Discover then match | PROPFIND + config match | |
| sync-collection first | Delta via sync-token; spike mailbox.org | ✓ |
| ETag per object | Simpler polling | |
| Full fetch each cycle | Pilot-only brute force | |
| Env + Zod | Validated CalDAV credentials | ✓ |
| Delta removed UIDs | sync-collection tombstones | ✓ (preferred) |
| Hard delete on Google | Calendar API delete | |
| Cancel on Google | Mark cancelled, not purged | ✓ |

**User's choice:** One instance = one person = one CalDAV + one Google; sync-collection first; env+Zod; cancel (not hard-delete) on source removal — asked whether decision docs should adapt for SYNC-12.
**Notes:** Anti-data-loss preference; CONTEXT records SYNC-12 as “no stale active events” via cancel.

---

## UID store & idempotency

| Option | Description | Selected |
|--------|-------------|----------|
| uid + recurrenceId composite | Per-exception rows | ✓ (recommended; aligned with recurrence) |
| bridge_uuid column | Stable bridge ID for future 2-way | ✓ |
| No extra UUID | Map source ↔ Google only | |
| Configurable DB path | DATA_DIR / SQLITE_PATH | ✓ |
| Keep row + cancelled state | On drop/source delete | ✓ |
| Update in place | Tier changes without migration project | ✓ |

**User's choice:** bridge_uuid column; update mapped Google event in place; no bulk migration scenarios in Phase 3.
**Notes:** User asked about separate UUID for future bi-directional sync — chose bridge_uuid column now.

---

## Google writer & recurrence

| Option | Description | Selected |
|--------|-------------|----------|
| OAuth refresh token in env | Calendar scope; CI uses mocks | ✓ |
| GOOGLE_CALENDAR_ID | Explicit target calendar | ✓ |
| Instances API pattern | Master + instance exceptions | ✓ |
| iCalUID = source UID + bridge_uuid extended prop | Link identity | ✓ |
| Busy + opaque | Phase 2 busy-block shape on Google | ✓ |

**User's choice:** As marked above.

---

## Sync loop & pilot run

| Option | Description | Selected |
|--------|-------------|----------|
| SYNC_INTERVAL_SECONDS default ~5m | Configurable interval | ✓ |
| CLI sync + sync --watch | Operator entrypoint | ✓ |
| Continue on per-event errors | Log and retry next cycle | ✓ |
| Mocked acceptance in CI | No live creds in CI | ✓ |
| Document 1-year CalDAV limit | No extra client filter | ✓ |

**User's choice:** Ready for CONTEXT.md after sync window question.

---

## Claude's Discretion

- sync-collection fallback if spike fails; SQLite column details; extended property key naming; exact env var names.

## Deferred Ideas

- Bulk tier migration tooling; full bi-directional sync; notifications (Phase 4); Docker (Phase 5).
