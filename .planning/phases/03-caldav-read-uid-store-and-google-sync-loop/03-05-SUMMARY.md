---
phase: 03-caldav-read-uid-store-and-google-sync-loop
plan: 05
subsystem: integrations
tags: [googleapis, google-auth-library, calendar-writer, SEC-03, SYNC-05, SYNC-07, tdd]

requires:
  - phase: 03-caldav-read-uid-store-and-google-sync-loop
    plan: 02
    provides: CalendarWriter port and AppConfig Google fields
  - phase: 03-caldav-read-uid-store-and-google-sync-loop
    plan: 03
    provides: mapping store keys for writer wiring in 03-06
provides:
  - createGoogleAuthClient and GOOGLE_CALENDAR_SCOPE (SEC-03)
  - createGoogleCalendarWriter with busy/opaque mapping, iCalUID, cancel-not-delete
affects:
  - 03-06-sync-cycle

tech-stack:
  added: []
  patterns:
    - "googleapis imports confined to src/writers/google/"
    - "events.patch status cancelled — never events.delete (D-04)"
    - "Recurrence instances set originalStartTime on create (D-13)"

key-files:
  created:
    - src/writers/google/auth.ts
    - src/writers/google/calendar-writer.ts
    - test/writers/google-auth.test.ts
    - test/writers/calendar-writer.test.ts
  modified: []

key-decisions:
  - "GOOGLE_CALENDAR_SCOPE uses full calendar scope per RESEARCH A3"
  - "Bridge metadata key er.bridge_uuid in extendedProperties.private (D-14)"

patterns-established:
  - "Busy detection via summary === Busy mirrors wash-source-event output"
  - "vi.hoisted mocks for googleapis calendar.events in unit tests"

requirements-completed: [SEC-03, SYNC-05, SYNC-07]

duration: 12min
completed: 2026-09-15
---

# Phase 03 Plan 05: Google Calendar writer Summary

**Mock-tested Google Calendar writer with calendar-only OAuth scope, busy opaque payloads, iCalUID on create, and cancel-not-delete recurrence instance handling.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-15T15:54:49Z
- **Completed:** 2026-09-15T16:06:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- RED/GREEN TDD for `test/writers/google-auth.test.ts` and `test/writers/calendar-writer.test.ts` (seven cases, no network).
- `createGoogleAuthClient` wires refresh token via `google-auth-library` OAuth2Client.
- `createGoogleCalendarWriter` implements `CalendarWriter`: insert/patch mapping, `iCalUID` + `er.bridge_uuid` on create, instance `originalStartTime` when `recurrenceId` present.

## Task Commits

1. **Task 1 (RED): Google auth scope and writer mapping tests** - `c1e6f19` (test)
2. **Task 2 (GREEN): Google auth and CalendarWriter implementation** - `4bd6066` (feat)

## Files Created/Modified

- `src/writers/google/auth.ts` - SEC-03 scope constant and OAuth client factory
- `src/writers/google/calendar-writer.ts` - Google API writer implementing sync port
- `test/writers/google-auth.test.ts` - scope and credential tests
- `test/writers/calendar-writer.test.ts` - mocked insert/patch/cancel behaviors

## Decisions Made

- Full `https://www.googleapis.com/auth/calendar` scope constant (documented for offline token generation).
- Public/full outbound events pass description/location; busy path strips to opaque busy-block fields only.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

Pilot runs need `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (offline flow with calendar scope only), and `GOOGLE_CALENDAR_ID` — already validated in `loadConfig`. CI uses mocks only.

## Self-Check: PASSED

- FOUND: src/writers/google/auth.ts
- FOUND: src/writers/google/calendar-writer.ts
- FOUND: test/writers/google-auth.test.ts
- FOUND: test/writers/calendar-writer.test.ts
- FOUND: commit c1e6f19
- FOUND: commit 4bd6066
