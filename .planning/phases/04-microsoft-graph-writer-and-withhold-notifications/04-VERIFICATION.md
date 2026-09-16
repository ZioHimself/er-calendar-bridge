---
phase: 04-microsoft-graph-writer-and-withhold-notifications
verified: 2026-09-16T09:14:00Z
status: passed
score: 4/4
overrides_applied: 0
re_verification: false
---

# Phase 4: Withhold notifications and audit log — Verification Report

**Phase Goal:** Add SMTP notifications to event owners when content is withheld or downgraded — with de-duplication and an IT audit record — integrated with the Google sync loop from Phase 3.

**Verified:** 2026-09-16T09:14:00Z  
**Status:** passed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Owner receives a notification when an event is propagated as busy-block or dropped due to classification | ✓ VERIFIED | `handleWithholdSideEffects` calls `withholdNotifier.notifyWithhold` on busy/drop transitions (`src/sync/run-sync-cycle.ts` L29–100); integration tests assert notifier invoked for `busy` and `drop` (`test/integration/sync-cycle.test.ts` withhold suite); `createWithholdNotifier` sends fixed-subject minimal English mail via nodemailer (`src/notify/withhold-notifier.ts`) |
| 2 | Repeated notifications for the same unchanged event are suppressed (stable key + on-change semantics) | ✓ VERIFIED | Dedup key `bridgeUuid:propagation:episode` in `computeWithholdTransition` (`src/sync/withhold-transition.ts` L45); unchanged propagation returns `shouldRecord: false` (L28–35); integration test second unchanged busy poll does not re-notify (D-02, D-14); episode increments on full→withhold for new keys (D-03 test) |
| 3 | IT/operator can inspect an audit log of withholding events | ✓ VERIFIED | Append-only `withhold_audit` table (`src/store/schema.sql`); `openAuditStore.appendAuditRow` / `listAuditSince` (`src/store/audit-store.ts`); CLI `audit list [--since]` tab-separated output without titles (`src/index.ts` L63–83); README documents usage |
| 4 | Notification path works against the Google pilot sync loop (no Microsoft writer required) | ✓ VERIFIED | Wired in `runOneSyncCycle` with Google `createGoogleCalendarWriter` only (`src/index.ts` L113–148); no Microsoft/Graph code under `src/`; tombstone deletes skip notifier (D-04 integration test) |

**Score:** 4/4 roadmap truths verified

### Deferred Items

None — all roadmap criteria are met in this phase; Microsoft Graph writer remains Phase 6 per ROADMAP.md.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/sync/withhold-transition.ts` | Dedup / episode logic | ✓ VERIFIED | Substantive pure function; imported by sync loop and tests |
| `src/store/audit-store.ts` | State + audit persistence | ✓ VERIFIED | Wired via `run-sync-cycle.ts`; schema loaded from `schema.sql` |
| `src/store/schema.sql` | `withhold_notify_state`, `withhold_audit` | ✓ VERIFIED | PII-free columns (no title/summary) |
| `src/notify/withhold-notifier.ts` | SMTP notifier | ✓ VERIFIED | Implements `WithholdNotifier`; no BCC; catches send errors |
| `src/notify/types.ts` | Notifier port | ✓ VERIFIED | Used by sync deps and tests |
| `src/config/env.ts` | SMTP / notify config | ✓ VERIFIED | `NOTIFY_OWNER_EMAIL` gates SMTP requirement (env tests) |
| `src/sync/run-sync-cycle.ts` | Withhold side effects in loop | ✓ VERIFIED | `handleWithholdSideEffects` on busy upsert and drop paths |
| `src/sync/types.ts` | `auditStore`, `withholdNotifier`, `notifyEnabled` | ✓ VERIFIED | Required deps on `SyncCycleDeps` |
| `src/index.ts` | Sync + audit CLI | ✓ VERIFIED | `createWithholdNotifier` + `openAuditStore` in sync path |
| `test/integration/sync-cycle.test.ts` | Withhold integration | ✓ VERIFIED | 8 withhold scenarios including D-03, D-04, D-08 |
| `test/cli/audit-list.test.ts` | Audit CLI | ✓ VERIFIED | Passes in Phase 4 test run |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `run-sync-cycle.ts` | `withhold-transition.ts` | `computeWithholdTransition` | ✓ WIRED | gsd-sdk verify.key-links PASS |
| `run-sync-cycle.ts` | `audit-store.ts` | get/upsert/append | ✓ WIRED | `getNotifyState`, `appendAuditRow`, `upsertNotifyState` |
| `index.ts` | `withhold-notifier.ts` | `createWithholdNotifier` | ✓ WIRED | Sync command constructs notifier from config |
| `index.ts` | `audit-store.ts` | `listAuditSince` | ✓ WIRED | `runAuditList` opens store and lists rows |
| `withhold-notifier.ts` | `nodemailer` | `createTransport` / `sendMail` | ✓ WIRED | Production path when owner email set |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `run-sync-cycle.ts` withhold path | `transition.dedupKey`, `notifyStatus` | `processSourceEvent` propagation + `auditStore.getNotifyState` | Yes — derived from live classified event + persisted state | ✓ FLOWING |
| `index.ts` audit list | `rows` | `auditStore.listAuditSince(since)` SQLite query | Yes — rows appended during sync transitions | ✓ FLOWING |
| `withhold-notifier.ts` email body | tier/propagation | Notify params from sync (not fixture title) | Yes — minimal template only | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 4 unit + integration suites | `npm test -- test/sync/withhold-transition.test.ts test/store/audit-store.test.ts test/notify/withhold-notifier.test.ts test/integration/sync-cycle.test.ts test/cli/audit-list.test.ts test/config/env.test.ts` | 6 files, 58 tests passed (exit 0) | ✓ PASS |
| Dedup key format | `grep` `bridgeUuid:` in `withhold-transition.ts` | `${bridgeUuid}:${currentPropagation}:${nextEpisode}` | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no phase-declared probes and no `scripts/*/tests/probe-*.sh` in repository.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | ---------------- | ----------- | ------ | -------- |
| SYNC-14 | 04-03, 04-04, 04-05 | Notify owners on withhold/downgrade | ✓ SATISFIED | Notifier on busy/drop transitions; minimal email policy tests |
| SYNC-15 | 04-01, 04-05 | De-duplicate notifications | ✓ SATISFIED | `computeWithholdTransition` + persisted `last_propagation` / episode |
| SYNC-16 | 04-02, 04-05, 04-06 | IT audit of withholding | ✓ SATISFIED | SQLite audit + `audit list` CLI |
| OPS-03 | 04-02, 04-05, 04-06 | Sync status + withheld visibility | ✓ SATISFIED | Cycle still records `last_success_at` on notify failure; per-event audit rows queryable |

No orphaned Phase 4 requirements in REQUIREMENTS.md beyond the IDs above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | — | — | No TBD/FIXME/XXX or stub handlers in Phase 4 `src/` paths scanned |

### Human Verification Required

None for phase closure — withhold behavior is covered by mocked notifier and jsonTransport tests consistent with Phase 3 verification (no live SMTP/CalDAV in CI). Pilot operators may optionally confirm inbox delivery before production use.

### Gaps Summary

No gaps. Withhold notify/audit behavior is implemented, wired into the Google-only sync loop, tested in CI, and exposed via the audit CLI.

---

_Verified: 2026-09-16T09:14:00Z_  
_Verifier: Claude (gsd-verifier)_
