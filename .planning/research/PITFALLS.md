# Pitfalls Research

**Domain:** CalDAV ↔ Google/Graph calendar sync (TypeScript)
**Researched:** 2026-09-11
**Confidence:** HIGH

## Critical Pitfalls

### 1. Recurrence exception mishandling

**Warning signs:** Duplicate instances, missing cancellations, orphan exceptions after series edit
**Prevention:** Fixture tests from real mailbox.org exports; explicit RECURRENCE-ID handling; never expand full series every poll
**Phase:** Writer + sync loop

### 2. Full-content leak on untagged events

**Warning signs:** Event titles visible in Google/Outlook without `ER-PUBLIC`
**Prevention:** Classifier defaults to Internal; washer builds outbound from scratch; no passthrough code path; integration test per tier
**Phase:** Classify + wash

### 3. Duplicate events on restart

**Warning signs:** Multiple "Busy" blocks for same meeting after container restart
**Prevention:** SQLite UID map; upsert keyed on source UID + `iCalUID` where APIs support it
**Phase:** Store + writers

### 4. Stale events after source deletion

**Warning signs:** Cancelled mailbox.org events still appear externally
**Prevention:** Propagate tombstones; track deleted UIDs; don't skip DELETE on sync errors silently
**Phase:** Sync loop

### 5. PII in busy-blocks

**Warning signs:** Attendee names or locations in "Busy" events
**Prevention:** Washer whitelist fields only (start, end, id, label); strip CATEGORIES tag itself
**Phase:** Wash

### 6. mailbox.org ~1 year horizon

**Warning signs:** Far-future events never appear; reported as sync bug
**Prevention:** Document window in README; log when events fall outside fetch range
**Phase:** CalDAV reader

### 7. OAuth token scope creep

**Warning signs:** Tokens grant mail/drive access
**Prevention:** Request calendar scope only; verify granted scopes at setup
**Phase:** Auth setup

### 8. Shared secrets across containers

**Warning signs:** One env file with all members' passwords
**Prevention:** Docker secret per service; zod validates only expected keys per container
**Phase:** Docker

### 9. TypeScript datetime / TZ confusion

**Warning signs:** `Date` vs string TZID mismatches; off-by-one-hour around DST
**Prevention:** Normalize to UTC internally; use typed `ICalDateTime`; test DST boundary fixtures
**Phase:** ical module

### 10. Assuming tsdav handles all sync semantics

**Warning signs:** Full calendar re-fetch every cycle; slow sync; rate limits
**Prevention:** Spike `sync-collection` on mailbox.org; fall back to raw REPORT if needed
**Phase:** CalDAV spike (Phase 0)
