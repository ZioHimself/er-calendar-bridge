---
phase: 04-microsoft-graph-writer-and-withhold-notifications
plan: 03
subsystem: config
tags: [zod, smtp, notify, sec-04, withhold]

requires:
  - phase: 04-microsoft-graph-writer-and-withhold-notifications
    provides: withhold transition types and episode semantics (04-01)
provides:
  - AppConfig optional notify/SMTP fields with D-05 conditional validation
  - WithholdNotifier port for injectable SMTP in sync tests
affects:
  - 04-04 withhold-notifier factory
  - 04-05 sync loop integration

tech-stack:
  added: []
  patterns:
    - "D-05: SMTP required only when NOTIFY_OWNER_EMAIL set"
    - "SECRET_ENV_KEYS redaction for SMTP_PASSWORD"

key-files:
  created:
    - src/notify/types.ts
  modified:
    - src/config/env.ts
    - test/config/env.test.ts
    - .env.example

key-decisions:
  - "NOTIFY_OWNER_EMAIL gates SMTP_HOST, SMTP_PORT, SMTP_FROM via Zod superRefine"
  - "TAG_GUIDANCE_URL empty string omitted from AppConfig (D-12)"
  - "WithholdNotifyParams carry tier, propagation, dedupKey only (D-09)"

patterns-established:
  - "Notify port in src/notify/types.ts separate from nodemailer implementation"

requirements-completed: [SYNC-14]

duration: 5min
completed: 2026-09-16
---

# Phase 04 Plan 03: Notify env and WithholdNotifier port Summary

**Strict env allowlist extended for SMTP/notify keys with D-05 gated validation and a mock-friendly WithholdNotifier port.**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended `ENV_KEYS` and Zod schema for Phase 4 SMTP and notify settings; unknown keys still rejected (SEC-04).
- Conditional SMTP requirement when `NOTIFY_OWNER_EMAIL` is set; pilot sync works without mail configured (D-05).
- `WithholdNotifier` interface with minimal params for later factory and sync injection (D-09, D-15).

## Task Commits

1. **Task 1 (RED): Env and notify port contract tests** - `8d45ced` (test)
2. **Task 2 (GREEN): loadConfig SMTP/notify fields and ENV_KEYS** - `77a0d88` (feat)

## Files Created/Modified

- `src/notify/types.ts` - WithholdNotifier port and WithholdNotifyParams
- `src/config/env.ts` - ENV_KEYS, SECRET_ENV_KEYS, superRefine, AppConfig mapping
- `test/config/env.test.ts` - D-05, SEC-04 SMTP_EXTRA, TAG_GUIDANCE_URL, secret redaction
- `.env.example` - Commented NOTIFY_OWNER_EMAIL and TAG_GUIDANCE_URL

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/notify/types.ts
- FOUND: src/config/env.ts
- FOUND: test/config/env.test.ts
- FOUND: .env.example
- FOUND: 8d45ced
- FOUND: 77a0d88
