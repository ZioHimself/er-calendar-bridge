# Phase 4: Withhold notifications and audit log - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 04-withhold notifications and audit log
**Areas discussed:** notify triggers, owner recipient, email content, de-dup + audit

---

## Notify triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Both busy-block and drop | Matches ROADMAP — any downgrade from full disclosure | ✓ |
| Drop / sensitive only | Only fully withheld events | |
| You decide | Planner chooses | |

| Option | Description | Selected |
|--------|-------------|----------|
| On change only | Notify when propagation changes vs last recorded state | ✓ |
| First time non-full | One mail per event key on first sight | |
| Every sync cycle | Noisy; needs heavy dedup | |

| Option | Description | Selected |
|--------|-------------|----------|
| Re-notify after fix then downgrade again | New episode when returning to full then downgrading | ✓ |
| Only once per uid+recurrenceId | Strongest suppression | |

| Option | Description | Selected |
|--------|-------------|----------|
| No mail on source delete | Deletion is not a withhold alert | ✓ |
| Yes on delete | Separate from classification | |

**User's choice:** Both outcomes; on-change; new episode after tag fix; no delete notifications.

---

## Owner recipient

| Option | Description | Selected |
|--------|-------------|----------|
| Configured member email | One email per container | ✓ (custom) |
| ORGANIZER from iCal | Requires parse extension | |
| Hybrid | Organizer with fallback | |

**User's choice:** **Configured (optional) member email; if none is set — no notifications.**

| Option | Description | Selected |
|--------|-------------|----------|
| Config email only for v1.0 | No ORGANIZER parse | ✓ |
| Parse ORGANIZER | More accurate later | |

| Option | Description | Selected |
|--------|-------------|----------|
| Audit log only for IT | No BCC | ✓ |
| BCC IT address | Real-time mail copy | |

| Option | Description | Selected |
|--------|-------------|----------|
| Log + audit failed, continue sync | Aligns with D-18 | ✓ |
| Fail cycle on SMTP error | | |

---

## Email content

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — no title/location/attendees | Avoid SMTP PII leak | ✓ |
| Title + times | Easier identification | |
| Title only | Middle ground | |

| Option | Description | Selected |
|--------|-------------|----------|
| English only | Pilot default | ✓ |
| Dutch / bilingual | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed subject line | Inbox filtering | ✓ |
| Dynamic subject | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Tag guidance + link to internal doc | Educational nudge | ✓ |
| Generic wording | | |

---

## De-dup + audit

| Option | Description | Selected |
|--------|-------------|----------|
| bridgeUuid + propagation + episode | User-specified key | ✓ |
| uid + recurrenceId + propagation | Simpler | |
| Forever suppress unchanged state | On-change model | ✓ |
| CLI audit list [--since] | Operator inspect | ✓ |
| Standard audit fields, no title | PII at rest | ✓ |

**User's choice:** Dedup key **`bridge_uuid` + propagation + episode**; indefinite suppression for unchanged state; CLI audit; standard field set.

---

## Claude's Discretion

- Env var names for optional notify email and documentation URL.
- Persisting `bridgeUuid` for drop-before-first-map edge cases.
- SQLite layout and exact CLI command spelling.

## Deferred Ideas

- ORGANIZER-based recipients; IT BCC; bilingual templates; Microsoft Graph (Phase 6).
