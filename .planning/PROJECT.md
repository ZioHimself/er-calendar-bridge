# ER Calendar Bridge

## What This Is

A read-only sync service that propagates mailbox.org calendar events to Google Calendar (v1.0 pilot) and, after pilot validation, Microsoft 365 (v1.1) for European Resolve members who use those clients. Events are classified and washed inside the bridge before any data crosses to third-party providers. mailbox.org remains the sole source of truth.

## Core Value

Sensitive calendar information never leaks to Google or Microsoft — untagged and internal events propagate only as busy-blocks; sensitive events are withheld entirely.

## Requirements

### Validated

(None yet — ship to validate)

### Active (v1.0 — Google pilot)

- [ ] One-way sync from mailbox.org (CalDAV) to Google Calendar
- [ ] Per-event classification via iCalendar `CATEGORIES` (`ER-PUBLIC`, `ER-INTERNAL`, `ER-SENSITIVE`)
- [ ] Default untagged events to Internal (busy-block), never full disclosure
- [ ] Content washing: strip title, description, location, attendees, organiser, attachments, tags for non-public events
- [ ] Withhold `ER-SENSITIVE` events entirely (no busy-block)
- [ ] Notify event owners when content is withheld or downgraded
- [ ] Handle create, update, delete, and recurring-event exceptions within minutes
- [ ] Idempotent sync (no duplicate events on restart)
- [ ] Read-only mailbox.org access — never write to source
- [ ] Encrypted credential storage, per-member secret isolation
- [ ] Docker Compose deployment: one container per synced member
- [ ] Single-account pilot before expanding to other members
- [ ] Offboarding: revoke credentials, remove container, delete propagated copies

### Active (v1.1 — after Google pilot)

- [ ] One-way sync from mailbox.org (CalDAV) to Microsoft 365 — mirrors Google path

### Out of Scope

- Contacts, tasks, and email — calendar only
- Two-way sync (Google/Outlook changes back to mailbox.org)
- CalDAV-native clients (Apple Calendar, Thunderbird, Morgen) — connect to mailbox.org directly
- Write-back of classification tags to mailbox.org
- Consumer NAS hosting (WD My Cloud)
- Kubernetes orchestration
- Shared account calendar merging all members

## Context

**Organisation:** European Resolve VZW — ~7 people, ~4 active schedulers.

**Problem:** mailbox.org exposes calendars over CalDAV with per-user app passwords. Google Calendar and Outlook do not act as acceptable CalDAV clients. A bridge must speak CalDAV (read), Google Calendar API (write), and eventually Microsoft Graph (write).

**Milestone strategy:**
- **v1.0:** Google-only pilot — validate CalDAV read, classification, washing, Google write, notifications, and Docker deployment on operator laptop
- **v1.1:** Add Microsoft Graph writer after Google pilot is validated

**Existing decisions (IT strategy):**
- Classification via single calendar + `CATEGORIES` tags (not separate calendars per tier)
- Restrict-only: only explicit `ER-PUBLIC` enables full disclosure
- Fail-closed: misfiled/untagged events degrade to busy-block or drop, never full leak
- Pilot on operator laptop (encrypted), then migrate to organisation server
- Interim secrets: Docker secrets / sops+age; target: Vault or OpenBao
- Build preference: assemble from maintained connectors over hand-rolled recurrence logic

**Upstream quirks:**
- mailbox.org limits future events to ~1 year over CalDAV
- Recurrence exceptions are highest-risk translation case
- Per-account calendar collection IDs vary

## Constraints

- **Language**: TypeScript only — strict mode; no Python
- **Security**: Read-only source access; calendar-scoped OAuth per target provider; host treated as Sensitive-tier infrastructure
- **Scale**: Minimum viable tooling — 7 people, 4 schedulers; avoid operational complexity disproportionate to team size
- **Portability**: Host migration (laptop → server) must be a deployment change, not a rewrite
- **Data protection**: Attendee/organiser PII not propagated except for `ER-PUBLIC` events where disclosure is intended
- **Compliance**: Classification is a human act on mailbox.org; bridge interprets tags at read time only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single calendar + `CATEGORIES` tags | Team needs one calendar view in mailbox.org web UI | — Pending |
| Docker Compose, one container per member | Per-member isolation without Kubernetes overhead | — Pending |
| Read-only mailbox.org | Prevents corrupting source of truth; smaller blast radius | — Pending |
| Default untagged → Internal busy-block | Fail-closed; untagged can only under-share, never leak | — Pending |
| Assemble from maintained connectors | Recurrence reconciliation is error-prone to hand-write | — Pending |
| Pilot: operator calendar only on laptop | Bounds interim risk; validates end-to-end before others | — Pending |
| Google-first v1.0 milestone | Validate core pipeline on one write target before adding Graph complexity | — Pending |
| TypeScript (strict) over Python | Type safety across iCal/REST translation; team already uses TS (european-resolve) | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Current State

Phase 3 complete (2026-09-15): Google pilot sync loop — CalDAV read, SQLite UID mapping, Google writer, `sync` / `sync --watch` CLI with mocked integration tests. Live mailbox.org spike and operator Google pilot still require human credentials.

---
*Last updated: 2026-09-15 after Phase 3 execution*
