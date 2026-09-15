---
phase: 03-caldav-read-uid-store-and-google-sync-loop
verified: 2026-09-15T16:32:00Z
status: passed
score: 6/6
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "Operator can run a single-account pilot sync against their own Google calendar"
    - "OPS-01 single-account pilot configuration is runnable end-to-end"
  gaps_remaining: []
  regressions: []
---

# Phase 3: CalDAV read, UID store, and Google sync loop — Verification Report

**Phase Goal:** Integrate mailbox.org CalDAV read (tsdav), per-container SQLite UID→Google event ID mapping, and a Google Calendar API writer with a sync loop that propagates create/update/delete and handles recurring series for the operator's pilot calendar.

**Verified:** 2026-09-15T16:32:00Z  
**Status:** passed  
**Re-verification:** Yes — after `fix(03): allow loadConfig with full process.env` (c83fe05)

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Bridge reads events from mailbox.org CalDAV using app-specific password (read-only) | ✓ VERIFIED | `createCalDavClient` uses `MAILBOX_APP_PASSWORD` + Basic auth (`src/adapters/caldav/client.ts`); `createCalDavReader` polls via `smartCollectionSyncDetailed` (`src/adapters/caldav/reader.ts`); SEC-01 export guard in `test/adapters/caldav-readonly.test.ts` |
| 2 | Source event UID maps to Google event ID in SQLite; restart does not create duplicates | ✓ VERIFIED | `runSyncCycle` upserts mappings with `existingGoogleEventId` reuse (`src/sync/run-sync-cycle.ts`); composite PK in `src/store/mapping-store.ts`; `test/integration/sync-cycle.test.ts` idempotent case (SYNC-11) |
| 3 | Event creation, modification, and deletion on source propagate to Google within configured sync interval | ✓ VERIFIED | Update/delete tests in `test/integration/sync-cycle.test.ts` (SYNC-06, SYNC-12); `src/index.ts` `sync --watch` loops on `SYNC_INTERVAL_SECONDS` |
| 4 | Recurring events and individually modified/deleted instances reconcile correctly | ✓ VERIFIED | `test/integration/sync-recurrence.test.ts` (SYNC-07); writer sets `originalStartTime` for instances (`src/writers/google/calendar-writer.ts`) |
| 5 | Operator can run a single-account pilot sync against their own Google calendar | ✓ VERIFIED | `loadConfig()` skips `assertNoUnknownEnvKeys` when `env === process.env` and validates only `pickPilotEnv` keys (`src/config/env.ts` L99–105); regression test `tolerates unrelated keys present in process.env` (`test/config/env.test.ts`); CLI `main()` reaches missing-field errors (not `COMMAND_MODE`) with real shell env |
| 6 | Google OAuth is scoped to calendar only | ✓ VERIFIED | `GOOGLE_CALENDAR_SCOPE` = `https://www.googleapis.com/auth/calendar` (`src/writers/google/auth.ts`); `test/writers/google-auth.test.ts` |

