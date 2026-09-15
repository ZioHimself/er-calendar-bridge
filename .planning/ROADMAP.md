# Roadmap: ER Calendar Bridge

**Created:** 2026-09-13
**Phases:** 6 + 1 inserted (01.1)
**Milestone v1.0:** Google-only pilot — operator single-calendar validation in Docker
**Milestone v1.1:** Microsoft Graph write path (post Google pilot)

## Overview

Deliver a read-only mailbox.org → Google Calendar bridge for the v1.0 pilot: establish the TypeScript project and fixture-driven test harness; add CI early so every subsequent phase stays merge-ready; implement fail-closed classification and washing; wire CalDAV read with UID mapping and a Google sync loop; add withhold notifications and audit; package for Docker Compose local pilot deployment. Microsoft Graph writes are deferred to v1.1 (Phase 6) after the Google pilot is validated.

Canonical refs: `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md`, `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md`

## Phases

**Execution order:** 1 → 01.1 → 2 → 3 → 4 → 5 → 6

**v1.0 milestone completes at Phase 5.**

- [ ] **Phase 1: Project scaffold and test harness** — TypeScript strict project, vitest, iCal fixture library
- [x] **Phase 01.1: CI pipeline (INSERTED)** — GitHub Actions for test, lint, and typecheck (completed 2026-09-13)
- [x] **Phase 2: Classification, washing, and iCal domain logic** — Fail-closed tier rules and busy-block construction (completed 2026-09-14)
- [ ] **Phase 3: CalDAV read, UID store, and Google sync loop** — mailbox.org read, SQLite mapping, Google pilot sync
- [ ] **Phase 4: Withhold notifications and audit log** — SMTP owner alerts, de-duplication, IT audit record
- [ ] **Phase 5: Docker packaging and local pilot deployment (v1.0)** — Image, Compose, secrets, Google-only operator laptop pilot
- [ ] **Phase 6: Microsoft Graph writer (v1.1)** — Outlook write path mirroring Google; dual UID mapping

## Phase Details

### Phase 1: Project scaffold and test harness

**Goal:** Bootstrap a strict TypeScript Node project with vitest, lint/typecheck scripts, and a fixture-driven test harness for iCalendar samples — including recurrence exceptions — so all later business logic and sync code can be developed test-first.

**Requirements:** TEST-01, TEST-02, TEST-03, OPS-04

**Success Criteria:**

1. `npm test` runs vitest with at least one passing smoke test
2. `npm run typecheck` and `npm run lint` succeed on the scaffold
3. Fixture directory contains representative VEVENT samples: `ER-PUBLIC`, `ER-INTERNAL`, `ER-SENSITIVE`, untagged, and recurrence-exception cases
4. Project structure separates `src/domain`, `src/adapters`, and `src/sync` per architecture layering
5. `.env.example` documents required config keys without secrets

**Plans:** 4/4 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Tooling configs, node-ical install, and three-layer source scaffold

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — node-ical adapter, test helpers, and classification-tier fixture pairs

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Recurrence-exception fixture pairs

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Fixture smoke tests and full validation gate

### Phase 01.1: CI pipeline (INSERTED)

**Goal:** Add GitHub Actions CI immediately after the scaffold lands — running test, lint, and typecheck on every push/PR — so all subsequent business-logic and sync work stays merge-ready without live provider credentials.

**Depends on:** Phase 1

**Requirements:** TEST-05, OPS-04

**Success Criteria:**

1. CI workflow runs `npm test`, `npm run lint`, and `npm run typecheck` on push and pull_request
2. Failed CI blocks merge (branch protection documented in README)
3. CI does not require live mailbox.org/Google/Microsoft credentials (mocks/fixtures only)
4. CI runtime is proportionate for a 7-person team (no disproportionate infra)
5. Workflow file is structured so a Docker build job can be added in Phase 5 without restructuring

**Plans:** 3/3 plans complete

Plans:

**Wave 1** *(parallel — no file overlap)*

