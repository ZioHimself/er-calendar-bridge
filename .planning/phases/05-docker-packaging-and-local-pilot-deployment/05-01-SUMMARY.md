---
phase: 05-docker-packaging-and-local-pilot-deployment
plan: 01
subsystem: infra
tags: [docker, secrets, compose, better-sqlite3, alpine, vitest]

requires:
  - phase: 04-microsoft-graph-writer-and-withhold-notifications
    provides: loadConfig env validation and CLI main() entry
provides:
  - Compose file SecretProvider and resolvePilotEnv merge before loadConfig
  - Root /secrets/ and /data/ gitignore for operator credentials and SQLite
  - Verified Alpine better-sqlite3 native build notes for Dockerfile plan
affects:
  - 05-02-PLAN.md
  - 05-03-PLAN.md

tech-stack:
  added: []
  patterns:
    - "SecretProvider port with compose /run/secrets file implementation"
    - "Env wins over file-backed secrets in resolvePilotEnv"

key-files:
  created:
    - src/secrets/types.ts
    - src/secrets/file-provider.ts
    - src/secrets/resolve-env.ts
    - test/secrets/file-provider.test.ts
    - test/secrets/resolve-env.test.ts
    - .planning/phases/05-docker-packaging-and-local-pilot-deployment/05-SPIKE-ALPINE.md
  modified:
    - src/index.ts
    - .gitignore

key-decisions:
  - "Use /secrets/ and /data/ gitignore anchors so src/secrets/ remains trackable"
  - "Alpine build stage uses apk python3 make g++ and npm ci before copying dist"

patterns-established:
  - "resolvePilotEnv(baseEnv, provider) shallow-clones env; empty env values backfill from compose filenames"

requirements-completed: [SEC-02, SEC-05, TEST-05, OPS-02]

duration: 18min
completed: 2026-09-16
---

# Phase 05 Plan 01: Secrets accessor and Alpine spike Summary

**Compose `/run/secrets` filenames merge into pilot env before `loadConfig`, with env precedence and Alpine-native `better-sqlite3` build verified for the Dockerfile plan.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-16T18:20:00Z
- **Completed:** 2026-09-16T18:38:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- TDD secrets module: file provider, `COMPOSE_SECRET_TO_ENV` mapping, `resolvePilotEnv`
- `main()` calls `loadConfig(resolvePilotEnv(env))` so tests keep injecting env without mount dirs
- Root operator `secrets/` and `data/` excluded from git; spike doc PASS for `node:24-alpine` + `better-sqlite3`

## Task Commits

1. **Task 1 (RED): Failing secrets provider tests** - `43ad4ae` (test)
2. **Task 2 (GREEN): Secrets module and CLI wiring** - `4698812` (feat)
3. **Task 3: Alpine better-sqlite3 build spike** - `4bd3af6` (docs)

## Files Created/Modified

- `src/secrets/types.ts` - `SecretProvider` interface
- `src/secrets/file-provider.ts` - `createComposeFileSecretProvider`
- `src/secrets/resolve-env.ts` - `COMPOSE_SECRET_TO_ENV`, `resolvePilotEnv`
- `src/index.ts` - resolve secrets before config in `main()`
- `test/secrets/*.test.ts` - provider, precedence, redaction, loadConfig integration
- `.gitignore` - `/secrets/`, `/data/`
- `05-SPIKE-ALPINE.md` - native module build verification

## Decisions Made

- Gitignore uses `/secrets/` and `/data/` (repo root only) so `src/secrets/` is not ignored
- Dockerfile build stage should compile deps on Alpine and copy `node_modules` + `dist` (see spike doc)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Root-only gitignore paths**
- **Found during:** Task 2 (GREEN)
- **Issue:** `secrets/` in `.gitignore` blocked staging `src/secrets/*` (git treats `secrets/` as any path segment)
- **Fix:** Changed to `/secrets/` and `/data/`; verified `git check-ignore secrets/operator/foo` and `src/secrets` not ignored
- **Files modified:** `.gitignore`
- **Committed in:** `4698812`

---

**Total deviations:** 1 auto-fixed (1 blocking)  
**Impact on plan:** Required for SEC-02 and to ship the secrets source module; no scope creep.

## Issues Encountered

None beyond gitignore path collision (handled as deviation).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-02 can author Dockerfile using spike build-stage commands
- Compose plans can mount operator files to `/run/secrets` without changing domain/sync code

---
*Phase: 05-docker-packaging-and-local-pilot-deployment*  
*Completed: 2026-09-16*

## Self-Check: PASSED

- FOUND: src/secrets/resolve-env.ts
- FOUND: test/secrets/resolve-env.test.ts
- FOUND: 05-SPIKE-ALPINE.md
- FOUND: commit 43ad4ae
- FOUND: commit 4698812
- FOUND: commit 4bd3af6
