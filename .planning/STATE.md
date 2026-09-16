---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Google-only pilot
status: executing
stopped_at: Phase 04 context gathered
last_updated: "2026-09-16T08:53:58.828Z"
last_activity: 2026-09-16 -- Phase 04 planning complete
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 4
  completed_plans: 16
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-13)

**Core value:** Sensitive calendar information never leaks to Google or Microsoft — untagged and internal events propagate only as busy-blocks; sensitive events are withheld entirely.

**Current focus:** Phase 04 — microsoft graph writer and withhold notifications

## Current Position

Phase: 04
Plan: Not started
Status: Ready to execute
Last activity: 2026-09-16 -- Phase 04 planning complete

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 20
- Average duration: 2 min
- Total execution time: 0.09 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-project-scaffold-and-test-harness | 4 | 6 min | 2 min |
| 02 | 3 | - | - |
| 03-caldav-read-uid-store-and-google-sync-loop | 5 | 30 min | 6 min |
| 03 | 6 | - | - |

| Phase 03-caldav-read-uid-store-and-google-sync-loop P05 | 12 min | 2 tasks | 4 files |

| Phase 03-caldav-read-uid-store-and-google-sync-loop P04 | 5 min | 3 tasks | 7 files |

| Phase 03-caldav-read-uid-store-and-google-sync-loop P03 | 2 min | 2 tasks | 4 files |

**Recent Trend:**

- Last 5 plans: 01-01 (3 min), 01-02 (1 min), 01-03 (1 min), 01-04 (1 min)
- Trend: —

| Phase 03-caldav-read-uid-store-and-google-sync-loop P02 | 3 min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

- Minimal src/index.ts stub added in Task 1 so tsc compile graph has inputs before Task 2 scaffold
- tsconfig excludes test/ — vitest compiles tests at runtime; tsconfig.test.json deferred to Phase 01.1
- Untagged fixture omits CATEGORIES property entirely per RESEARCH Open Question 2
- assertTier scaffold compares uid/categories only; washed-field comparison deferred to Phase 2
- [Phase 01]: deleted-instance uses EXDATE on master rather than STATUS:CANCELLED exception VEVENT
- [Phase 01]: modified-instance follows RESEARCH Pattern 4 multi-VEVENT example with consistent Europe/Brussels TZID
- [Phase 01]: Smoke tests use parameterized TIER_FIXTURES array with branch on untagged for empty categories
- [Phase 01]: Recurrence fixtures asserted for truthy uid only — category/tier assertions deferred to Phase 2
- [2026-09-13]: v1.0 milestone scoped to Google-only pilot; Microsoft Graph deferred to v1.1 (Phase 6)
- [2026-09-13]: Phase 4 split — withhold notifications separated from Microsoft Graph writer
- [Phase 03]: Wave 0 default CalDAV degraded_mode basic_sync until live mailbox.org spike confirms webdav_sync
- [Phase 03]: spike:mailbox-sync script is read-only (no tsdav write APIs)
- [Phase 03]: Unknown env keys rejected via allowlist before Zod parse (runtime-safe with process.env)
- [Phase 03]: Default sqlite path ./data/bridge.db when DATA_DIR and SQLITE_PATH unset
- [Phase 03]: Master event_mappings rows use empty-string recurrence_id for composite PK (D-06)
- [Phase 03]: Tombstone href routing via source_href_snapshot table (D-05)
- [Phase 03]: CalDavReader poll defaults to basic_sync; webdav_sync when stored in sync_state
- [Phase 03]: Tombstone deleted[] entries require resolved source uid from href snapshot (D-05)
- [Phase 03]: GOOGLE_CALENDAR_SCOPE uses full calendar scope; writer maps busy via summary Busy and opaque transparency
- [Phase 03]: Google writer stores er.bridge_uuid in extendedProperties.private on create (D-14)

### Roadmap Evolution

- Phase 1 added: Project scaffold and test harness
- Phase 2 added: Classification, washing, and iCal domain logic
- Phase 3 added: CalDAV read, UID store, and Google sync loop
- Phase 4 added: Microsoft Graph writer and withhold notifications
- Phase 5 added: Docker packaging and local pilot deployment
- Phase 6 added: CI pipeline
- Phase 6 removed; Phase 01.1 inserted after Phase 1: CI pipeline
- Phase 4 split (2026-09-13): Withhold notifications and audit log (v1.0)
- Phase 5 redefined (2026-09-13): Docker packaging — v1.0 milestone completion (Google-only)
- Phase 6 added (2026-09-13): Microsoft Graph writer (v1.1, post Google pilot)

### Pending Todos

None yet.

### Blockers/Concerns

- mailbox.org live spike re-run recommended to upgrade 03-SPIKE-SYNC.md from research synthesis to operator-verified
- Recurrence exceptions remain highest-risk translation case — fixture coverage mandatory in Phases 1–3

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v1.1 | Microsoft Graph writer (SYNC-22, SEC-06) | Planned Phase 6 | 2026-09-13 |

## Session Continuity

Last session: 2026-09-16T08:43:23.477Z
Stopped at: Phase 04 context gathered
