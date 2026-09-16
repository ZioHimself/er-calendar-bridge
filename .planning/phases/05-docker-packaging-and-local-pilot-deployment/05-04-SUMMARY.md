---
phase: 05-docker-packaging-and-local-pilot-deployment
plan: 04
subsystem: infra
tags: [github-actions, docker, ghcr, ci, semver]

requires:
  - phase: 05-docker-packaging-and-local-pilot-deployment
    provides: Dockerfile and compose.yaml from plans 02–03
provides:
  - Fifth CI job docker-build gated on npm jobs
  - package.json 1.0.0 as semver source for image tags
  - Conditional GHCR push on main only
affects:
  - 05-05 operator runbooks and pilot docs

tech-stack:
  added: []
  patterns:
    - "Job-scoped packages:write for GHCR publish"
    - "Pinned docker/* GitHub Actions at audited SHAs"

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - src/index.ts
    - .github/workflows/ci.yml

key-decisions:
  - "package.json 1.0.0 is semver source for GHCR metadata-action tags"
  - "docker compose config validates compose.yaml after image build without provider secrets"

patterns-established:
  - "docker-build uses always() && !cancelled() guard so upstream job failures skip image work"

requirements-completed: [SYNC-17, TEST-05, OPS-04]

duration: 5min
completed: 2026-09-16
---

# Phase 5 Plan 04: CI Docker Build and GHCR Publish Summary

**GitHub Actions docker-build job after four npm gates; semver 1.0.0 tags and GHCR push only on main**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-16T18:29:00Z
- **Completed:** 2026-09-16T18:34:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Bumped `package.json` and `VERSION` in `src/index.ts` to **1.0.0** for v1.0 milestone tagging
- Appended **docker-build** as fifth CI job with `needs: [test, lint, typecheck, build]` and success-only `if` guard (D-19)
- GHCR image `ghcr.io/europeanresolve/er-calendar-bridge` builds on all workflow runs; **push** only on `push` to `main` (D-18, T-05-14)
- `packages: write` limited to docker-build job; workflow-level `contents: read` unchanged (T-05-12)
- Post-build `docker compose config` smoke without provider credentials

## Task Commits

1. **Task 1: Bump package version for GHCR semver tags** - `0aba76e` (feat)
2. **Task 2: Add docker-build job to CI** - `bbfc278` (feat)

**Plan metadata:** `4a85943` (docs: complete plan)

## Files Created/Modified

- `package.json` - version `1.0.0`
- `package-lock.json` - lockfile root version aligned with package.json
- `src/index.ts` - `VERSION` constant `1.0.0`
- `.github/workflows/ci.yml` - docker-build job with pinned Docker actions

## Decisions Made

- Synced `package-lock.json` version with `package.json` (not listed in plan files but required for consistent lock metadata)
- Used `docker compose config` after build-push instead of `docker run` native-module smoke (compose from 05-03; no image load required)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] package-lock.json version alignment**
- **Found during:** Task 1
- **Issue:** Plan listed only `package.json` and `src/index.ts`; lockfile still at `0.0.0`
- **Fix:** Updated root lockfile version fields to `1.0.0`
- **Files modified:** `package-lock.json`
- **Committed in:** `0aba76e`

---

**Total deviations:** 1 auto-fixed (missing critical consistency)
**Impact on plan:** No scope creep; keeps npm lock metadata consistent with semver tags.

## Issues Encountered

None

## User Setup Required

After first successful push to GHCR on `main`:

- GitHub → Packages → **er-calendar-bridge** → Package settings → set visibility **Public** (D-12, D-18)

## Next Phase Readiness

- CI image gate (TEST-05) in place for trunk; plan 05-05 can document operator `IMAGE=` pull and runbooks
- First main merge after this change should confirm metadata-action emits `1.0.0` and `latest` tags

## Self-Check: PASSED

- FOUND: `.planning/phases/05-docker-packaging-and-local-pilot-deployment/05-04-SUMMARY.md`
- FOUND: commit `0aba76e`
- FOUND: commit `bbfc278`

---
*Phase: 05-docker-packaging-and-local-pilot-deployment*
*Completed: 2026-09-16*
