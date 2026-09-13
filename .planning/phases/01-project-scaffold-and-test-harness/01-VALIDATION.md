---
phase: 1
slug: project-scaffold-and-test-harness
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-13
updated: 2026-09-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.0 |
| **Config file** | `vitest.config.ts` (Wave 0 — create in plan 01-01) |
| **Quick run command** | `npm test` → `vitest run` |
| **Full suite command** | `npm test` (single smoke suite in Phase 1) |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run task-specific `<automated>` verify from PLAN.md
- **After every plan wave:** Run wave gate command for that wave (see below)
- **Before `/gsd:verify-work`:** `npm test && npm run typecheck && npm run lint && npm run build`
- **Max feedback latency:** 30 seconds

### Wave Gate Commands

| Wave | Plans | Gate Command |
|------|-------|--------------|
| 1 | 01-01 | `npm run typecheck && npm run lint && npm run build` |
| 2 | 01-02 | `npx tsx -e "import { loadFixture } from './test/helpers/load-fixture.ts'; import { parseIcs, getCategories } from './test/helpers/parse-ics.ts'; if (typeof loadFixture !== 'function' || typeof parseIcs !== 'function' || typeof getCategories !== 'function') process.exit(1)"` |
| 3 | 01-03 | Recurrence fixture existence + tsx parse smoke (plan 01-03 Task 1 verify) |
| 4 | 01-04 | `npm test && npm run typecheck && npm run lint && npm run build` |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01-01 | 1 | OPS-04 | T-01-SC | Human verifies npm packages before install | checkpoint | `test -f .planning/phases/01-project-scaffold-and-test-harness/01-RESEARCH.md` | ✅ | ⬜ pending |
| 01-01-T2 | 01-01 | 1 | TEST-01, OPS-04 | T-01-03 | Tooling configs only; no secrets | tooling | `npm run typecheck && npm run lint && npm run build` | ❌ W0 | ⬜ pending |
| 01-01-T3 | 01-01 | 1 | OPS-04 | T-01-02 | `.env.example` placeholders only | tooling | `npm run typecheck && npm run build && test -f .env.example` | ❌ W0 | ⬜ pending |
| 01-02-T1 | 01-02 | 2 | TEST-02 | T-01-04 | Helper exports validated via tsx import smoke | unit | `npx tsx -e "import { loadFixture } from './test/helpers/load-fixture.ts'; import { parseIcs, getCategories } from './test/helpers/parse-ics.ts'; if (typeof loadFixture !== 'function' || typeof parseIcs !== 'function' || typeof getCategories !== 'function') process.exit(1)"` | ❌ W0 | ⬜ pending |
| 01-02-T2 | 01-02 | 2 | TEST-02 | T-01-04 | Synthetic fixture data only; untagged omits CATEGORIES | smoke | `for d in public internal sensitive untagged; do test -f test/fixtures/$d/*.ics && test -f test/fixtures/$d/*.expected.json; done && ! grep -q '^CATEGORIES' test/fixtures/untagged/unclassified.ics` | ❌ W0 | ⬜ pending |
| 01-03-T1 | 01-03 | 3 | TEST-03 | T-01-04 | Recurrence fixtures parse without error | smoke | `for f in weekly-series modified-instance deleted-instance; do test -f test/fixtures/recurrence/$f.ics; done && npx tsx -e "import { loadFixture } from './test/helpers/load-fixture.ts'; import { parseIcs } from './test/helpers/parse-ics.ts'; for (const n of ['weekly-series','modified-instance','deleted-instance']) { const { ics } = await loadFixture('recurrence', n); parseIcs(ics); }"` | ❌ W0 | ⬜ pending |
| 01-04-T1 | 01-04 | 4 | TEST-01 | T-01-08 | Smoke test uses synthetic fixture UIDs only | smoke | `npm test` | ❌ W0 | ⬜ pending |
| 01-04-T2 | 01-04 | 4 | TEST-01, OPS-04 | T-01-07 | Full gate; strict tsc on src/ (test/ excluded — accepted MVP) | integration | `npm test && npm run typecheck && npm run lint && npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Artifacts created across plans 01-01 through 01-04:

- [ ] `package.json` — scripts, engines, type: module (01-01)
- [ ] `tsconfig.json` — strict, NodeNext; excludes test/ (accepted MVP) (01-01)
- [ ] `vitest.config.ts` — node environment (01-01)
- [ ] `eslint.config.mjs` — flat config (01-01)
- [ ] `src/index.ts` — stub entry (01-01)
- [ ] `src/domain/types/index.ts` — Tier, SourceEvent, PropagationDecision stubs (01-01)
- [ ] `test/helpers/load-fixture.ts`, `parse-ics.ts`, `assert-sidecar.ts` (01-02)
- [ ] `test/fixtures/{public,internal,sensitive,untagged}/*.ics` + sidecars (01-02)
- [ ] `test/fixtures/recurrence/*.ics` + sidecars (01-03)
- [ ] `test/smoke.test.ts` — D-16 smoke test (01-04)
- [ ] `.env.example` — config key documentation (01-01)
- [ ] `.gitignore` — node_modules, dist, .env, .vitest/ (01-01)

---

## Accepted MVP Deviations

| Deviation | Rationale | Remediation |
|-----------|-----------|-------------|
| `tsconfig.json` excludes `test/` from `npm run typecheck` | RESEARCH Pitfall 2; vitest compiles tests at runtime | `tsconfig.test.json` in Phase 01.1 if CI needs test-file typecheck |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| npm package legitimacy | OPS-04 | Supply-chain gate before install | Plan 01-01 Task 1 checkpoint — verify all 8 packages on npmjs.com |
| Node 24 LTS available on pilot laptop | OPS-04 | Environment check outside CI | Run `node --version` on operator laptop; expect v24.x |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
