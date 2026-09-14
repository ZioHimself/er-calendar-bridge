---
phase: 02-classification-washing-and-ical-domain-logic
plan: 01
subsystem: domain
tags: [classification, tdd, vitest]

requires:
  - phase: 01-project-scaffold-and-test-harness
    provides: SourceEvent types and fixture harness
provides:
  - classifySourceEvent with fail-closed decision table
  - Classification, OutboundEvent, ProcessedSourceEvent types
affects: [02-02 wash, 02-03 pipeline fixtures]

tech-stack:
  added: []
  patterns: [restrict-only classifier, ER token normalization]

key-files:
  created:
    - src/domain/classify/classify-source-event.ts
    - src/domain/classify/index.ts
    - test/domain/classify.test.ts
  modified:
    - src/domain/types/index.ts

key-decisions:
  - "Unknown/non-ER categories fail closed to internal+busy"
  - "Full propagation only when ER-PUBLIC alone with no other tokens"

patterns-established:
  - "Pattern 1: single classify gate — washer must not re-derive tier"

requirements-completed: [SYNC-02, SYNC-03, SYNC-05, SYNC-08]

duration: 5min
completed: 2026-09-14
---

# Phase 02 Plan 01 Summary

**Fail-closed `classifySourceEvent()` and domain types for wash/orchestrator.**

## Performance

- **Duration:** 5 min
- **Tasks:** 2

## Accomplishments

- Extended `domain/types` with `Classification`, `OutboundEvent`, `ProcessedSourceEvent`
- Implemented RESEARCH Pattern 1 decision table with case/trim normalization
- Nine unit tests cover sensitive, untagged, public-only, mixed, and unknown paths

## Task Commits

1. **Task 1 (RED)** - `350a243` (test)
2. **Task 2 (GREEN)** - (feat commit follows)

## Self-Check: PASSED

- `npm test -- test/domain/classify.test.ts` — pass
- `npm run typecheck` — pass
