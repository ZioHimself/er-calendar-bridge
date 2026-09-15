# Requirements: ER Calendar Bridge

**Defined:** 2026-09-13
**Core Value:** Sensitive calendar information never leaks to Google or Microsoft — untagged and internal events propagate only as busy-blocks; sensitive events are withheld entirely.

Canonical refs: `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md`, `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md`

## v1.0 Requirements (Google-only pilot)

Requirements for the v1.0 pilot milestone. Completes at Phase 5 (Docker deployment). Each maps to one roadmap phase.

### Sync & Classification

- [x] **SYNC-01**: One-way sync from mailbox.org (CalDAV) to Google Calendar
- [ ] **SYNC-02**: Per-event classification via iCalendar `CATEGORIES` (`ER-PUBLIC`, `ER-INTERNAL`, `ER-SENSITIVE`)
- [ ] **SYNC-03**: Default untagged events to Internal (busy-block), never full disclosure
- [ ] **SYNC-04**: Content washing — strip title, description, location, attendees, organiser, attachments, and tags for non-public events
- [x] **SYNC-05**: Withhold `ER-SENSITIVE` events entirely (no busy-block)
- [x] **SYNC-06**: Handle create, update, delete propagation within minutes
- [x] **SYNC-07**: Correctly handle recurring events and individually modified/deleted instances
- [ ] **SYNC-08**: Restrict-only principle — only `ER-PUBLIC` enables full disclosure
- [ ] **SYNC-09**: Bridge MUST NOT modify or write classification tags on mailbox.org source events
- [ ] **SYNC-10**: Attendee/organiser PII not propagated except for `ER-PUBLIC` where disclosure is intended
- [x] **SYNC-11**: Idempotent sync — restarts do not create duplicate external events
- [x] **SYNC-12**: Deletions on source propagate as deletions, not stale copies
- [x] **SYNC-13**: Scheduling window accounts for mailbox.org ~1-year future-event CalDAV limit
- [ ] **SYNC-14**: Notify event owners when content is withheld or downgraded
- [ ] **SYNC-15**: De-duplicate withhold notifications (stable key + suppression window)
- [ ] **SYNC-16**: IT/operator access to audit record of withholding events
- [ ] **SYNC-17**: Docker image with Compose orchestration — one container per synced member
- [ ] **SYNC-18**: Offboarding support — revoke credential, remove container, delete propagated copies

### Security

- [x] **SEC-01**: Read-only mailbox.org access — never create, modify, or delete source events
- [ ] **SEC-02**: Credentials encrypted at rest; never plaintext in config or version control
- [x] **SEC-03**: Google OAuth scoped to calendar only
- [x] **SEC-04**: Per-member credential isolation — no shared all-accounts secrets blob
- [ ] **SEC-05**: Secrets retrieval abstracted behind accessor (interim sops/age → target Vault/OpenBao)

### Test Harness

- [x] **TEST-01**: vitest test runner with strict TypeScript
- [x] **TEST-02**: iCalendar fixture library covering all classification tiers and untagged events
- [x] **TEST-03**: Recurrence-exception fixtures as explicit high-risk test targets
- [ ] **TEST-04**: Domain logic (classify, wash) covered by pure unit tests — no network
- [ ] **TEST-05**: CI runs tests without live provider credentials

### Operations

- [x] **OPS-01**: Single-account pilot configuration (operator calendar only)
- [ ] **OPS-02**: Host migration (laptop → server) is a deployment change, not a rewrite
- [x] **OPS-03**: Operator can see sync status, last success per account, and withheld events
- [x] **OPS-04**: Minimum viable tooling — no disproportionate operational complexity

## v1.1 Requirements (Microsoft Graph — post Google pilot)

Deferred until v1.0 Google pilot is validated.

### Sync & Security

- [ ] **SYNC-22**: One-way sync from mailbox.org (CalDAV) to Microsoft 365 — mirrors Google path with same classification rules
- [ ] **SEC-06**: Microsoft OAuth scoped to calendar only

## v2 Requirements

Deferred post-v1.1.

### Production Hardening

- **SYNC-19**: Multi-member Compose stack with per-service secret mounts
- **SYNC-20**: Vault/OpenBao runtime secrets adapter
- **SYNC-21**: Offboarding automation tooling for HR-security policy
- **OPS-05**: Production host deployment on organisation server

## Out of Scope

| Feature | Reason |
|---------|--------|
| Two-way sync (Google/Outlook → mailbox.org) | Requirements §1.3 — out of scope this phase |
| CalDAV-native clients (Apple, Thunderbird, Morgen) | Connect to mailbox.org directly — no bridge |
| Write-back of classification tags to mailbox.org | Requirements §2.3, §6.1 — human act on source |
| Consumer NAS hosting (WD My Cloud) | Security rationale — rejected design |
| Kubernetes orchestration | Disproportionate at 7 people / 4 schedulers |
| Shared account calendar for all members | Violates least-privilege and data protection |
| Contacts, tasks, email | Calendar only — Requirements §1.3 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SYNC-01 | Phase 3 | Complete |
| SYNC-02 | Phase 2 | Pending |
| SYNC-03 | Phase 2 | Pending |
| SYNC-04 | Phase 2 | Pending |
| SYNC-05 | Phase 2 | Complete |
| SYNC-06 | Phase 3 | Complete |
| SYNC-07 | Phase 3 | Complete |
| SYNC-08 | Phase 2 | Pending |
| SYNC-09 | Phase 2 | Pending |
| SYNC-10 | Phase 2 | Pending |
| SYNC-11 | Phase 3 | Complete |
| SYNC-12 | Phase 3 | Complete |
| SYNC-13 | Phase 3 | Complete |
| SYNC-14 | Phase 4 | Pending |
| SYNC-15 | Phase 4 | Pending |
| SYNC-16 | Phase 4 | Pending |
| SYNC-17 | Phase 5 | Pending |
| SYNC-18 | Phase 5 | Pending |
| SYNC-22 | Phase 6 | Pending |
| SEC-01 | Phase 3 | Complete |
| SEC-02 | Phase 5 | Pending |
| SEC-03 | Phase 3 | Complete |
| SEC-04 | Phase 3, 5 | Complete |
| SEC-05 | Phase 5 | Pending |
| SEC-06 | Phase 6 | Pending |
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 1 | Complete |
| TEST-03 | Phase 1 | Complete |
| TEST-04 | Phase 2 | Pending |
| TEST-05 | Phase 01.1, 5 | Pending |
| OPS-01 | Phase 3, 5 | Complete |
| OPS-02 | Phase 5 | Pending |
| OPS-03 | Phase 3, 4 | Complete |
| OPS-04 | Phase 1, 01.1, 5 | Complete |

**Coverage:**
- v1.0 requirements: 32 total
- v1.1 requirements: 2 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-13*
*Last updated: 2026-09-13 after Google-only v1.0 phase split*
