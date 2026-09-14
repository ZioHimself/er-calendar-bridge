---
phase: 2
slug: classification-washing-and-ical-domain-logic
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-14
updated: 2026-09-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- test/domain/<file>.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run task-specific `<automated>` verify from PLAN.md
- **After every plan wave:** `npm test && npm run typecheck`
- **Before `/gsd:verify-work`:** `npm test && npm run typecheck && npm run lint && npm run build`
- **Max feedback latency:** 30 seconds

### Wave Gate Commands

| Wave | Plans | Gate Command |
|------|-------|--------------|
| 1 | 02-01 | `npm test -- test/domain/classify.test.ts && npm run typecheck` |
| 2 | 02-02 | `npm test -- test/domain/wash.test.ts && npm run typecheck` |
| 3 | 02-03 | `npm test && npm run typecheck && npm run lint` |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-T1 | 02-01 | 1 | SYNC-02, SYNC-08 | T-02-01 | Restrict-only classifier; strictest-wins | unit | `npm test -- test/domain/classify.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-T2 | 02-01 | 1 | SYNC-03 | T-02-02 | Untagged → busy; fail-closed | unit | `npm test -- test/domain/classify.test.ts -t untagged` | ❌ W0 | ⬜ pending |
| 02-02-T1 | 02-02 | 2 | SYNC-04, SYNC-09, SYNC-10 | T-02-03 | Busy whitelist; no PII keys | unit | `npm test -- test/domain/wash.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-T2 | 02-02 | 2 | SYNC-08 | T-02-04 | Washer trusts decision; no full promotion | unit | `npm test -- test/domain/wash.test.ts -t passthrough` | ❌ W0 | ⬜ pending |
| 02-03-T1 | 02-03 | 3 | TEST-04, SYNC-02–10 | T-02-05 | Fixture pipeline + recurrence | integration | `npm test -- test/domain/pipeline-fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-T2 | 02-03 | 3 | TEST-04 | T-02-06 | Sidecar `washed` populated for busy tiers | integration | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/domain/classify/` — classifier module + exports
- [ ] `src/domain/wash/` — washer module + exports
- [ ] `src/domain/process-source-event.ts` — orchestrator
- [ ] `src/domain/types/index.ts` — `OutboundEvent`, `ProcessedSourceEvent`
- [ ] `test/domain/classify.test.ts`, `wash.test.ts`, `pipeline-fixtures.test.ts`
- [ ] `test/helpers/assert-sidecar.ts` — `assertProcessed`, forbidden-key scan
- [ ] Busy/recurrence `.expected.json` — full `washed` objects (D-15)

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
