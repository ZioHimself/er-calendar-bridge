---
phase: 03-caldav-read-uid-store-and-google-sync-loop
plan: 04
subsystem: api
tags: [caldav, tsdav, SEC-01, SYNC-01, SYNC-12, SYNC-13, basic_sync]

requires:
  - phase: 03-caldav-read-uid-store-and-google-sync-loop
    plan: 03
    provides: mapping href snapshots and sync_state store
  - phase: 03-caldav-read-uid-store-and-google-sync-loop
    plan: 02
    provides: CalDavReader port and AppConfig
provides:
  - Read-only tsdav DAVClient factory (SEC-01)
  - CalDavReader.poll producing SyncDelta with basic_sync default (03-SPIKE-SYNC)
  - Tombstone uid resolution via href snapshot (D-05)
affects:
  - 03-06-sync-cycle

tech-stack:
  added: []
  patterns:
    - "tsdav confined to src/adapters/caldav/client.ts"
    - "CalDavSyncClient duck-type in reader for testability without tsdav import"
    - "degraded_mode basic_sync with webdav_sync upgrade path in sync_state"

key-files:
  created:
    - src/adapters/caldav/client.ts
    - src/adapters/caldav/reader.ts
    - src/adapters/caldav/index.ts
    - test/adapters/caldav-reader.test.ts
    - test/adapters/caldav-readonly.test.ts
  modified:
    - README.md

key-decisions:
  - "Poll uses smartCollectionSyncDetailed method basic unless sync_state degraded_mode is webdav_sync"
  - "Deleted CalDAV hrefs omitted from SyncDelta when no href snapshot uid (D-05)"

patterns-established:
  - "Reader returns raw ICS in changed[]; orchestrator parses in 03-06"

requirements-completed: [SEC-01, SYNC-01, SYNC-12, SYNC-13]

duration: 5min
completed: 2026-09-15
---

# Phase 03 Plan 04: Read-only CalDAV reader Summary

**CalDavReader polls mailbox.org via tsdav basic_sync, persists sync tokens and href snapshots, and resolves tombstones to source UIDs for cancel-not-delete sync.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-09-15T15:54:00Z
- **Completed:** 2026-09-15T15:56:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `createCalDavClient` with Basic auth, login error redaction, SEC-01 module comment
- `createCalDavReader` maps tsdav created/updated/deleted to `SyncDelta`, upserts href snapshots, persists `sync_token`/`ctag`/`degraded_mode`
- Unit tests mock `smartCollectionSyncDetailed` (no network); SEC-01 export guard test
- README **CalDAV horizon (SYNC-13)** ops note with forum link

## Task Commits

1. **Task 1: Read-only CalDAV client factory** — `67b8b3f` (feat)
2. **Task 2 (RED): CalDavReader poll tests** — `326e054` (test)
3. **Task 2 (GREEN): CalDavReader implementation** — `df4820e` (feat)
4. **Task 3: SEC-01 guard and SYNC-13 README** — `f31f9e0` (feat)

**Plan metadata:** `e032148` (docs: complete plan)

## Files Created/Modified

- `src/adapters/caldav/client.ts` — only tsdav import; login factory
- `src/adapters/caldav/reader.ts` — poll + `extractUidFromIcs` minimal UID line parse
- `src/adapters/caldav/index.ts` — exports `createCalDavClient`, `createCalDavReader` only
- `test/adapters/caldav-reader.test.ts` — changed/deleted/sync_state/mode tests
- `test/adapters/caldav-readonly.test.ts` — export surface guard
- `README.md` — ~1-year CalDAV horizon documentation

## Decisions Made

- Default `degraded_mode` `basic_sync` per 03-SPIKE-SYNC until operator upgrades to `webdav_sync`
- `snapshot_diff` shares basic sync method until a dedicated snapshot path is required

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- FOUND: src/adapters/caldav/client.ts
- FOUND: src/adapters/caldav/reader.ts
- FOUND: test/adapters/caldav-reader.test.ts
- FOUND: test/adapters/caldav-readonly.test.ts
- FOUND: 67b8b3f
- FOUND: 326e054
- FOUND: df4820e
- FOUND: f31f9e0

## Self-Check: PASSED
