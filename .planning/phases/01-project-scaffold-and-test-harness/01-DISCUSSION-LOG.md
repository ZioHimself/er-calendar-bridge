# Phase 1: Project scaffold and test harness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 01-project-scaffold-and-test-harness
**Areas discussed:** Source layout, Fixture library design, Scaffold tooling breadth, Test harness depth

---

## Source Layout

| Option | Description | Selected |
|--------|-------------|----------|
| ROADMAP three-layer | `src/domain/`, `src/adapters/`, `src/sync/` — matches success criteria | |
| ARCHITECTURE per-module | `src/ical/`, `src/classify/`, etc. — matches research doc | |
| Hybrid — three layers with subfolders | `src/domain/{ical,classify,wash}/`, etc. — satisfies both | ✓ |
| You decide | Pick structure for test-first domain work | |

**User's choice:** Hybrid, aligned with roadmap
**Notes:** Three-layer top-level layout with subfolders created on demand in later phases.

### Types location

| Option | Description | Selected |
|--------|-------------|----------|
| `src/domain/types/` | Keeps pure types with domain logic | ✓ |
| `src/types/` at root | Shared across all layers per ARCHITECTURE.md | |
| Co-located per module | Extract when duplication appears | |

**User's choice:** `src/domain/types/`

### Entry point

| Option | Description | Selected |
|--------|-------------|----------|
| Stub entry point | Minimal `src/index.ts` for tsc/tsx | ✓ |
| No entry point | Library-only; entry in Phase 3 | |
| CLI stub | Entry + commander for future `bridge sync` | |

**User's choice:** Stub entry point

### Empty module representation

| Option | Description | Selected |
|--------|-------------|----------|
| `.gitkeep` + README per folder | Documented placeholders | |
| `.gitkeep` only | Silent placeholders | ✓ |
| Create on demand | Only folders Phase 1/2 touch | |

**User's choice:** `.gitkeep` only

---

## Fixture Library Design

| Option | Description | Selected |
|--------|-------------|----------|
| Raw `.ics` files | Realistic, easy to inspect | ✓ |
| TypeScript builders | Programmatic VEVENT construction | |
| Both — .ics + load helper | Canonical .ics with parse helper | |

**User's choice:** Raw `.ics` files

### Organization

| Option | Description | Selected |
|--------|-------------|----------|
| By classification tier | `public/`, `internal/`, `sensitive/`, `untagged/`, `recurrence/` | ✓ |
| By test scenario | `classify/`, `wash/`, `recurrence/` | |
| Flat with descriptive names | No subdirectories | |

**User's choice:** By classification tier

### Recurrence coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal high-risk set | Series + modified instance + deleted instance | ✓ |
| Comprehensive RRULE set | Daily/weekly/monthly, EXDATE, RDATE | |
| Placeholder only | One simple recurring event | |

**User's choice:** Minimal high-risk set

### Expected-outcome metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Sidecar `.json` per fixture | `event.ics` + `event.expected.json` | ✓ |
| Inline in test files | Fixtures pure .ics; expectations in tests | |
| Single manifest.json | Centralized mapping | |

**User's choice:** Sidecar `.json` per fixture

**Notes:** User asked where test pyramid and acceptance tests would be discussed — answered: Test harness depth area (next).

---

## Scaffold Tooling Breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Node 24 LTS | STACK.md recommendation, active LTS | ✓ |
| Node 22 LTS | Previous LTS, wider CI compatibility | |
| engines: >=22 | Flexible range, 24 as dev standard | |

**User's choice:** Node 24 LTS

### Package manager

| Option | Description | Selected |
|--------|-------------|----------|
| npm | Default, minimum viable | ✓ |
| pnpm | Faster, stricter | |
| npm + lockfile committed | Reproducible CI | |

**User's choice:** npm (lockfile committed per D-10 in CONTEXT.md)

### npm scripts

| Option | Description | Selected |
|--------|-------------|----------|
| test + lint + typecheck + build | Full core scripts including tsc build | ✓ |
| test + lint + typecheck only | No build step yet | |
| core + dev via tsx | Adds `npm run dev` | |

**User's choice:** test + lint + typecheck + build

### Formatter

| Option | Description | Selected |
|--------|-------------|----------|
| No — eslint only | Minimum viable; Prettier in 01.1 if needed | ✓ |
| Prettier now | Consistent formatting from day one | |
| eslint stylistic rules | No Prettier dependency | |

**User's choice:** No formatter — eslint only

---

## Test Harness Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Unit-first with fixture smoke | Unit tests now; integration Phase 3; no E2E until pilot | ✓ |
| Scaffold unit + integration dirs | Empty integration/ until Phase 3 | |
| Co-located tests | `*.test.ts` next to source | |

**User's choice:** Unit-first with fixture smoke

### Acceptance tests timing

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 — mocked providers | Sync loop against fixture CalDAV + mocked Google API | ✓ |
| Phase 5 — manual pilot only | No automated acceptance | |
| Scaffold acceptance/ dir now | Placeholder with README | |

**User's choice:** Phase 3 integration with mocked providers

### Shared test helpers

| Option | Description | Selected |
|--------|-------------|----------|
| loadFixture + parseIcs + assertTier | Small `test/helpers/` module | ✓ |
| Fixtures only | No shared helpers | |
| vitest setupFiles + global matchers | Custom matchers registered globally | |

**User's choice:** loadFixture + parseIcs + assertTier helpers

### Smoke test scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fixture load + parse roundtrip | One fixture per tier; assert UID and CATEGORIES | ✓ |
| Hello-world only | `expect(true).toBe(true)` | |
| Full sidecar assertion | One fixture with full .expected.json validation | |

**User's choice:** Fixture load + parse roundtrip per tier

---

## Claude's Discretion

None — user made explicit choices in all areas.

## Deferred Ideas

- Prettier / code formatter → Phase 01.1 if CI needs it
- CLI entry point → Phase 3
- Integration test directory scaffold → Phase 3
- Comprehensive RRULE fixtures → Phase 2 if gaps found
