---
phase: 01-project-scaffold-and-test-harness
plan: 01
subsystem: infra
tags: [typescript, vitest, eslint, node-ical, esm, node24]

requires: []
provides:
  - Strict TypeScript ESM project manifest with npm scripts (test, lint, typecheck, build)
  - Three-layer src/ layout (domain, adapters, sync) with domain type stubs
  - Committed package-lock.json with node-ical runtime dependency
  - .env.example config key documentation without secrets
affects: [01-02, 01-03, 01-04, 02-classification-washing-and-ical-domain-logic]

tech-stack:
  added: [node-ical@0.27.2, typescript@5.9.3, vitest@5.0.0, tsx@4.23.13, eslint@10.10.0, typescript-eslint@8.70.0]
  patterns: [NodeNext ESM imports, three-layer src layout, eslint flat config recommended preset]

key-files:
  created:
    - package.json
    - package-lock.json
    - tsconfig.json
    - vitest.config.ts
    - eslint.config.mjs
    - .gitignore
    - src/index.ts
    - src/domain/types/index.ts
    - .env.example
  modified: []

key-decisions:
  - "Minimal src/index.ts stub added in Task 1 so tsc compile graph has inputs before Task 2 scaffold"
  - "tsconfig excludes test/ — vitest compiles tests at runtime; tsconfig.test.json deferred to Phase 01.1"

patterns-established:
  - "Three-layer layout: domain/ (types), adapters/ (I/O), sync/ (orchestration) with .gitkeep placeholders"
  - "Domain types at src/domain/types/ — adapters import domain, never reverse"
  - "ESM NodeNext with .js extensions in relative imports (ready for future cross-module imports)"

requirements-completed: [TEST-01, OPS-04]

duration: 3min
completed: 2026-09-13
---

# Phase 01 Plan 01: Project Scaffold Summary

**Strict TypeScript ESM toolchain with three-layer src layout, domain type stubs, and node-ical runtime dependency pinned in lockfile**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-13T20:44:31Z
- **Completed:** 2026-09-13T20:47:46Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Bootstrapped npm project with Node 24.x engines, ESM `"type": "module"`, and four operational scripts (test, lint, typecheck, build)
- Installed and locked node-ical@0.27.2 runtime plus TypeScript/vitest/eslint dev toolchain per RESEARCH pin list
- Scaffolded three-layer `src/` layout with Tier, SourceEvent, and PropagationDecision domain type stubs
- Documented future config keys in `.env.example` with synthetic placeholders and read-only mailbox.org comment

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tooling configs and install dependencies** - `c70f8fc` (chore)
2. **Task 2: Scaffold source layout, domain types, and env template** - `01c5aa9` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `package.json` - ESM manifest with test/lint/typecheck/build scripts and Node 24.x engines
- `package-lock.json` - Reproducible dependency lock per D-10
- `tsconfig.json` - Strict TypeScript with NodeNext module resolution
- `vitest.config.ts` - Node environment test runner config
- `eslint.config.mjs` - Flat config with recommended presets (no Prettier per D-12)
- `.gitignore` - Excludes node_modules, dist, .env, .vitest
- `src/index.ts` - Entry stub exporting VERSION and main() with tsx direct-run guard
- `src/domain/types/index.ts` - Tier, SourceEvent, PropagationDecision type stubs
- `src/domain/.gitkeep`, `src/adapters/.gitkeep`, `src/sync/.gitkeep` - Empty folder placeholders per D-01/D-04
- `.env.example` - Placeholder config keys for CalDAV, OAuth, SMTP, and runtime settings

## Decisions Made

- Added minimal `src/index.ts` in Task 1 so `tsc` has compile inputs — expanded in Task 2 with main() and direct-run guard
- Accepted tsconfig exclusion of `test/` directory; vitest handles test compilation at runtime

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Minimal src/index.ts required for Task 1 build verification**
- **Found during:** Task 1 (Create tooling configs and install dependencies)
- **Issue:** `tsc` fails with TS18003 when `include: ["src/**/*.ts"]` matches no files; Task 1 verify requires build to produce `dist/index.js`
- **Fix:** Added `export const VERSION = '0.0.0'` stub in Task 1 commit; Task 2 expanded with main() and import.meta.url guard
- **Files modified:** src/index.ts
- **Verification:** `npm run typecheck && npm run lint && npm run build` pass
- **Committed in:** c70f8fc (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal stub was necessary for compile verification; Task 2 completed the planned entry point without scope creep.

## Issues Encountered

- Local Node v22.19.0 triggers EBADENGINE warning against `engines.node: "24.x"` — expected; CI/target runtime is Node 24 LTS

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Toolchain ready for plan 01-02 (iCal adapter and test helpers)
- `npm test` will fail until plan 01-04 adds smoke tests — expected per plan verification notes
- Domain type stubs ready for fixture harness and classify/wash modules in later plans

## Self-Check: PASSED

- All key artifacts present (package.json, tsconfig, src layout, SUMMARY)
- Task commits c70f8fc and 01c5aa9 verified in git history

---
*Phase: 01-project-scaffold-and-test-harness*
*Completed: 2026-09-13*
