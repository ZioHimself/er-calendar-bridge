# Phase 1: Project scaffold and test harness - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Bootstrap a strict TypeScript Node project with vitest, lint/typecheck/build scripts, and a fixture-driven test harness for iCalendar samples — including recurrence exceptions — so all later business logic and sync code can be developed test-first.

This phase delivers the project skeleton and test infrastructure only. No classification logic, CalDAV integration, or sync loop.

</domain>

<decisions>
## Implementation Decisions

### Source Layout
- **D-01:** Hybrid three-layer layout aligned with ROADMAP success criteria: `src/domain/`, `src/adapters/`, `src/sync/`. Subfolders (e.g., `domain/ical/`, `domain/classify/`, `adapters/caldav/`) are created on demand in later phases — not pre-scaffolded beyond `.gitkeep` placeholders.
- **D-02:** Shared domain types live at `src/domain/types/` (e.g., `SourceEvent`, `Tier`, `PropagationDecision`). Adapters import from domain; domain never imports adapters.
- **D-03:** Include a minimal stub entry point at `src/index.ts` so `tsc` build and future `tsx` dev runner work from day one. No CLI or commander stub yet.
- **D-04:** Empty future module folders use `.gitkeep` only — no README per folder.

### Fixture Library Design
- **D-05:** Fixtures are raw `.ics` files — realistic CalDAV payloads, easy to inspect.
- **D-06:** Organize by classification tier: `test/fixtures/public/`, `internal/`, `sensitive/`, `untagged/`, `recurrence/`.
- **D-07:** Recurrence coverage is a minimal high-risk set: one recurring series, one modified instance, one deleted instance.
- **D-08:** Each fixture has a sidecar `.expected.json` with expected tier, washed fields, and propagation decision. Tests assert against the sidecar.

### Scaffold Tooling
- **D-09:** Target Node.js 24 LTS. Set `engines` in `package.json` accordingly.
- **D-10:** Use npm with committed `package-lock.json` for reproducible CI in Phase 01.1.
- **D-11:** Phase 1 npm scripts: `test` (vitest), `lint` (eslint), `typecheck` (tsc --noEmit), `build` (tsc -p → `dist/`).
- **D-12:** No code formatter in Phase 1 — eslint only. Prettier deferred unless Phase 01.1 CI needs it.

### Test Harness Depth
- **D-13:** Unit-first test pyramid. Phase 1 establishes vitest unit tests against `.ics` fixtures. Integration tests added in Phase 3 (mocked CalDAV/API). No E2E until pilot.
- **D-14:** Acceptance tests enter in Phase 3 — sync loop against fixture CalDAV responses + mocked Google API. No live provider credentials (aligns with TEST-05).
- **D-15:** Shared test helpers in `test/helpers/`: `loadFixture()`, `parseIcs()` (via `@pipobscure/ical`), `assertTier()` / sidecar comparison against `.expected.json`.
- **D-16:** Smoke test loads one `.ics` fixture per tier, parses successfully, asserts UID and CATEGORIES are present. Proves harness is wired — not a trivial hello-world.

### Claude's Discretion
None — all discussed areas had explicit user choices.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Architecture (external — NGO IT strategy repo)
- `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md` — Full v1 requirements, classification rules, security constraints
- `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md` — Component model, module boundaries, data flow, deployment

### Project Planning (in-repo)
- `.planning/PROJECT.md` — Core value, constraints (TypeScript strict, fail-closed), key decisions
- `.planning/REQUIREMENTS.md` — TEST-01/02/03/OPS-04 mapped to this phase; traceability table
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, canonical refs

### Research (in-repo — stack and architecture guidance)
- `.planning/research/STACK.md` — Node 24, vitest, @pipobscure/ical, eslint, dependency versions
- `.planning/research/ARCHITECTURE.md` — Module boundaries, build order, TypeScript patterns (inform subfolder placement within the three-layer layout)
- `.planning/research/PITFALLS.md` — Known landmines (recurrence, CalDAV quirks)
- `.planning/research/FEATURES.md` — Table stakes vs anti-features

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repository. Only planning artifacts and README exist.

### Established Patterns
- No existing code conventions. Phase 1 establishes the baseline: strict TypeScript, ESM modules, vitest, eslint + typescript-eslint.
- ARCHITECTURE.md proposes per-module folders; ROADMAP mandates three-layer layout. Decision D-01 reconciles both: three layers now, fine-grained subfolders on demand.

### Integration Points
- `src/index.ts` stub — future home for sync loop entry (Phase 3).
- `test/fixtures/` — consumed by Phase 2 domain tests (classify, wash) without modification.
- `.env.example` — documents config keys for later phases; no secrets in Phase 1.

</code_context>

<specifics>
## Specific Ideas

- User asked about test pyramid and acceptance tests during fixture discussion — clarified that acceptance tests belong in Phase 3 with mocked providers, not Phase 1.
- Minimum viable tooling (OPS-04) is a recurring constraint: no Prettier, no over-scaffolding of empty modules.
- Recurrence exceptions are highest-risk (per STATE.md) — minimal but explicit fixture set in Phase 1.

</specifics>

<deferred>
## Deferred Ideas

- **Prettier / code formatter** — deferred to Phase 01.1 if CI needs enforced formatting.
- **CLI entry point (`bridge sync`)** — deferred to Phase 3 when sync loop exists.
- **Integration test directory scaffold** — deferred; unit-first now, integration tests added when CalDAV/API adapters land in Phase 3.
- **Comprehensive RRULE fixture set** — minimal high-risk set in Phase 1; expand in Phase 2 if domain tests reveal gaps.

</deferred>

---

*Phase: 1-Project scaffold and test harness*
*Context gathered: 2026-09-13*