**Score:** 6/6 roadmap truths verified

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| SYNC-01 | One-way sync CalDAV → Google | ✓ SATISFIED | `runSyncCycle` pipeline CalDAV → parse → process → writer (`src/sync/run-sync-cycle.ts`); integration tests |
| SYNC-05 | Withhold ER-SENSITIVE (no busy-block) | ✓ SATISFIED | `processSourceEvent` drop path cancels mapping (`run-sync-cycle.ts`); `sync-cycle.test.ts` drop propagation |
| SYNC-06 | Create/update/delete within minutes | ✓ SATISFIED | Mocked update test; watch interval default 300s (`env.ts`, `index.ts`) |
| SYNC-07 | Recurrence instances | ✓ SATISFIED | `sync-recurrence.test.ts` |
| SYNC-11 | Idempotent restarts | ✓ SATISFIED | Second empty delta test; mapping store upsert semantics |
| SYNC-12 | Deletions propagate as cancel | ✓ SATISFIED | Tombstone handler + deleted delta test; Google `events.patch` cancel not delete |
| SYNC-13 | ~1-year CalDAV horizon documented | ✓ SATISFIED | README § CalDAV horizon (SYNC-13); spike payload note in `03-SPIKE-SYNC.md` |
| SEC-01 | Read-only mailbox.org | ✓ SATISFIED | Client/reader comments + caldav-readonly export test; no write APIs exported |
| SEC-03 | Google OAuth calendar only | ✓ SATISFIED | `auth.ts` + unit test |
| SEC-04 | Per-member credential isolation | ✓ SATISFIED | Unknown-key rejection on explicit env fixtures; runtime uses pilot key pick only; secret redaction in errors (`env.ts`) |
| OPS-01 | Single-account pilot configuration | ✓ SATISFIED | Schema + CLI wiring; boot works with typical `process.env` after c83fe05 |
| OPS-03 | Sync status, last success, withheld visibility | ⚠️ PARTIAL | `recordSuccess` + log counts including `dropped` (`run-sync-cycle.ts`, `index.ts`); integration test for `last_success_at`; no per-event withheld listing (Phase 4 may extend) |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/sync/run-sync-cycle.ts` | Orchestration | ✓ VERIFIED | Wired, substantive, used by CLI and tests |
| `src/index.ts` | CLI sync/--watch | ✓ VERIFIED | `loadConfig()` at startup; sync path wired |
| `src/adapters/caldav/reader.ts` | CalDavReader | ✓ VERIFIED | Poll + href tombstones + sync state |
| `src/writers/google/calendar-writer.ts` | CalendarWriter | ✓ VERIFIED | insert/patch + cancel via patch |
| `src/store/mapping-store.ts` | UID mapping | ✓ VERIFIED | Composite key, cancel retention |
| `src/store/sync-state-store.ts` | sync_state | ✓ VERIFIED | last_success_at, degraded_mode |
| `src/config/env.ts` | loadConfig | ✓ VERIFIED | Runtime-safe `process.env`; strict for test fixtures |
| `test/integration/sync-cycle.test.ts` | E2E acceptance | ✓ VERIFIED | 62 tests pass in suite |
| `test/integration/sync-recurrence.test.ts` | Recurrence | ✓ VERIFIED | Instance mapping keys |
| `test/config/env.test.ts` | Env regression | ✓ VERIFIED | COMMAND_MODE + PATH tolerance test |
| `03-SPIKE-SYNC.md` | Spike outcome | ✓ VERIFIED | degraded_mode `basic_sync`; live operator run noted pending |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `run-sync-cycle.ts` | `process-source-event.js` | per SourceEvent | ✓ WIRED | `processSourceEvent` imported and called |
| `index.ts` | `run-sync-cycle.js` | real adapters | ✓ WIRED | CalDAV reader + Google writer constructed |
| `index.ts` | `loadConfig` | startup | ✓ WIRED | Validates pilot keys only from `process.env` |
| `reader.ts` | `mapping-store` | href snapshot / resolveUidByHref | ✓ WIRED | upsertHrefSnapshot + resolveUidByHref in poll |
| `reader.ts` | `sync-state-store` | sync token / degraded_mode | ✓ WIRED | updateSyncState on poll |
| `calendar-writer.ts` | `calendar.events` | insert/patch | ✓ WIRED | No `events.delete` in codebase |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `run-sync-cycle.ts` | `delta.changed[].data` | `deps.caldav.poll()` | Real in production; mocked in CI | ✓ FLOWING (design) |
| `run-sync-cycle.ts` | `googleEventId` | `writer.upsertOutbound` | API response id stored in SQLite | ✓ FLOWING |
| `index.ts` | `config` | `loadConfig(process.env)` | Pilot fields from env when set | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Test suite | `npm test -- --run` | 12 files, 62 passed | ✓ PASS |
| TypeScript build | `npm run build` | tsc success | ✓ PASS |
| CLI boot with real env | `node dist/index.js` (no args) | Missing pilot vars error (not unrecognized OS keys) | ✓ PASS |
| loadConfig + COMMAND_MODE | `node -e` with pilot vars + COMMAND_MODE | `ok` | ✓ PASS |
| Calendar-only scope export | vitest `google-auth.test.ts` | Passes | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` and no phase-declared probe scripts.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX in `src/` | — | — |

### Optional Operator Validation (non-blocking)

Live mailbox.org and Google credentials are not exercised in CI (D-19). Recommended before production pilot:

1. **Live CalDAV spike** — `npm run spike:mailbox-sync` or one reader poll; confirm login and `basic_sync` tombstones per `03-SPIKE-SYNC.md`.
2. **Live Google sync** — configure pilot `.env`, run `node dist/index.js sync` once; confirm Google calendar updates and SQLite `last_success_at`.

### Re-verification Summary

Previous blockers (`assertNoUnknownEnvKeys` on full `process.env`) are resolved in c83fe05: unknown-key rejection applies only when callers pass an explicit env object (tests/fixtures), matching 03-02-SUMMARY intent. Automated acceptance remains green; phase goal is achieved for programmatic verification.

---

_Verified: 2026-09-15T16:32:00Z_  
_Verifier: Claude (gsd-verifier)_
