---
phase: 03-caldav-read-uid-store-and-google-sync-loop
reviewed: 2026-09-15T16:30:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - scripts/spike-mailbox-sync.mts
  - src/adapters/caldav/client.ts
  - src/adapters/caldav/index.ts
  - src/adapters/caldav/reader.ts
  - src/config/env.ts
  - src/index.ts
  - src/store/mapping-store.ts
  - src/store/schema.sql
  - src/store/sync-state-store.ts
  - src/sync/run-sync-cycle.ts
  - src/sync/types.ts
  - src/writers/google/auth.ts
  - src/writers/google/calendar-writer.ts
findings:
  critical: 1
  warning: 4
  info: 1
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-09-15T16:30:00Z  
**Depth:** standard  
**Files Reviewed:** 13  
**Status:** issues_found

## Summary

Phase 03 delivers the CalDAV read path, SQLite mapping/sync state, Google Calendar writer, sync orchestration, and CLI. Structure and security-minded patterns (read-only CalDAV surface, credential redaction in errors and pino) are solid. One **critical** boot-time configuration bug makes the documented CLI path (`loadConfig()` with default `process.env`) incompatible with the stated SEC-04 design. Several **warnings** cover delete propagation gaps, duplicate Google events after re-activation, and unused sync error persistence.

## Critical Issues

### CR-01: Strict env check rejects the entire OS environment at CLI boot

**File:** `src/config/env.ts:67-76`, `src/config/env.ts:99-100`  
**Issue:** `assertNoUnknownEnvKeys` iterates every key on the object passed to `loadConfig`, and `loadConfig` defaults to `process.env`. A normal shell or container still has `PATH`, `HOME`, `NODE_*`, and dozens of other variables, so the first unknown key causes an immediate throw. That contradicts plan 03-02 (“runtime-safe with `process.env`” / pick only pilot keys at runtime) and breaks the operator flow in `README.md` (`tsx src/index.ts sync`). Tests avoid this by passing a minimal env object, so CI does not catch the regression.

**Fix:**
```typescript
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const picked = pickPilotEnv(env);

  // SEC-04: reject typos/extra pilot keys on isolated env objects (tests, injected env).
  // When using real process.env, only validate the picked pilot subset.
  if (env !== process.env) {
    for (const key of Object.keys(env)) {
      if (env[key] === undefined) continue;
      if (!(ENV_KEYS as readonly string[]).includes(key)) {
        throw new Error(`Invalid environment configuration: Unrecognized key: "${key}"`);
      }
    }
  }

  const parsed = envSchema.safeParse(picked);
  // ...
}
```

Optionally add a unit test that calls `loadConfig(process.env)` in a subprocess or with a stub `process.env` that includes a dummy `PATH` to lock the runtime behavior.

## Warnings

### WR-01: CalDAV deletes without href snapshot are silently dropped

**File:** `src/adapters/caldav/reader.ts:108-117`  
**Issue:** Tombstones are only added to `delta.deleted` when `mappingStore.resolveUidByHref` returns a UID. If the bridge never saw that href (cold start, snapshot cleared, or UID not extracted on prior poll), the delete never reaches `runSyncCycle` and the Google event stays active.

**Fix:** When `resolveUidByHref` misses, log at `warn` with redacted href and increment a metric/counter on the sync result; long term, fall back to scanning `event_mappings.caldav_href` or retaining tombstone hrefs until resolved.

### WR-02: Re-published event after `cancelled` mapping inserts a duplicate Google event

**File:** `src/sync/run-sync-cycle.ts:44-56`  
**Issue:** `existingGoogleEventId` is taken only when `mapping?.status === 'active'`. After a drop/delete flow sets status to `cancelled`, a later upsert treats the event as create (`existingGoogleEventId` undefined) while the old Google row may still exist (patch `status: cancelled`, not delete). Operators can see duplicate calendar entries for one source UID.

**Fix:** Reuse `mapping.googleEventId` when status is `cancelled` and call `upsertOutbound` with that id (and reset mapping to `active`), or explicitly delete the old Google event before insert.

### WR-03: `last_error` is never written on partial or fatal sync failure

**File:** `src/sync/run-sync-cycle.ts:164-165`, `src/store/sync-state-store.ts:133-138`  
**Issue:** `SyncStateStore` supports `lastError`, but only `recordSuccess` clears it. Per-event failures still call `recordSuccess` (by design D-18), and thrown errors in `index.ts` never update `last_error`. OPS-03 monitoring cannot distinguish “last cycle had errors” from a clean run using DB state alone.

**Fix:** When `result.errors > 0`, call `updateSyncState({ calendarUrl, lastError: 'partial_sync_errors' })` (or a summarized message); on caught CLI failure, `updateSyncState({ lastError: message })` before exit.

### WR-04: Two SQLite connections per sync cycle on the same file

**File:** `src/index.ts:41-42`  
**Issue:** `openMappingStore` and `openSyncStateStore` each open `better-sqlite3` against `config.sqlitePath`. Within one cycle both handles are live; without WAL/busy timeout, intermittent `SQLITE_BUSY` is possible under load or if watch mode overlaps.

**Fix:** Share one `Database` instance (single `openBridgeStore` facade) or enable `PRAGMA journal_mode=WAL` and `busy_timeout` once at open.

## Info

### IN-01: Minimal UID extraction may miss folded ICS lines

**File:** `src/adapters/caldav/reader.ts:46-48`  
**Issue:** `extractUidFromIcs` uses a single-line regex. RFC 5545 line folding can split `UID` across lines, leaving href snapshots without UID and weakening delete resolution (compounds WR-01).

**Fix:** Unfold ICS (`\r\n ` / `\n `) before regex, or delegate UID extraction to the existing ical parser used in `runSyncCycle`.

---

_Reviewed: 2026-09-15T16:30:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_

## Narrative Findings (AI reviewer)

The findings above are the authoritative list. Highest priority: fix **CR-01** before any real-operator CLI or Docker pilot run; the rest improve delete correctness, idempotency after cancel, and operability.
