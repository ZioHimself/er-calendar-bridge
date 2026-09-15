---
phase: 03-caldav-read-uid-store-and-google-sync-loop
verified: 2026-09-15T16:30:00Z
status: gaps_found
score: 5/6
overrides_applied: 0
re_verification: false
gaps:
  - truth: "Operator can run a single-account pilot sync against their own Google calendar"
    status: failed
    reason: "loadConfig() validates the entire process.env and rejects standard shell variables (e.g. COMMAND_MODE on macOS), so `node dist/index.js sync` fails before any sync work runs."
    artifacts:
      - path: src/config/env.ts
        issue: "assertNoUnknownEnvKeys(env) runs on default process.env instead of pilot-picked keys only"
      - path: src/index.ts
        issue: "main() and runOneSyncCycle() call loadConfig() with no env isolation"
    missing:
      - "Apply unknown-key rejection only to pilot keys (pickPilotEnv) at runtime, or pass a filtered env object into loadConfig from the CLI entrypoint"
      - "Add a regression test that loadConfig(process.env) succeeds when extra unrelated keys are present alongside required pilot vars"
  - truth: "OPS-01 single-account pilot configuration is runnable end-to-end"
    status: failed
    reason: "Same loadConfig/process.env strictness blocks the documented operator commands in README.md"
    artifacts:
      - path: src/config/env.ts
        issue: "Runtime boot incompatible with normal terminal environment"
    missing:
      - "Fix env validation boundary so README `node dist/index.js sync` works with a .env or exported pilot vars in a typical shell"
human_verification:
  - test: "Run `npm run spike:mailbox-sync` (or CalDAV reader poll) against a real mailbox.org calendar with app-specific password"
    expected: "Login succeeds; changed ICS objects returned; tombstone behavior matches 03-SPIKE-SYNC.md notes for basic_sync"
    why_human: "03-SPIKE-SYNC.md records research synthesis only — live provider sync-collection and deletion semantics are operator-validated"
  - test: "After loadConfig fix, run one `sync` cycle against operator Google calendar with real credentials"
    expected: "Events appear or update in Google; SQLite mappings populated; logs show cycle counts and last_success_at"
    why_human: "CI uses mocked CalDAV/Google only (D-19); no live API credentials in automated suite"
---

# Phase 3: CalDAV read, UID store, and Google sync loop — Verification Report

**Phase Goal:** Integrate mailbox.org CalDAV read (tsdav), per-container SQLite UID→Google event ID mapping, and a Google Calendar API writer with a sync loop that propagates create/update/delete and handles recurring series for the operator's pilot calendar.

**Verified:** 2026-09-15T16:30:00Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Bridge reads events from mailbox.org CalDAV using app-specific password (read-only) | ✓ VERIFIED | `createCalDavClient` uses `MAILBOX_APP_PASSWORD` + Basic auth (`src/adapters/caldav/client.ts`); `createCalDavReader` polls via `smartCollectionSyncDetailed` (`src/adapters/caldav/reader.ts`); SEC-01 export guard in `test/adapters/caldav-readonly.test.ts` |
| 2 | Source event UID maps to Google event ID in SQLite; restart does not create duplicates | ✓ VERIFIED | `runSyncCycle` upserts mappings with `existingGoogleEventId` reuse (`src/sync/run-sync-cycle.ts`); composite PK in `src/store/mapping-store.ts`; `test/integration/sync-cycle.test.ts` idempotent case (SYNC-11) |
| 3 | Event creation, modification, and deletion on source propagate to Google within configured sync interval | ✓ VERIFIED | Update/delete tests in `test/integration/sync-cycle.test.ts` (SYNC-06, SYNC-12); `src/index.ts` `sync --watch` loops on `SYNC_INTERVAL_SECONDS` |
| 4 | Recurring events and individually modified/deleted instances reconcile correctly | ✓ VERIFIED | `test/integration/sync-recurrence.test.ts` (SYNC-07); writer sets `originalStartTime` for instances (`src/writers/google/calendar-writer.ts`) |
| 5 | Operator can run a single-account pilot sync against their own Google calendar | ✗ FAILED | CLI wired in `src/index.ts` + README, but `loadConfig()` fails on real `process.env` (spot-check: `Invalid environment configuration: Unrecognized key: "COMMAND_MODE"`) |
| 6 | Google OAuth is scoped to calendar only | ✓ VERIFIED | `GOOGLE_CALENDAR_SCOPE` = `https://www.googleapis.com/auth/calendar` (`src/writers/google/auth.ts`); `test/writers/google-auth.test.ts` |

