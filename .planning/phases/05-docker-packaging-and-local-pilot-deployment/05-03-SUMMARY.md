---
phase: 05-docker-packaging-and-local-pilot-deployment
plan: 03
subsystem: infra
tags: [docker, compose, ghcr, secrets]

requires:
  - phase: 05-01
    provides: COMPOSE_SECRET_TO_ENV mapping and file secret provider
provides:
  - compose.yaml pilot bridge-operator service
  - compose.notify.yaml SMTP secret overlay
  - secrets/operator onboarding README and .gitignore exceptions
affects: [05-04, 05-05, docker-pilot runbooks]

tech-stack:
  added: [Docker Compose secrets file mounts]
  patterns: [per-member secrets/<member>/ dirs; IMAGE from .env; no published ports]

key-files:
  created: [compose.yaml, compose.notify.yaml, secrets/operator/README.md, secrets/operator/.gitkeep]
  modified: [.env.example, .gitignore]

key-decisions:
  - "smtp_password only in compose.notify.yaml overlay so base docker compose config needs four secret files"
  - "Omit explicit command in compose.yaml; rely on image CMD sync --watch when available"

patterns-established:
  - "Compose secret filenames match resolve-env COMPOSE_SECRET_TO_ENV keys"
  - "Gitignore /secrets/* with negation for operator README and .gitkeep only"

requirements-completed: [SYNC-17, SEC-02, SEC-04, OPS-01]

duration: 5min
completed: 2026-09-16
---

# Phase 05 Plan 03: Compose Pilot Stack Summary

**GHCR-backed Compose pilot with file-mounted secrets, operator data bind mount, and optional SMTP notify overlay**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-16T18:23:00Z
- **Completed:** 2026-09-16T18:28:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `compose.yaml` defines `bridge-operator` with `${IMAGE}`, `unless-stopped`, four Compose secrets, `./data/operator:/data`, no `ports`
- `compose.notify.yaml` adds `smtp_password` for withhold email when `NOTIFY_OWNER_EMAIL` is set
- `.env.example` documents `IMAGE` and Docker `DATA_DIR`; credentials point to `secrets/operator/` files
- `secrets/operator/README.md` lists required filenames aligned with `resolve-env.ts`

## Task Commits

1. **Task 1: compose.yaml pilot operator service** - `7ac9d1e` (feat)
2. **Task 2: .env.example and secrets onboarding docs** - `67ac66f` (feat)

**Plan metadata:** `3d39902` (docs: complete plan)

## Files Created/Modified

- `compose.yaml` - Pilot operator service and copy-paste member stub
- `compose.notify.yaml` - Optional SMTP secret overlay
- `.env.example` - IMAGE, DATA_DIR, secret file pointers
- `.gitignore` - Track operator README/.gitkeep under ignored secrets tree
- `secrets/operator/README.md` - Onboarding table for secret filenames
- `secrets/operator/.gitkeep` - Preserve directory in git

## Decisions Made

- Base compose validates without `smtp_password` file; notify overlay is opt-in per plan interfaces
- Commented second-service block documents D-01 multi-member pattern without enabling a second container

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `docker compose config` requires a host `.env` when `env_file: .env` is set; verification used `touch .env` (gitignored, operator copies from `.env.example` in real deploys)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Operator can populate `secrets/operator/*`, copy `.env.example` → `.env`, and run `docker compose config` / `up` once `IMAGE` is published (05-02 Dockerfile/CI)
- Notify path documented: `docker compose -f compose.yaml -f compose.notify.yaml up -d`

---
*Phase: 05-docker-packaging-and-local-pilot-deployment*
*Completed: 2026-09-16*

## Self-Check: PASSED

- FOUND: compose.yaml
- FOUND: compose.notify.yaml
- FOUND: secrets/operator/README.md
- FOUND: 7ac9d1e
- FOUND: 67ac66f
