---
phase: 03-caldav-read-uid-store-and-google-sync-loop
plan: 06
subsystem: integrations
tags: [sync-orchestration, pino, integration-tests, CLI, OPS-03, tdd]

requires:
  - phase: 03-caldav-read-uid-store-and-google-sync-loop
    plan: 02
    provides: SyncCycleDeps ports and loadConfig
  - phase: 03-caldav-read-uid-store-and-google-sync-loop
    plan: 03
    provides: mapping and sync_state SQLite stores
  - phase: 03-caldav-read-uid-store-and-google-sync-loop
    plan: 04
    provides: CalDavReader poll and tombstone uid resolution
  - phase: 03-caldav-read-uid-store-and-google-sync-loop
    plan: 05
    provides: Google CalendarWriter implementation
provides:
  - runSyncCycle port-based orchestration (SYNC-01)
  - Mocked integration acceptance suite (D-19)
  - CLI sync and sync --watch with pino redaction
  - last_success_at persistence and cycle count logging (OPS-03)
affects:
  - phase-04-withhold-notifications

tech-stack:
  added: []
  patterns:
    - "runSyncCycle injects caldav/writer/stores only — no env or vendor imports"
    - "Per-event try/catch continues cycle; recordSuccess after full poll (D-18)"
    - "CLI opens stores per cycle in watch mode"

key-files:
  created:
    - src/sync/run-sync-cycle.ts
    - test/integration/sync-cycle.test.ts
    - test/integration/sync-recurrence.test.ts
  modified:
    - src/sync/types.ts
    - src/index.ts
    - README.md

key-decisions:
  - "Modified-instance fixture yields master + override upserts; tests assert recurrence override call"
  - "Watch mode infinite loop with sleep between cycles (D-17)"

patterns-established:
  - "Integration tests mock CalDavReader.poll sequences for multi-cycle scenarios"
  - "Tier in-place updates reuse google_event_id without cancel+recreate (D-10)"

requirements-completed: [SYNC-01, SYNC-05, SYNC-06, SYNC-07, SYNC-11, SYNC-12, OPS-03]

duration: 15min
completed: 2026-09-15
---

# Phase 03 Plan 06: Sync orchestration and CLI Summary

**Port-based `runSyncCycle` with mocked integration acceptance, pino CLI `sync`/`sync --watch`, and SQLite `last_success_at` for operator cycle visibility.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-15T16:24:00Z
- **Completed:** 2026-09-15T16:27:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- RED/GREEN integration tests for idempotency, update propagation, tier in-place updates, drop/delete cancels, OPS-03 metadata, and recurrence fixtures.
- `runSyncCycle` wires CalDAV delta → `parseIcsToSourceEvents` → `processSourceEvent` → mapping store → writer with per-event error isolation.
- Production CLI loads config, redacts secrets in logs, runs one cycle or watch loop, logs counts and `last_success_at`.

## Task Commits

1. **Task 1 (RED): Integration tests for sync cycle and recurrence** - `71b4b86` (test)
2. **Task 2 (GREEN): Implement runSyncCycle orchestration** - `da99e39` (feat)
3. **Task 3: CLI wiring, structured logging, and phase validation gate** - `630348d` (feat)

## Files Created/Modified

- `src/sync/run-sync-cycle.ts` - Sync cycle orchestration
- `src/sync/types.ts` - Extended `SyncCycleDeps` with stores and calendar URL
- `test/integration/sync-cycle.test.ts` - Mocked E2E acceptance cases
- `test/integration/sync-recurrence.test.ts` - Recurrence fixture integration tests
- `src/index.ts` - CLI sync/watch entrypoint with pino redaction
- `README.md` - Operator pilot run instructions

## Decisions Made

- Recurrence modified-instance ICS produces two upserts (series master + override); tests target the override call with `recurrenceId`.
- Same SQLite path opens mapping and sync_state stores per cycle (shared schema file).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CalDAV login error missing `cause` for ESLint**
- **Found during:** Task 3 (full lint gate)
- **Issue:** `preserve-caught-error` failed on pre-existing `createCalDavClient` throw
- **Fix:** Attach `{ cause: err }` to login failure Error
- **Files modified:** `src/adapters/caldav/client.ts`
- **Verification:** `npm run lint` passes
- **Committed in:** `630348d` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Lint gate unblocked; no behavior change beyond error chaining.

## Issues Encountered

None beyond lint gate above.

## User Setup Required

None for CI. Operator pilot requires live mailbox.org and Google OAuth env vars documented in README and `.env.example`.

## Next Phase Readiness

Phase 3 Google pilot loop complete in code; Phase 4 can build withhold notifications on top of drop/cancel paths already exercised in integration tests.

## Self-Check: PASSED

- FOUND: src/sync/run-sync-cycle.ts
- FOUND: test/integration/sync-cycle.test.ts
- FOUND: test/integration/sync-recurrence.test.ts
- FOUND: 71b4b86
- FOUND: da99e39
- FOUND: 630348d

---
*Phase: 03-caldav-read-uid-store-and-google-sync-loop*
*Completed: 2026-09-15*
