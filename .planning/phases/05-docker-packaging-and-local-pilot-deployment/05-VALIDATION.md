---
phase: 05
slug: docker-packaging-and-local-pilot-deployment
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-16
updated: 2026-09-16
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^5.0.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npm run lint && npm run typecheck && npm run build` |
| **Docker gate** | `docker build -t er-calendar-bridge:ci .` (CI `docker-build` job) |
| **Estimated runtime** | ~45 seconds (npm); docker build varies |

---

## Sampling Rate

- **After every task commit:** `npm test` (+ `npm run typecheck` if touching `src/secrets/`)
- **After every plan wave:** Full npm gate + `docker build` locally when Dockerfile changes
- **Before `/gsd:verify-work`:** CI green including `docker-build` on `main`; operator UAT optional (see docker-pilot runbook)
- **Max feedback latency:** 120 seconds |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-T1/T2 | 05-01 | 0 | TEST-05, SEC-05 | — | file secret provider | unit | `npm test -- test/secrets/file-provider.test.ts test/secrets/resolve-env.test.ts` | ✅ | done |
| 05-02-T1/T2 | 05-02 | 1 | TEST-05, SYNC-17 | T-05-01 | image builds without secrets | CI/local | `docker build -t er-calendar-bridge:ci .` | ✅ | done |
| 05-03-T1/T2 | 05-03 | 1 | SYNC-17, SEC-02, OPS-01 | T-05-08 | compose secrets, no ports | smoke | `docker compose config` | ✅ | done |
| 05-04-T1/T2 | 05-04 | 2 | TEST-05, OPS-04 | T-05-12 | docker-build after npm jobs | CI | `grep docker-build .github/workflows/ci.yml` | ✅ | done |
| 05-05-T1 | 05-05 | 3 | SYNC-17, OPS-02, SEC-03 | T-05-16 | pilot runbook placeholders only | manual/doc | `grep IMAGE docs/runbooks/docker-pilot.md` | ✅ | done |
| 05-05-T2 | 05-05 | 3 | SYNC-18 | T-05-17 | offboard backup step | manual/doc | `grep bridge.db docs/runbooks/offboarding.md` | ✅ | done |
| 05-05-T3 | 05-05 | 3 | TEST-05, OPS-02 | — | README + phase gate docs | manual/doc | `grep docker-build README.md` | ✅ | done |

---

## Wave 0 Gaps

- [x] `Dockerfile` + `.dockerignore` (05-02)
- [x] `compose.yaml` + `.env.example` updates (`IMAGE`, `DATA_DIR`) (05-03)
- [x] `src/secrets/*` + wire into config entry (05-01)
- [x] `test/secrets/file-provider.test.ts` (05-01)
- [x] `.gitignore` — `secrets/`, `data/` (05-01)
- [x] `.github/workflows/ci.yml` — `docker-build` job (05-04)
- [x] Runbook: offboarding (SYNC-18) + Docker pilot / migration / Google re-auth (05-05)
- [x] `package.json` version `1.0.0` (05-04)

---

## Phase Gate

All of the following must pass before Phase 5 is considered complete:

1. `npm run typecheck` && `npm run lint` && `npm test` && `npm run build` — exit 0 locally and in CI.
2. CI job **`docker-build`** succeeds on `main` (build always; push to `ghcr.io/europeanresolve/er-calendar-bridge` on main only).
3. Operator docs: `docs/runbooks/docker-pilot.md` and `docs/runbooks/offboarding.md` linked from README.
4. Optional operator UAT: encrypted laptop `docker compose up` with real secrets (manual checklist in docker-pilot runbook).

When branch protection is enabled, require **`docker-build`** with the four npm jobs (D-19).
