---
phase: 05
slug: docker-packaging-and-local-pilot-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-16
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
- **Before `/gsd:verify-work`:** CI green including `docker-build`; operator UAT optional
- **Max feedback latency:** 120 seconds |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 05-01 | 0 | TEST-05, SEC-05 | — | file secret provider | unit | `npm test -- test/secrets/file-provider.test.ts` | ❌ | pending |
| TBD | 05-03 | 1 | SYNC-17, SEC-02 | — | compose secrets, no ports | smoke | `docker compose config` | ❌ | pending |
| TBD | 05-02 | 1 | TEST-05 | — | image builds without secrets | CI/local | `docker build` | ❌ | pending |
| TBD | 05-04 | 2 | SYNC-18, OPS-02 | — | runbook + migration docs | manual/doc | review README/runbook | ❌ | pending |

---

## Wave 0 Gaps

- [ ] `Dockerfile` + `.dockerignore`
- [ ] `compose.yaml` + `.env.example` updates (`IMAGE`, `DATA_DIR`)
- [ ] `src/secrets/*` + wire into config entry
- [ ] `test/secrets/file-provider.test.ts`
- [ ] `.gitignore` — `secrets/`, `data/`
- [ ] `.github/workflows/ci.yml` — `docker-build` job
- [ ] Runbook: offboarding (SYNC-18) + Docker pilot / migration / Google re-auth
- [ ] `package.json` version bump to `1.0.0` (recommended)

---

## Phase Gate

- `npm run typecheck` && `npm run lint` && `npm test` && `npm run build` all exit 0; CI `docker-build` succeeds on main.
