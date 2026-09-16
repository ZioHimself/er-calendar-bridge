---
phase: 05-docker-packaging-and-local-pilot-deployment
plan: 02
subsystem: infra
tags: [docker, alpine, better-sqlite3, node-24, multi-stage]

requires:
  - phase: 05-01
    provides: Alpine better-sqlite3 spike (05-SPIKE-ALPINE.md) and secrets merge path
provides:
  - Production multi-stage Dockerfile (node:24-alpine, non-root)
  - .dockerignore excluding secrets/data from build context
  - Verified local image er-calendar-bridge:local
affects:
  - 05-03-compose
  - 05-04-ci-docker-build

tech-stack:
  added: []
  patterns:
    - "Multi-stage build: compile native modules in build stage, copy node_modules + dist to runtime"
    - "Default CMD sync --watch (D-13); credential-free smoke uses explicit node dist/index.js"

key-files:
  created:
    - Dockerfile
    - .dockerignore
  modified:
    - src/index.ts
    - src/secrets/resolve-env.ts

key-decisions:
  - "Skip npm prune in build stage per 05-SPIKE-ALPINE (copy full node_modules with musl binary)"
  - "Defer loadConfig until a subcommand is present for TEST-05 usage smoke"
  - "resolvePilotEnv mutates baseEnv in place so Docker NODE_* keys do not trip SEC-04 fixture check"

patterns-established:
  - "Image label org.opencontainers.image.source for GHCR linkage"
  - "Runtime USER node with chown on /app (D-16)"

requirements-completed: [SYNC-17, SEC-02, TEST-05]

duration: 5min
completed: 2026-09-16
---

# Phase 05 Plan 02: Production Dockerfile Summary

**Multi-stage `node:24-alpine` image with musl-compiled better-sqlite3, non-root runtime, and `sync --watch` default CMD — builds without secrets in context.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-16T18:23:00Z
- **Completed:** 2026-09-16T18:28:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `Dockerfile` build stage installs `python3 make g++`, runs `npm ci` + `tsc`, copies `node_modules` and `dist` to slim runtime
- `.dockerignore` excludes `.git`, `secrets`, `data`, `.env`, tests, and planning artifacts from build context
- `docker build -t er-calendar-bridge:local .` succeeds; `better-sqlite3` loads in container; bare CLI prints usage without provider env

## Task Commits

1. **Task 1: Multi-stage Dockerfile and .dockerignore** - `dd65cab` (feat)
2. **Task 2: Runtime smoke — better-sqlite3 and CLI usage** - `67c3684` (fix)

## Files Created/Modified

- `Dockerfile` - AS build/runtime stages, `USER node`, CMD `sync --watch`
- `.dockerignore` - SEC-02 context exclusions
- `src/index.ts` - usage before `loadConfig` when argv empty
- `src/secrets/resolve-env.ts` - in-place secret merge preserves `process.env` identity

## Decisions Made

- Followed spike doc: no `npm prune --omit=dev` (unverified for native module)
- Compose (Plan 05-03) can keep default CMD; smoke tests override with explicit `node` invocations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Docker runtime env validation**
- **Found during:** Task 2 (runtime smoke)
- **Issue:** `resolvePilotEnv` spread `process.env` into a new object, so `loadConfig` treated Docker `NODE_VERSION` as an unrecognized pilot key; empty argv also failed before usage
- **Fix:** In-place merge in `resolvePilotEnv`; print usage before `loadConfig` when no subcommand
- **Files modified:** `src/secrets/resolve-env.ts`, `src/index.ts`
- **Verification:** `docker run ... node dist/index.js` greps Usage; `npm test` 114 passed
- **Committed in:** `67c3684`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Required for TEST-05 credential-free checks and correct container startup with real `process.env`.

## Issues Encountered

None beyond deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Image `er-calendar-bridge:local` ready for `compose.yaml` (05-03) with secret file mounts
- CI docker-build job (05-04) can reuse same Dockerfile context

## Self-Check: PASSED

- FOUND: Dockerfile
- FOUND: .dockerignore
- FOUND: commit dd65cab
- FOUND: commit 67c3684

---
*Phase: 05-docker-packaging-and-local-pilot-deployment*
*Completed: 2026-09-16*
