---
phase: 04-microsoft-graph-writer-and-withhold-notifications
plan: 05
subsystem: sync
tags: [withhold, audit, sync-loop, vitest, SYNC-14, SYNC-15, SYNC-16, OPS-03]

requires:
  - phase: 04-microsoft-graph-writer-and-withhold-notifications
    provides: withhold transition, audit store, WithholdNotifier port
provides:
  - handleWithholdSideEffects wired into Google sync loop
  - Integration tests for withhold notify dedup and audit outcomes
  - CLI sync opens audit store and injects notifier
affects:
  - 04-06 audit list CLI

tech-stack:
  added: []
  patterns:
    - "notifyEnabled flag separates SMTP disabled audit from sent/failed outcomes"
    - "Shared sqlitePath for mapping, sync state, and audit in integration tests"

key-files:
  created: []
  modified:
    - src/sync/run-sync-cycle.ts
    - src/sync/types.ts
    - src/index.ts
    - test/integration/sync-cycle.test.ts
    - test/integration/sync-recurrence.test.ts

key-decisions:
  - "SMTP failures caught inside withhold handler; sync cycle errors unchanged (D-08)"
  - "CalDAV tombstones skip withhold handler entirely (D-04)"
  - "Integration mocks use WithholdNotifier object shape, not bare vi.fn()"

patterns-established:
  - "handleWithholdSideEffects runs after Google writer cancel/upsert per event"
  - "computeWithholdTransition drives audit append and notify attempt"

requirements-completed: [SYNC-14, SYNC-15, SYNC-16, OPS-03]

duration: 6min
completed: 2026-09-16
---

# Phase 04 Plan 05: Sync Loop Withhold Wiring Summary

**Withhold transitions in `runSyncCycle` persist notify state, append audit rows, and call an injectable notifier without failing the sync cycle on SMTP errors.**

## Performance

- **Duration:** 6 min
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Wired `handleWithholdSideEffects` after outbound upsert/cancel with episode dedup via `computeWithholdTransition`
- Extended integration tests for busy/drop notify, episode re-notify, tombstone exclusion, disabled and failed notify paths
- CLI `sync` opens `openAuditStore` on `config.sqlitePath` and passes `createWithholdNotifier` plus `notifyEnabled`

## Task Commits

1. **Task 1 (RED): Integration tests** - `d7de3a6` (test)
2. **Task 2 (GREEN): Sync loop wiring** - `26ef7d5` (feat)
3. **Task 3: CLI wiring** - `e29662d` (feat)

## Files Created/Modified

- `src/sync/run-sync-cycle.ts` - Withhold side effects after Google writes; no withhold on tombstones
- `src/sync/types.ts` - `auditStore`, `withholdNotifier`, `notifyEnabled` on `SyncCycleDeps`
- `src/index.ts` - Audit store lifecycle and notifier injection in sync command
- `test/integration/sync-cycle.test.ts` - Withhold integration suite with shared sqlite temp file
- `test/integration/sync-recurrence.test.ts` - Required withhold deps for recurrence tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WithholdNotifier test mocks used vi.fn() as the notifier object**
- **Found during:** Task 1 verification
- **Issue:** `deps.withholdNotifier.notifyWithhold` was undefined; audits could show failed without real notify calls
- **Fix:** `createMockWithholdNotifier()` wraps `vi.fn()` in `{ notifyWithhold }` shape
- **Files modified:** `test/integration/sync-cycle.test.ts`
- **Commit:** `26ef7d5`

None otherwise — plan executed as written.

## Self-Check: PASSED

- FOUND: src/sync/run-sync-cycle.ts
- FOUND: src/sync/types.ts
- FOUND: src/index.ts
- FOUND: test/integration/sync-cycle.test.ts
- FOUND: d7de3a6
- FOUND: 26ef7d5
- FOUND: e29662d
