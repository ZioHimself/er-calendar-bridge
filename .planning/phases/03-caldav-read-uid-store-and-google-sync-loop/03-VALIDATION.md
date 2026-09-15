---
phase: 3
slug: caldav-read-uid-store-and-google-sync-loop
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-15
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^5.0.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- test/<area>/<file>.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~20 seconds (grows with integration tests) |

---

## Sampling Rate

- **After every task commit:** Run task-specific `<automated>` verify from PLAN.md
- **After every plan wave:** `npm test && npm run typecheck`
- **Before `/gsd:verify-work`:** `npm test && npm run typecheck && npm run lint && npm run build`
- **Max feedback latency:** 45 seconds

### Wave Gate Commands

| Wave | Plans | Gate Command |
|------|-------|--------------|
| 0 | 03-01 | Spike outcome recorded; `npm run typecheck` |
| 1 | 03-02, 03-03 | `npm test -- test/config test/store && npm run typecheck` |
| 2 | 03-04, 03-05 | `npm test -- test/adapters test/writers && npm run typecheck` |
| 3 | 03-06 | `npm test && npm run typecheck && npm run lint` |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 03-01 | 0 | SYNC-01 | T-03-01 | Delta strategy documented | spike/doc | manual spike + `03-SPIKE-SYNC.md` or plan note | ❌ W0 | ⬜ pending |
| 03-02-T1 | 03-02 | 1 | SEC-04, OPS-01 | T-03-02 | Zod rejects unknown keys; single calendar | unit | `npm test -- test/config/env.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-T1 | 03-03 | 1 | SYNC-11 | T-03-03 | Composite key idempotency | unit | `npm test -- test/store/mapping-store.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-T1 | 03-04 | 2 | SEC-01 | T-03-04 | CalDAV read-only surface | unit | `npm test -- test/adapters/caldav-readonly.test.ts` | ❌ W0 | ⬜ pending |
| 03-05-T1 | 03-05 | 2 | SEC-03 | T-03-05 | Calendar scope only | unit | `npm test -- test/writers/google-auth.test.ts` | ❌ W0 | ⬜ pending |
| 03-06-T1 | 03-06 | 3 | SYNC-01,05,06,07,11,12, OPS-03 | T-03-06 | Mocked E2E sync cycle | integration | `npm test -- test/integration/` | ❌ W0 | ⬜ pending |
| 03-06-T2 | 03-06 | 3 | SYNC-13 | — | mailbox.org horizon documented | doc | README/ops note grep | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/integration/sync-cycle.test.ts` — mocked CalDAV + Google (D-19)
- [ ] `test/integration/sync-recurrence.test.ts` — modified/deleted instance fixtures
- [ ] `test/config/env.test.ts` — Zod env schema
- [ ] `test/store/mapping-store.test.ts` — composite key + cancel state
- [ ] `test/adapters/caldav-readonly.test.ts` — no write methods exported
- [ ] `test/writers/google-auth.test.ts` — scope assertion
- [ ] `src/config/env.ts` — central config
- [ ] npm dependencies: tsdav, googleapis, better-sqlite3, zod, pino
- [ ] `@types/better-sqlite3` devDependency
- [ ] mailbox.org sync spike outcome (Wave 0 plan 03-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live pilot against operator Google calendar | SYNC-05 (pilot) | No live creds in CI | Run `sync` once with real env; verify one event round-trip |
| mailbox.org sync-collection support | SYNC-01 | Provider-specific | Execute Wave 0 spike script against operator mailbox |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in automated commands
- [ ] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
