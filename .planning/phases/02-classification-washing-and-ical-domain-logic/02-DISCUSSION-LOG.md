# Phase 2: Classification, washing, and iCal domain logic - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-14
**Phase:** 02-classification-washing-and-ical-domain-logic
**Areas discussed:** Multi-tag & unknown categories, Busy-block outbound shape, Full (public) propagation boundary, Fixture sidecars & test assertions, Domain module API

---

## Multi-tag & unknown categories

| Option | Description | Selected |
|--------|-------------|----------|
| Strictest wins → drop | Any ER-SENSITIVE ⇒ drop | ✓ |
| No full unless PUBLIC-only | Mixed rules without strictest on sensitive | |
| You decide | Planner documents precedence | |

**User's choice:** Strictest wins → drop when PUBLIC and SENSITIVE coexist.

| Option | Description | Selected |
|--------|-------------|----------|
| Full content | ER-PUBLIC present ⇒ full | |
| Busy-block only | Mixed tier tags ⇒ busy | ✓ (user: strictest wins) |
| You decide | | |

**User's choice:** ER-PUBLIC + ER-INTERNAL ⇒ busy-block only.

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore unknowns | Only ER-* tokens matter | |
| Unknown ⇒ busy | Per it-strategy internal default | ✓ |
| You decide | | |

**User's choice:** Unknown categories ⇒ busy (internal default per it-strategy).

| Option | Description | Selected |
|--------|-------------|----------|
| Exact case-sensitive | | |
| Case-insensitive ER tags | Normalize + proper multi-value parse | ✓ |
| You decide | | |

---

## Busy-block outbound shape

| Option | Description | Selected |
|--------|-------------|----------|
| "Busy" (fixed English) | ROADMAP/README alignment | ✓ |
| Empty/omitted summary | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal set | uid, start, end, summary | |
| Minimal + sync metadata | + recurrenceId for exceptions | ✓ |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Omit properties | Whitelist keys only | ✓ |
| Explicit null/empty | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| decision=drop, outbound=null | | ✓ |
| No outbound field | | |
| You decide | | |

---

## Full (public) propagation boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Passthrough SourceEvent | | ✓ (after clarification) |
| Explicit full allowlist | Initial pick; revised | |
| You decide | | |

**Notes:** User clarified public is fully public — propagate all properties; washer no-op for public.

| Option | Description | Selected |
|--------|-------------|----------|
| No-op for public | washed null in sidecars | ✓ |
| Strip ER categories only | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Defer parser enrichment to Phase 3 | | ✓ |
| Extend parser in Phase 2 | | |
| You decide | | |

---

## Fixture sidecars & test assertions

| Option | Description | Selected |
|--------|-------------|----------|
| Full expected OutboundEvent in `washed` | | ✓ |
| Partial key assertions | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full pipeline per recurrence fixture | | ✓ |
| Classify only for recurrence | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Add new .ics fixtures for conflicts | | |
| Unit tests only | | |
| You decide | | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Deep equality | | |
| Field-by-field helper | | |
| You decide | | ✓ |

**Notes:** User asked about test pyramid — answered in CONTEXT D-14 (unit-heavy, full pipeline depth on fixtures, integration in Phase 3).

---

## Domain module API

| Option | Description | Selected |
|--------|-------------|----------|
| Single `processSourceEvent` | | |
| Split classify + wash only | | |
| Submodules + top-level orchestrator | User description | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| domain/classify + domain/wash | | |
| Flat domain files | | |
| You decide | | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| OutboundEvent in domain/types | | ✓ |
| Owned by wash module | | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Classifier only | restrict-only | ✓ |
| Classifier + washer guard | | |
| You decide | | |

---

## Claude's Discretion

- Multi-tag conflict fixtures (minimal .ics vs synthesized tests)
- Module file layout within classify/wash subfolders
- Washed assertion helper implementation

## Deferred Ideas

- Attendee/organiser parsing — Phase 3
