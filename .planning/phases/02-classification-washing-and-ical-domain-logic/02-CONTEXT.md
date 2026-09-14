# Phase 2: Classification, washing, and iCal domain logic - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the pure domain pipeline: classify iCalendar `CATEGORIES` into tiers with fail-closed defaults, wash events into full passthrough, busy-blocks, or drop, and prove behavior with unit tests against the Phase 1 fixture library (including recurrence). No CalDAV, Google API, SQLite, notifications, or Docker.

</domain>

<decisions>
## Implementation Decisions

### Classification (multi-value `CATEGORIES`, fail-closed)
- **D-01:** **Strictest-wins precedence** among ER tier tags on one event: `ER-SENSITIVE` ⇒ `drop`; mixed non-sensitive tiers (e.g. `ER-PUBLIC` + `ER-INTERNAL`) ⇒ `busy` (never full).
- **D-02:** Only a qualifying **public-only** classification yields `full` propagation (restrict-only): full content requires `ER-PUBLIC` without a stricter competing tier per D-01.
- **D-03:** **Unknown / non-ER** category values follow it-strategy default (equivalent to internal): contribute to **busy-block**, not full disclosure.
- **D-04:** Match ER tier tokens **case-insensitively**; parse multi-value `CATEGORIES` correctly (comma-separated values).

### Washing & outbound shape
- **D-05:** **Busy-block** summary is the fixed English string `"Busy"`.
- **D-06:** Busy-block **whitelist**: `uid`, `start`, `end` (when present), `summary`, plus **sync metadata** (`recurrenceId` and related fields needed for exception upserts in Phase 3). No location, description, attendees, organiser, attachments, or `CATEGORIES` on busy output.
- **D-07:** Stripped fields are **omitted** from `OutboundEvent` (not present as null/empty keys).
- **D-08:** **`drop`** propagation returns `outbound: null` with `propagation: 'drop'`.
- **D-09:** **Public tier**: washer is a **no-op** — outbound carries **all** properties currently on `SourceEvent` (full passthrough). Public fixture sidecars keep `washed: null`.

### Types & module API
- **D-10:** Submodules **`domain/classify/`** and **`domain/wash/`** with a top-level orchestrator (e.g. `processSourceEvent`) that runs classify then wash. Export split functions for focused unit tests.
- **D-11:** **`OutboundEvent`** lives in **`domain/types/`** alongside `SourceEvent`, `Tier`, and `PropagationDecision`.
- **D-12:** **Restrict-only** enforcement lives in the **classifier only**; washer trusts `PropagationDecision` (no second full-content guard).

### Attendees & parser scope
- **D-13:** **Defer** attendee/organiser parsing extensions to **Phase 3**; Phase 2 public passthrough covers whatever `SourceEvent` already contains.

### Tests & fixtures (TEST-04)
- **D-14:** **Test pyramid for this phase**: many fast **unit** tests on classify/wash; smoke tests remain thin; **no network**. Depth = parse → classify → wash → assert against sidecar for each tier fixture.
- **D-15:** Busy-tier (and applicable recurrence) `.expected.json` files populate **`washed` as a full expected `OutboundEvent`** object; recurrence fixtures run the **full pipeline**, not UID-only smoke checks.
- **D-16:** Extend test helpers (`assertTier` / `assertProcessed`) to compare washed output; assertion strategy (deep-equal vs field-by-field) is implementer discretion.

### Claude's Discretion
- **Multi-tag edge-case fixtures**: add minimal `.ics` + sidecar and/or synthesized `SourceEvent` unit tests to lock strictest-wins rules — planner chooses smallest sufficient set.
- **Module file layout** within `domain/classify/` and `domain/wash/` (file names, barrel exports).
- **Washed output assertion helper** implementation details (normalization of dates, forbidden-key scans).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Architecture (external — NGO IT strategy repo)
- `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md` — Classification, washing, restrict-only, SYNC-02–05, SYNC-08–10, TEST-04
- `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md` — Classifier/washer module boundaries, data flow step 3–4

### Project Planning (in-repo)
- `.planning/PROJECT.md` — Core value, fail-closed defaults, CATEGORIES model
- `.planning/REQUIREMENTS.md` — SYNC-02–05, SYNC-08–10, TEST-04 traceability
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria (busy-block field rule, restrict-only, recurrence)

### Prior Phase Context (in-repo)
- `.planning/phases/01-project-scaffold-and-test-harness/01-CONTEXT.md` — D-01 layout, D-06 fixture tiers, D-08 sidecars, D-15 assert helpers
- `.planning/phases/01.1-ci-pipeline/01.1-CONTEXT.md` — CI gate; no change to domain scope

### Research (in-repo)
- `.planning/research/ARCHITECTURE.md` — classify/wash build order, fail-closed classifier
- `.planning/research/PITFALLS.md` — #2 untagged leak, #5 PII in busy-blocks
- `.planning/research/FEATURES.md` — restrict-only classifier, drop sensitive

### Existing Code (in-repo)
- `src/domain/types/index.ts` — `SourceEvent`, `Tier`, `PropagationDecision`
- `src/adapters/ical/parse-source-event.ts` — parse boundary for tests
- `test/fixtures/**` — `.ics` + `.expected.json` sidecars
- `test/helpers/load-fixture.ts`, `test/helpers/assert-sidecar.ts` — extend for Phase 2 washed assertions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SourceEvent` / `Tier` / `PropagationDecision` types and fixture loader + smoke harness from Phase 1.
- Seven fixture sidecars already define `tier` and `propagation`; `washed` is null pending Phase 2 population for busy/recurrence cases.

### Established Patterns
- Parse only through `src/adapters/ical/`; domain logic stays pure (no `node-ical` in classify/wash).
- Hybrid layout: business logic under `src/domain/` with subfolders on demand (Phase 1 D-01).

### Integration Points
- Phase 3 sync loop will call the orchestrator after parse and before Google writer.
- `assert-sidecar.ts` TODO for full washed comparison — Phase 2 completes TEST-04 here.

</code_context>

<specifics>
## Specific Ideas

- User session title: "GSD Discuss classification, washing and domain logic 2".
- Strictest-wins applies consistently (sensitive beats public; internal+public ⇒ busy, not full).
- Public events: "fully public, no need to wash" — passthrough all parsed props.
- Test pyramid: unit-heavy domain coverage; integration waits for Phase 3; recurrence gets full pipeline assertions in Phase 2.

</specifics>

<deferred>
## Deferred Ideas

- **Attendee/organiser on `SourceEvent`** — Phase 3 parser/adapter enrichment; public passthrough will include them once parsed.
- **Withhold notifications / audit** — Phase 4 (not this phase).

</deferred>

---

*Phase: 2-Classification, washing, and iCal domain logic*
*Context gathered: 2026-09-14*
