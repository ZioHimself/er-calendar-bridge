---
phase: 04
slug: microsoft-graph-writer-and-withhold-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-16
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^5.0.0 |
| **Config file** | none — vitest defaults |
| **Quick run command** | `npm test -- <touched-module-test>.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run targeted vitest file for touched module
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 04-01 | 0 | SYNC-14/15/16 | — | — | unit | `npm test -- test/sync/withhold-transition.test.ts` | ❌ | pending |
| TBD | 04-02 | 1 | SYNC-16, OPS-03 | — | no PII in audit | unit | `npm test -- test/store/audit-store.test.ts` | ❌ | pending |
| TBD | 04-03 | 1 | SYNC-14 | — | minimal email body | unit | `npm test -- test/notify/withhold-notifier.test.ts` | ❌ | pending |
| TBD | 04-04 | 2 | SYNC-14–16, OPS-03 | SEC-04 | env allowlist | integration | `npm test -- test/integration/sync-cycle.test.ts` | ✅ extend | pending |

---

## Wave 0 Gaps

- [ ] `test/sync/withhold-transition.test.ts` — episode + dedup + unchanged suppression
- [ ] `test/store/audit-store.test.ts` — schema, list since, PII-free columns
- [ ] `test/notify/withhold-notifier.test.ts` — mock transport, minimal body assertions
- [ ] Extend `test/integration/sync-cycle.test.ts` — notifier mock in deps
- [ ] Extend `test/config/env.test.ts` — SMTP + notify keys
- [ ] `npm install nodemailer` (+ types if needed)

---

## Phase Gate

- `npm run typecheck` && `npm run lint` && `npm test` all exit 0 before phase verification.