- [x] 01.1-01-PLAN.md — tsconfig.test.json and dual tsc typecheck script (D-04–D-07)
- [x] 01.1-02-PLAN.md — GitHub Actions CI workflow with four parallel jobs (D-08–D-14, TEST-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01.1-03-PLAN.md — Trunk-based README docs and Phase 01.1 validation gate (D-15)

### Phase 2: Classification, washing, and iCal domain logic

**Goal:** Implement the pure domain pipeline — parse iCalendar `CATEGORIES`, classify events into Public / Internal / Sensitive with fail-closed defaults, and construct washed outbound events (busy-block or drop) — fully covered by unit tests against fixtures.

**Depends on:** Phase 01.1

**Requirements:** SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-08, SYNC-09, SYNC-10, TEST-04

**Success Criteria:**

1. Untagged events default to Internal (busy-block), never full disclosure
2. Only explicit `ER-PUBLIC` enables full-content propagation; `ER-SENSITIVE` yields no outbound event
3. Busy-blocks retain only start, end, stable UID, and generic "Busy" label — all PII fields stripped
4. Restrict-only rule enforced: no code path promotes an event to full content without `ER-PUBLIC`
5. Recurrence-exception fixtures parse and classify without leaking source fields on non-public tiers

**Plans:** 3/3 plans complete

Plans:

**Wave 1**

- [x] 02-01-PLAN.md — Domain types and classifySourceEvent (TDD, D-01–D-04, D-11–D-12)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — washSourceEvent, processSourceEvent orchestrator (TDD, D-05–D-10)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — assertProcessed, sidecar washed objects, pipeline fixture tests (TEST-04, D-14–D-16)

### Phase 3: CalDAV read, UID store, and Google sync loop

**Goal:** Integrate mailbox.org CalDAV read (tsdav), per-container SQLite UID→Google event ID mapping, and a Google Calendar API writer with a sync loop that propagates create/update/delete and handles recurring series for the operator's pilot calendar.

**Depends on:** Phase 2

**Requirements:** SYNC-01, SYNC-05, SYNC-06, SYNC-07, SYNC-11, SYNC-12, SYNC-13, SEC-01, SEC-03, SEC-04, OPS-01, OPS-03

**Success Criteria:**

1. Bridge reads events from mailbox.org CalDAV using app-specific password (read-only)
2. Source event UID maps to Google event ID in SQLite; restart does not create duplicates
3. Event creation, modification, and deletion on source propagate to Google within the configured sync interval
4. Recurring events and individually modified/deleted instances reconcile correctly (fixture + integration tests)
5. Operator can run a single-account pilot sync against their own Google calendar
6. Google OAuth is scoped to calendar only

**Plans:** 5/6 plans executed

Plans:

**Wave 0**

- [x] 03-01-PLAN.md — mailbox.org sync-collection spike, npm deps, 03-SPIKE-SYNC.md

**Wave 1** *(parallel after Wave 0 — no file overlap)*

- [x] 03-02-PLAN.md — Sync ports + Zod env loader (SEC-04, OPS-01)
- [x] 03-03-PLAN.md — SQLite mapping + sync_state stores (SYNC-11, OPS-03)

**Wave 2** *(parallel — adapters)*

- [x] 03-04-PLAN.md — Read-only CalDAV reader (SEC-01, SYNC-12/13)
- [x] 03-05-PLAN.md — Google Calendar writer + OAuth scope (SEC-03, SYNC-05/07)

**Wave 3**

- [ ] 03-06-PLAN.md — runSyncCycle, integration tests, CLI sync/--watch

### Phase 4: Withhold notifications and audit log

**Goal:** Add SMTP notifications to event owners when content is withheld or downgraded — with de-duplication and an IT audit record — integrated with the Google sync loop from Phase 3.

**Depends on:** Phase 3

**Requirements:** SYNC-14, SYNC-15, SYNC-16, OPS-03

**Success Criteria:**

1. Owner receives a notification when an event is propagated as busy-block or dropped due to classification
2. Repeated notifications for the same unchanged event are suppressed (stable key + suppression window)
3. IT/operator can inspect an audit log of withholding events
4. Notification path works against the Google pilot sync loop (no Microsoft writer required)

**Plans:** TBD

Plans:

- [ ] TBD (run `/gsd:plan-phase 4` to break down)

### Phase 5: Docker packaging and local pilot deployment (v1.0)

**Goal:** Package the bridge as a Docker image with Docker Compose for local pilot deployment on the operator's encrypted laptop — one container, one member's secrets, portable configuration abstracted from host. Extend CI with a Docker image build job. **Completes v1.0 milestone (Google-only pilot).**

**Depends on:** Phase 4

**Requirements:** SYNC-17, SYNC-18, SEC-02, SEC-05, OPS-01, OPS-02, OPS-04, TEST-05

**Success Criteria:**

1. `docker compose up` starts a single-member pilot stack from documented instructions
2. Each container receives only its own member credentials (Docker secrets or sops/age mount — no shared secrets file)
3. SQLite UID map persists across container restarts via a named volume
4. Configuration and secrets retrieval are abstracted so host migration is a deployment change, not a rewrite
5. Operator can validate end-to-end v1.0 pilot: CalDAV read → classify → wash → Google write → notify
6. CI workflow extended to build the Docker image successfully (no registry push required for pilot)

**Plans:** TBD

Plans:

- [ ] TBD (run `/gsd:plan-phase 5` to break down)

### Phase 6: Microsoft Graph writer (v1.1)

**Goal:** Add Microsoft Graph calendar writes mirroring the Google path from Phase 3, with dual UID mapping for Google and Microsoft remote IDs per source event. **Post v1.0 Google pilot validation.**

**Depends on:** Phase 5

**Requirements:** SYNC-22, SEC-06

**Success Criteria:**

1. Washed and full-content events write to Microsoft Graph `/events` with the same classification rules as Google
2. UID mapping supports both Google and Microsoft remote IDs per source event
3. Microsoft OAuth is scoped to calendar only
4. Operator can validate Google + Microsoft dual-target sync for a pilot account

**Plans:** TBD

Plans:

- [ ] TBD (run `/gsd:plan-phase 6` to break down)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project scaffold and test harness | 4/4 | Complete | 2026-09-13 |
| 01.1. CI pipeline (INSERTED) | 3/3 | Complete   | 2026-09-13 |
| 2. Classification, washing, and iCal domain logic | 3/3 | Complete   | 2026-09-14 |
| 3. CalDAV read, UID store, and Google sync loop | 5/6 | In Progress|  |
| 4. Withhold notifications and audit log | 0/TBD | Not started | — |
| 5. Docker packaging and local pilot deployment (v1.0) | 0/TBD | Not started | — |
| 6. Microsoft Graph writer (v1.1) | 0/TBD | Not started | — |

---
