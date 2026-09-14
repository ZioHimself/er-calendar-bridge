---
phase: 02-classification-washing-and-ical-domain-logic
plan: 02
subsystem: domain
tags: [washing, tdd, vitest]

requires:
  - phase: 02-classification-washing-and-ical-domain-logic
    provides: classifySourceEvent and domain types
provides:
  - washSourceEvent decision-driven washer
  - processSourceEvent orchestrator
affects: [02-03 pipeline fixtures, phase 3 sync]

tech-stack:
  added: []
  patterns: [whitelist busy wash, propagation-only washer]

key-files:
  created:
    - src/domain/wash/wash-source-event.ts
    - src/domain/wash/index.ts
    - src/domain/process-source-event.ts
    - test/domain/wash.test.ts

requirements-completed: [SYNC-04, SYNC-09, SYNC-10, SYNC-08]

duration: 5min
completed: 2026-09-14
---

# Phase 02 Plan 02 Summary

**Decision-driven washing and `processSourceEvent` compose classify + wash without re-classifying.**

## Self-Check: PASSED

- `npm test -- test/domain/wash.test.ts` — pass
- `npm run typecheck` — pass
