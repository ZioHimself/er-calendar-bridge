---
phase: 01-project-scaffold-and-test-harness
plan: 02
subsystem: testing
tags: [node-ical, vitest, fixtures, ical, SourceEvent, adapter]

requires:
  - phase: 01-01
    provides: TypeScript ESM scaffold, domain SourceEvent types, node-ical dependency
provides:
  - node-ical adapter mapping VEvent to SourceEvent at src/adapters/ical/
  - Shared test helpers loadFixture, parseIcs, getCategories, assertTier
  - Four classification-tier fixture pairs with .expected.json sidecars
affects: [01-03, 01-04, 02-classification-washing-and-ical-domain-logic]

tech-stack:
  added: []
  patterns: [node-ical confined to adapter layer, fixture+sidecar pairing, SourceEvent parsing boundary]

key-files:
  created:
    - src/adapters/ical/parse-source-event.ts
    - src/adapters/ical/index.ts
    - test/helpers/load-fixture.ts
    - test/helpers/parse-ics.ts
    - test/helpers/assert-sidecar.ts
    - test/fixtures/public/board-meeting.ics
    - test/fixtures/public/board-meeting.expected.json
    - test/fixtures/internal/team-sync.ics
    - test/fixtures/internal/team-sync.expected.json
    - test/fixtures/sensitive/hr-review.ics
    - test/fixtures/sensitive/hr-review.expected.json
    - test/fixtures/untagged/unclassified.ics
    - test/fixtures/untagged/unclassified.expected.json
  modified: []

key-decisions:
  - "Untagged fixture omits CATEGORIES property entirely per RESEARCH Open Question 2"
  - "assertTier scaffold compares uid/categories only; washed-field comparison deferred to Phase 2"

patterns-established:
  - "node-ical imported only in src/adapters/ical/parse-source-event.ts — domain and tests use SourceEvent"
  - "Fixture sidecar schema: uid, categories, tier, propagation, washed"
  - "Synthetic @er.example UIDs in all fixtures — no real PII"

requirements-completed: [TEST-02]

duration: 1min
completed: 2026-09-13
---

# Phase 01 Plan 02: iCal Adapter and Fixture Library Summary

**node-ical adapter with SourceEvent boundary, shared test helpers, and four classification-tier fixture pairs with sidecars**

## Performance

- **Duration:** 1 min
- **Started:** 2026-09-13T20:49:31Z
- **Completed:** 2026-09-13T20:50:24Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Created `parseIcsToSourceEvent()` adapter as sole `node-ical` import site, mapping VEvent fields to domain `SourceEvent`
- Built three test helpers (`loadFixture`, `parseIcs`, `assertTier`) establishing fixture-driven harness API per D-15
- Added four tier fixture pairs (public, internal, sensitive, untagged) with `.expected.json` sidecars per D-05/D-06/D-08
- Untagged fixture omits `CATEGORIES` property entirely for fail-closed classification testing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create node-ical adapter and test helpers** - `c9e75ff` (feat)
2. **Task 2: Create classification-tier fixture pairs** - `ef2f894` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `src/adapters/ical/parse-source-event.ts` - Maps node-ical VEvent to SourceEvent with ParameterValue normalization
- `src/adapters/ical/index.ts` - Re-exports adapter functions
- `test/helpers/load-fixture.ts` - Async loader for tier/name fixture pairs
- `test/helpers/parse-ics.ts` - Thin wrapper over adapter; no direct node-ical import
- `test/helpers/assert-sidecar.ts` - assertTier scaffold for uid/categories comparison
- `test/fixtures/public/board-meeting.{ics,expected.json}` - ER-PUBLIC tier, propagation full
- `test/fixtures/internal/team-sync.{ics,expected.json}` - ER-INTERNAL tier, propagation busy
- `test/fixtures/sensitive/hr-review.{ics,expected.json}` - ER-SENSITIVE tier, propagation drop
- `test/fixtures/untagged/unclassified.{ics,expected.json}` - No CATEGORIES, propagation busy

## Decisions Made

- Untagged fixture omits CATEGORIES property entirely (not empty line) per resolved RESEARCH open question
- assertTier compares uid and categories only; full washed-field sidecar comparison deferred to Phase 2

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Adapter and helpers ready for plan 01-03 (recurrence fixtures in `test/fixtures/recurrence/`)
- Plan 01-04 can wire smoke tests using loadFixture + parseIcs + assertTier
- `npm test` still has no test files until plan 01-04 — expected

## Self-Check: PASSED

- All key artifacts present (adapter, helpers, 4 fixture pairs)
- Task commits c9e75ff and ef2f894 verified in git history

---
*Phase: 01-project-scaffold-and-test-harness*
*Completed: 2026-09-13*