**Score:** 5/6 roadmap truths verified

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
| SEC-04 | Per-member credential isolation | ⚠️ PARTIAL | Strict pilot env schema and secret redaction in errors (`env.ts`); **runtime** unknown-key check on full `process.env` breaks pilot boot (see gaps) |
| OPS-01 | Single-account pilot configuration | ✗ BLOCKED | Config schema and single calendar URL enforced; **not runnable** until env fix |
| OPS-03 | Sync status, last success, withheld visibility | ⚠️ PARTIAL | `recordSuccess` + log counts including `dropped` (`run-sync-cycle.ts`, `index.ts`); integration test for `last_success_at`; no per-event withheld listing (Phase 4 may extend) |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/sync/run-sync-cycle.ts` | Orchestration | ✓ VERIFIED | Wired, substantive, used by CLI and tests |
| `src/index.ts` | CLI sync/--watch | ✓ VERIFIED | Substantive; blocked at config load in real shell |
| `src/adapters/caldav/reader.ts` | CalDavReader | ✓ VERIFIED | Poll + href tombstones + sync state |
| `src/writers/google/calendar-writer.ts` | CalendarWriter | ✓ VERIFIED | insert/patch + cancel via patch |
| `src/store/mapping-store.ts` | UID mapping | ✓ VERIFIED | Composite key, cancel retention |
| `src/store/sync-state-store.ts` | sync_state | ✓ VERIFIED | last_success_at, degraded_mode |
| `src/config/env.ts` | loadConfig | ✗ STUB (runtime) | Correct for isolated test env; broken for `process.env` |
| `test/integration/sync-cycle.test.ts` | E2E acceptance | ✓ VERIFIED | 61 tests pass in suite |
| `test/integration/sync-recurrence.test.ts` | Recurrence | ✓ VERIFIED | Instance mapping keys |
| `03-SPIKE-SYNC.md` | Spike outcome | ✓ VERIFIED | degraded_mode `basic_sync`; live operator run noted pending |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `run-sync-cycle.ts` | `process-source-event.js` | per SourceEvent | ✓ WIRED | `processSourceEvent` imported and called |
| `index.ts` | `run-sync-cycle.js` | real adapters | ✓ WIRED | CalDAV reader + Google writer constructed |
| `reader.ts` | `mapping-store` | href snapshot / resolveUidByHref | ✓ WIRED | upsertHrefSnapshot + resolveUidByHref in poll |
| `reader.ts` | `sync-state-store` | sync token / degraded_mode | ✓ WIRED | updateSyncState on poll |
| `calendar-writer.ts` | `calendar.events` | insert/patch | ✓ WIRED | No `events.delete` in codebase |
| `index.ts` | `loadConfig` | startup | ✗ NOT_WIRED (runtime) | Fails before adapters run in normal environment |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `run-sync-cycle.ts` | `delta.changed[].data` | `deps.caldav.poll()` | Real in production; mocked in CI | ✓ FLOWING (design) |
| `run-sync-cycle.ts` | `googleEventId` | `writer.upsertOutbound` | API response id stored in SQLite | ✓ FLOWING |
| `index.ts` | `config` | `loadConfig(process.env)` | N/A in typical shell | ✗ DISCONNECTED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Test suite | `npm test -- --run` | 12 files, 61 passed | ✓ PASS |
| TypeScript build | `npm run build` | tsc success | ✓ PASS |
| CLI boot with real env | `node dist/index.js` (no args) | Fails: Unrecognized key COMMAND_MODE | ✗ FAIL |
| Calendar-only scope export | vitest `google-auth.test.ts` | Passes | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` and no phase-declared probe scripts.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX in `src/` | — | — |

### Human Verification Required

### 1. Live mailbox.org CalDAV spike

**Test:** Run spike or one reader poll with operator app password on real `MAILBOX_CALENDAR_URL`.  
**Expected:** Successful login; object counts; confirm `basic_sync` tombstone behavior on delete.  
**Why human:** Spike doc explicitly marks live operator run pending; CI has no mailbox credentials.

### 2. Live Google pilot sync (after env fix)

**Test:** Configure pilot env, run `node dist/index.js sync` once.  
**Expected:** Google calendar reflects washed events; SQLite mappings and `last_success_at` updated.  
**Why human:** Integration tests mock Google APIs only.

### Gaps Summary

The sync loop, stores, adapters, and mocked acceptance tests are implemented and pass CI. The phase goal is **not fully achieved** because the operator entrypoint cannot start in a normal shell: `loadConfig()` applies SEC-04 unknown-key rejection to **all** of `process.env`, contradicting the documented intent in 03-02-SUMMARY (strict checks on passed env objects in tests, pilot key picking at runtime). Until that boundary is fixed, roadmap success criterion #5 and OPS-01 are not met despite README and CLI wiring.

---

_Verified: 2026-09-15T16:30:00Z_  
_Verifier: Claude (gsd-verifier)_
