# Roadmap: ER Calendar Bridge

**Created:** 2026-09-13
**Phases:** 5 + 1 inserted (01.1)
**Milestone:** v1.0 Pilot — operator single-calendar validation

## Overview

Deliver a read-only mailbox.org → Google/Microsoft calendar bridge: establish the TypeScript project and fixture-driven test harness; add CI early so every subsequent phase stays merge-ready; implement fail-closed classification and washing; wire CalDAV read with UID mapping and a Google pilot sync loop; add Microsoft Graph writes and withhold notifications; package for Docker Compose local pilot deployment.

Canonical refs: `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md`, `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md`

## Phases

**Execution order:** 1 → 01.1 → 2 → 3 → 4 → 5

- [ ] **Phase 1: Project scaffold and test harness** — TypeScript strict project, vitest, iCal fixture library
- [ ] **Phase 01.1: CI pipeline (INSERTED)** — GitHub Actions for test, lint, and typecheck
- [ ] **Phase 2: Classification, washing, and iCal domain logic** — Fail-closed tier rules and busy-block construction
- [ ] **Phase 3: CalDAV read, UID store, and Google sync loop** — mailbox.org read, SQLite mapping, Google pilot sync
- [ ] **Phase 4: Microsoft Graph writer and withhold notifications** — Outlook write path and owner/IT notifications
- [ ] **Phase 5: Docker packaging and local pilot deployment** — Image, Compose, secrets, operator laptop pilot

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

**Plans:** 4 plans

Plans:
**Wave 1**

- [ ] 01-01-PLAN.md — Tooling configs, node-ical install, and three-layer source scaffold

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — node-ical adapter, test helpers, and classification-tier fixture pairs

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — Recurrence-exception fixture pairs

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-04-PLAN.md — Fixture smoke tests and full validation gate

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

**Plans:** TBD

Plans:

- [ ] TBD (run `/gsd:plan-phase 01.1` to break down)

### Phase 2: Classification, washing, and iCal domain logic

**Goal:** Implement the pure domain pipeline — parse iCalendar `CATEGORIES`, classify events into Public / Internal / Sensitive with fail-closed defaults, and construct washed outbound events (busy-block or drop) — fully covered by unit tests against fixtures.

**Depends on:** Phase 01.1

**Requirements:** SYNC-02, SYNC-03, SYNC-04, SYNC-08, SYNC-09, SYNC-10, TEST-04

**Success Criteria:**

1. Untagged events default to Internal (busy-block), never full disclosure
2. Only explicit `ER-PUBLIC` enables full-content propagation; `ER-SENSITIVE` yields no outbound event
3. Busy-blocks retain only start, end, stable UID, and generic "Busy" label — all PII fields stripped
4. Restrict-only rule enforced: no code path promotes an event to full content without `ER-PUBLIC`
5. Recurrence-exception fixtures parse and classify without leaking source fields on non-public tiers

**Plans:** TBD

Plans:

- [ ] TBD (run `/gsd:plan-phase 2` to break down)

### Phase 3: CalDAV read, UID store, and Google sync loop

**Goal:** Integrate mailbox.org CalDAV read (tsdav), per-container SQLite UID→Google event ID mapping, and a Google Calendar API writer with a sync loop that propagates create/update/delete and handles recurring series for the operator's pilot calendar.

**Depends on:** Phase 2

**Requirements:** SYNC-01, SYNC-05, SYNC-06, SYNC-07, SYNC-11, SYNC-12, SYNC-13, SEC-01, SEC-02, SEC-04, OPS-01, OPS-03

**Success Criteria:**

1. Bridge reads events from mailbox.org CalDAV using app-specific password (read-only)
2. Source event UID maps to Google event ID in SQLite; restart does not create duplicates
3. Event creation, modification, and deletion on source propagate to Google within the configured sync interval
4. Recurring events and individually modified/deleted instances reconcile correctly (fixture + integration tests)
5. Operator can run a single-account pilot sync against their own Google calendar

**Plans:** TBD

Plans:

- [ ] TBD (run `/gsd:plan-phase 3` to break down)

### Phase 4: Microsoft Graph writer and withhold notifications

**Goal:** Add Microsoft Graph calendar writes mirroring the Google path, plus SMTP notifications to event owners when content is withheld or downgraded — with de-duplication and an IT audit record.

**Depends on:** Phase 3

**Requirements:** SYNC-01, SYNC-14, SYNC-15, SYNC-16, SEC-03, OPS-03

**Success Criteria:**

1. Washed and full-content events write to Microsoft Graph `/events` with the same classification rules as Google
2. UID mapping supports both Google and Microsoft remote IDs per source event
3. Owner receives a notification when an event is propagated as busy-block or dropped due to classification
4. Repeated notifications for the same unchanged event are suppressed (stable key + suppression window)
5. IT/operator can inspect an audit log of withholding events

**Plans:** TBD

Plans:

- [ ] TBD (run `/gsd:plan-phase 4` to break down)

### Phase 5: Docker packaging and local pilot deployment

**Goal:** Package the bridge as a Docker image with Docker Compose for local pilot deployment on the operator's encrypted laptop — one container, one member's secrets, portable configuration abstracted from host. Extend CI with a Docker image build job.

**Depends on:** Phase 4

**Requirements:** SYNC-17, SYNC-18, SEC-02, SEC-05, OPS-01, OPS-02, OPS-04, TEST-05

**Success Criteria:**

1. `docker compose up` starts a single-member pilot stack from documented instructions
2. Each container receives only its own member credentials (Docker secrets or sops/age mount — no shared secrets file)
3. SQLite UID map persists across container restarts via a named volume
4. Configuration and secrets retrieval are abstracted so host migration is a deployment change, not a rewrite
5. Operator can validate end-to-end pilot: CalDAV read → classify → wash → Google + Microsoft write → notify
6. CI workflow extended to build the Docker image successfully (no registry push required for pilot)

**Plans:** TBD

Plans:

- [ ] TBD (run `/gsd:plan-phase 5` to break down)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project scaffold and test harness | 0/TBD | Not started | — |
| 01.1. CI pipeline (INSERTED) | 0/TBD | Not started | — |
| 2. Classification, washing, and iCal domain logic | 0/TBD | Not started | — |
| 3. CalDAV read, UID store, and Google sync loop | 0/TBD | Not started | — |
| 4. Microsoft Graph writer and withhold notifications | 0/TBD | Not started | — |
| 5. Docker packaging and local pilot deployment | 0/TBD | Not started | — |

---
