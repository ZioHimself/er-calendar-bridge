---
phase: 04-microsoft-graph-writer-and-withhold-notifications
plan: 04
subsystem: notify
tags: [nodemailer, smtp, withhold, SYNC-14, D-09]

requires:
  - phase: 04-microsoft-graph-writer-and-withhold-notifications
    provides: WithholdNotifier port and SMTP env (04-03)
provides:
  - createWithholdNotifier factory with minimal English email template
  - Unit tests with mocked transport and jsonTransport path
affects:
  - 04-05 sync loop wiring

tech-stack:
  added: []
  patterns:
    - "Factory returns no-op WithholdNotifier when NOTIFY_OWNER_EMAIL unset"
    - "SMTP secure flag only when port 465"

key-files:
  created:
    - src/notify/withhold-notifier.ts
    - test/notify/withhold-notifier.test.ts
  modified: []

key-decisions:
  - "Static subject Calendar bridge: event disclosure limited (D-11)"
  - "Propagation described as busy block vs withheld in body without event PII (D-09)"

patterns-established:
  - "Pattern 2: nodemailer createTransport with injectable mock in vitest"

requirements-completed: [SYNC-14]

duration: 4min
completed: 2026-09-16
---

# Phase 04 Plan 04: Withhold SMTP Notifier Summary

**Nodemailer-based WithholdNotifier with PII-free English template, fixed subject, and CI-safe transport mocks**

## Performance

- **Duration:** 4 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `createWithholdNotifier` implements `WithholdNotifier` with no-op when notify email unset (D-05)
- Minimal plain-text body with tier, propagation, ER tag guidance, optional doc URL (D-09, D-10, D-12)
- Single `to` recipient, no BCC (D-07); SMTP errors return `{ status: 'failed' }` without throw (D-08)
- Ten unit tests including port 587/465 TLS behavior and jsonTransport integration

## Task Commits

1. **Task 1 (RED): Withhold notifier behavior tests** - `923fc44` (test)
2. **Task 2 (GREEN): createWithholdNotifier implementation** - `4afd702` (feat)

## Files Created/Modified

- `src/notify/withhold-notifier.ts` - Factory, `WITHHOLD_NOTIFY_SUBJECT`, `buildMinimalBody`
- `test/notify/withhold-notifier.test.ts` - Mocked nodemailer + jsonTransport coverage

## Deviations from Plan

None - plan executed as written. Test assertions adjusted during GREEN for propagation copy (`withheld` vs literal `drop`) and jsonTransport via `importActual` to avoid mock recursion.

## TDD Gate Compliance

- RED: `923fc44` test(04-04)
- GREEN: `4afd702` feat(04-04)

## Self-Check: PASSED

- FOUND: src/notify/withhold-notifier.ts
- FOUND: test/notify/withhold-notifier.test.ts
- FOUND: 923fc44
- FOUND: 4afd702
