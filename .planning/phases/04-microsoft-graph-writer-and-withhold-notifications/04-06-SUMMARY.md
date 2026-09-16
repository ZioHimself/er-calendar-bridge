---
phase: 04-microsoft-graph-writer-and-withhold-notifications
plan: 06
subsystem: cli
tags: [audit, cli, sqlite, vitest, SYNC-16, OPS-03, D-15, D-16]

requires:
  - phase: 04-microsoft-graph-writer-and-withhold-notifications
    provides: openAuditStore listAuditSince and sync-populated withhold_audit
provides:
  - Operator audit list CLI with optional --since ISO-8601 filter
  - CLI smoke tests and README withhold inspect guidance
affects:
  - Phase 5 Docker operator docs

tech-stack:
  added: []
  patterns:
    - "main(argv, env) injectable for CLI tests without subprocess spawn"
    - "Tab-separated audit list output with explicit column header"

key-files:
  created:
    - test/cli/audit-list.test.ts
  modified:
    - src/index.ts
    - README.md

key-decisions:
  - "Default audit list since epoch when --since omitted"
  - "ISO-8601 --since validated via Zod refine on Date.parse"

patterns-established:
  - "printUsage documents sync and audit list subcommands"

requirements-completed: [SYNC-16, OPS-03]

duration: 5min
completed: 2026-09-16
---

# Phase 04 Plan 06: Audit List CLI Summary

**Operator-facing `audit list [--since]` reads SQLite withhold audit with PII-free TSV columns and documented pilot usage.**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `audit list` subcommand using `listAuditSince` on `config.sqlitePath`
- CLI tests cover full list, `--since` filter, invalid timestamp exit, and D-16 column expectations
- README Operator section documents withhold audit inspect, optional notify email, and `TAG_GUIDANCE_URL`

## Task Commits

1. **Task 1 (RED): audit list CLI tests** - `7467bb8` (test)
2. **Task 2 (GREEN): audit list subcommand and README** - `468b9c2` (feat)

## Files Created/Modified

- `test/cli/audit-list.test.ts` - Vitest coverage via `main(argv, env)` with temp sqlite seed
- `src/index.ts` - `runAuditList`, `printUsage`, `main` env injection, ISO `--since` validation
- `README.md` - Withhold audit (OPS-03) operator instructions

## Deviations from Plan

None — plan executed as written.

## Self-Check: PASSED

- FOUND: test/cli/audit-list.test.ts
- FOUND: src/index.ts
- FOUND: README.md
- FOUND: 7467bb8
- FOUND: 468b9c2
