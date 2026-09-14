# Phase 2: Classification, washing, and iCal domain logic - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 18
**Analogs found:** 15 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/domain/types/index.ts` | model | transform | `src/domain/types/index.ts` (extend) | exact |
| `src/domain/classify/classify-source-event.ts` | service | transform | `src/adapters/ical/parse-source-event.ts` | partial (pure map) |
| `src/domain/classify/index.ts` | utility (barrel) | transform | `src/adapters/ical/index.ts` | exact |
| `src/domain/wash/wash-source-event.ts` | service | transform | `src/adapters/ical/parse-source-event.ts` | partial (field projection) |
| `src/domain/wash/index.ts` | utility (barrel) | transform | `src/adapters/ical/index.ts` | exact |
| `src/domain/process-source-event.ts` | service | transform | `src/adapters/ical/parse-source-event.ts` | partial (pipeline compose) |
| `test/domain/classify.test.ts` | test | batch | `test/smoke.test.ts` | role-match |
| `test/domain/wash.test.ts` | test | batch | `test/smoke.test.ts` | role-match |
| `test/domain/pipeline-fixtures.test.ts` | test | batch | `test/smoke.test.ts` | exact |
| `test/helpers/assert-sidecar.ts` | utility | transform | `test/helpers/assert-sidecar.ts` (extend) | exact |
| `test/fixtures/internal/team-sync.expected.json` | test data | file-I/O | `test/fixtures/internal/team-sync.expected.json` | exact |
| `test/fixtures/untagged/unclassified.expected.json` | test data | file-I/O | same sidecar schema | exact |
| `test/fixtures/recurrence/*.expected.json` (3 files) | test data | file-I/O | same sidecar schema | exact |
| `test/fixtures/public/board-meeting.expected.json` | test data | file-I/O | unchanged (`washed: null`) | exact |
| `test/fixtures/sensitive/hr-review.expected.json` | test data | file-I/O | unchanged (`washed: null`) | exact |
| Optional: multi-tag `.ics` + sidecar | test data | file-I/O | `test/fixtures/internal/team-sync.*` | role-match |
| Optional: synthesized edge-case only in unit tests | test | transform | `test/domain/classify.test.ts` (new) | no analog |

## Pattern Assignments

### `src/domain/types/index.ts` (model, transform)

**Analog:** Existing `src/domain/types/index.ts` — extend in place; do not split types into separate files.

**Current type pattern** (lines 1–15):

```typescript
export type Tier = 'public' | 'internal' | 'sensitive' | 'untagged';

export type PropagationDecision = 'full' | 'busy' | 'drop';

export interface SourceEvent {
  uid: string;
  categories: string[];
  summary?: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  recurrenceId?: Date;
  isRecurring: boolean;
}
```

**Extension pattern (Phase 2):**

- Add `OutboundEvent` with the same optional fields as `SourceEvent` where passthrough applies, but busy output is built via whitelist only (D-06/D-07).
- Add `Classification` (or equivalent) as `{ tier: Tier; propagation: PropagationDecision }`.
- Add `ProcessedSourceEvent` as `{ tier: Tier; propagation: PropagationDecision; outbound: OutboundEvent | null }`.
- Reuse existing `Tier` and `PropagationDecision` literals — do not introduce parallel enum names.

**Boundary rule (Phase 1 D-02):** Domain types stay here; `classify/` and `wash/` import types only; domain never imports adapters or `node-ical`.

---

### `src/domain/classify/classify-source-event.ts` (service, transform)

**Analog:** `src/adapters/ical/parse-source-event.ts` — pure input→output mapping with explicit normalization, no I/O.

**Imports pattern** (adapter lines 1–3 → domain equivalent):

```typescript
import type { SourceEvent, Tier, PropagationDecision } from '../types/index.js';
```

**Categories input pattern** (adapter lines 43–45, 104–106):

```typescript
  return {
    uid: vevent.uid,
    categories: vevent.categories ?? [],
    // ...
  };

export function getCategories(event: SourceEvent): string[] {
  return event.categories;
}
```

Classifier reads `event.categories` only — **no** re-splitting of iCal comma lists (adapter owns that). Normalize each token with `trim()` + case fold for ER matching (02-RESEARCH.md decision table).

**Core pure-function export pattern** (adapter lines 94–102):

```typescript
export function parseIcsToSourceEvent(ics: string): SourceEvent {
  const events = parseIcsToSourceEvents(ics);
  const override = events.find((event) => event.recurrenceId !== undefined);
  const primary = events[0];
  if (!primary) {
    throw new Error('No VEVENT found in fixture');
  }
  return override ?? primary;
}
```

Mirror with `export function classifySourceEvent(event: SourceEvent): Classification` — single exported entry, deterministic return, no side effects. Policy table lives entirely in this module (D-12 restrict-only gate).

**Error handling:** Classification should not throw on unknown categories — map fail-closed to `busy` per D-03. Reserve `throw new Error(...)` for programmer errors only (if any), matching adapter style for impossible states.

---

### `src/domain/classify/index.ts` (utility, barrel)

**Analog:** `src/adapters/ical/index.ts`

**Barrel pattern** (lines 1–5):

```typescript
export {
  parseIcsToSourceEvent,
  parseIcsToSourceEvents,
  getCategories,
} from './parse-source-event.js';
```

Apply to `classify/index.ts`:

```typescript
export { classifySourceEvent } from './classify-source-event.js';
```

---

### `src/domain/wash/wash-source-event.ts` (service, transform)

**Analog:** `src/adapters/ical/parse-source-event.ts` — explicit field-by-field object construction (whitelist), not spread-from-source for busy path.

**Whitelist construction pattern** (adapter lines 35–53):

```typescript
function veventToSourceEvent(vevent: ParsableVEvent): SourceEvent {
  if (!vevent.uid) {
    throw new Error('VEVENT missing required UID');
  }
  if (!vevent.start) {
    throw new Error('VEVENT missing required DTSTART');
  }

  return {
    uid: vevent.uid,
    categories: vevent.categories ?? [],
    summary: asString(vevent.summary),
    description: asString(vevent.description),
    location: asString(vevent.location),
    start: vevent.start,
    end: vevent.end,
    recurrenceId: vevent.recurrenceid,
    isRecurring: Boolean(vevent.rrule),
  };
}
```

Busy wash copies **only** allowed keys (`uid`, `start`, optional `end`, `summary: 'Busy'`, sync metadata `recurrenceId`, `isRecurring` when applicable). Do **not** use `{ ...source, summary: 'Busy' }` (02-RESEARCH anti-pattern).

**Propagation branches (D-05–D-09):**

- `drop` → return `null`
- `full` → passthrough: `{ ...source }` or equivalent copying all current `SourceEvent` fields
- `busy` → new object from whitelist only; omit stripped keys entirely (D-07)

**Signature pattern:**

```typescript
export function washSourceEvent(
  source: SourceEvent,
  propagation: PropagationDecision,
): OutboundEvent | null
```

Washer must **not** re-classify or promote to `full` (D-12).

---

### `src/domain/wash/index.ts` (utility, barrel)

**Analog:** `src/adapters/ical/index.ts` — same re-export pattern as `classify/index.ts`.

---

### `src/domain/process-source-event.ts` (service, transform)

**Analog:** `src/adapters/ical/parse-source-event.ts` — sequential pipeline composing smaller pure steps.

**Pipeline composition pattern** (adapter lines 83–91):

```typescript
export function parseIcsToSourceEvents(ics: string): SourceEvent[] {
  const vevent = findFirstVEvent(ical.parseICS(ics));
  const events = [veventToSourceEvent(vevent)];

  for (const override of collectRecurrenceOverrides(vevent)) {
    events.push(veventToSourceEvent(override));
  }

  return events;
}
```

Orchestrator equivalent:

```typescript
export function processSourceEvent(source: SourceEvent): ProcessedSourceEvent {
  const { tier, propagation } = classifySourceEvent(source);
  const outbound = washSourceEvent(source, propagation);
  return { tier, propagation, outbound };
}
```

**Imports:** `classifySourceEvent` from `./classify/index.js`, `washSourceEvent` from `./wash/index.js`, types from `./types/index.js`.

---

### `test/helpers/assert-sidecar.ts` (utility, transform) — extend

**Analog:** Current `test/helpers/assert-sidecar.ts`

**Existing assertion style** (lines 1–22):

```typescript
import type { SourceEvent } from '../../src/domain/types/index.js';
import type { FixtureExpected } from './load-fixture.js';
import { getCategories } from './parse-ics.js';

export function assertTier(event: SourceEvent, expected: FixtureExpected): void {
  if (event.uid !== expected.uid) {
    throw new Error(
      `UID mismatch: expected ${expected.uid}, got ${event.uid}`,
    );
  }

  const categories = getCategories(event);
  for (const cat of expected.categories) {
    if (!categories.includes(cat)) {
      throw new Error(
        `Missing category ${cat}: got [${categories.join(', ')}]`,
      );
    }
  }

  // TODO: full washed-field comparison in Phase 2
}
```

**Phase 2 additions:**

- `assertProcessed(result: ProcessedSourceEvent, expected: FixtureExpected)` — compare `tier`, `propagation`, and `outbound` vs `expected.washed`.
- Normalize JSON sidecar ISO strings on known date fields (`start`, `end`, `recurrenceId`) to `Date` before deep compare (02-RESEARCH Pitfall 5).
- Optional `assertBusyOutbound(outbound)` forbidden-key scan: `categories`, `description`, `location`; `summary === 'Busy'`.
- Keep `assertTier` for smoke compatibility or delegate from `assertProcessed` for parse-only paths.

**Error handling:** Continue `throw new Error('...')` with explicit messages — no vitest assertions inside helpers.

---

### `test/domain/pipeline-fixtures.test.ts` (test, batch)

**Analog:** `test/smoke.test.ts`

**Imports pattern** (lines 1–4):

```typescript
import { describe, it, expect } from 'vitest';
import { loadFixture } from './helpers/load-fixture.js';
import { parseIcs, getCategories } from './helpers/parse-ics.js';
import { assertTier } from './helpers/assert-sidecar.js';
```

**Parameterized fixture loop** (lines 6–31):

```typescript
const TIER_FIXTURES = [
  { tier: 'public' as const, name: 'board-meeting' },
  { tier: 'internal' as const, name: 'team-sync' },
  { tier: 'sensitive' as const, name: 'hr-review' },
  { tier: 'untagged' as const, name: 'unclassified' },
];

describe('fixture harness smoke', () => {
  for (const { tier, name } of TIER_FIXTURES) {
    it(`parses ${tier}/${name} and matches sidecar`, async () => {
      const { ics, expected } = await loadFixture(tier, name);
      const event = parseIcs(ics);
      // ...
    });
  }
```

**Pipeline extension:** Import `processSourceEvent` from `../../src/domain/process-source-event.js` and `assertProcessed` from `../helpers/assert-sidecar.js`. Replace UID-only recurrence check with full `processSourceEvent(parseIcs(ics))` + `assertProcessed` for `recurrence/*` fixtures (D-15).

**Parse boundary** (must use helper, not adapter directly in tests):

```typescript
import { parseIcs } from '../helpers/parse-ics.js';
```

From `test/helpers/parse-ics.ts` (lines 1–8):

```typescript
import {
  parseIcsToSourceEvent,
  getCategories,
} from '../../src/adapters/ical/index.js';
import type { SourceEvent } from '../../src/domain/types/index.js';

export function parseIcs(ics: string): SourceEvent {
  return parseIcsToSourceEvent(ics);
}
```

---

### `test/domain/classify.test.ts` & `test/domain/wash.test.ts` (test, batch)

**Analog:** `test/smoke.test.ts` — vitest structure only; no isolated domain unit files exist yet.

**Test harness conventions:**

- `globals: false` — import `describe`, `it`, `expect` from `vitest` (`vitest.config.ts` lines 3–8).
- Construct in-memory `SourceEvent` objects for edge cases (mixed tags, case insensitivity) without new fixtures when sufficient (D-01 discretion).
- Import domain functions from `../../src/domain/classify/index.js` and `../../src/domain/wash/index.js` with `.js` extensions.

**Reference behavior tables:** 02-RESEARCH.md Pattern 1–2 examples for expected inputs/outputs.

---

### Busy/recurrence `*.expected.json` updates (test data, file-I/O)

**Analog:** `test/fixtures/internal/team-sync.expected.json`

**Current sidecar shape** (lines 1–7):

```json
{
  "uid": "team-sync-2026@er.example",
  "categories": ["ER-INTERNAL"],
  "tier": "internal",
  "propagation": "busy",
  "washed": null
}
```

**Phase 2 population (D-15):** Set `washed` to full expected `OutboundEvent` for busy-tier fixtures (`internal/team-sync`, `untagged/unclassified`, all three `recurrence/*`). Use UTC ISO strings for instants (verify via `parseIcs` + pipeline). Example busy fragment from 02-RESEARCH.md:

```json
"washed": {
  "uid": "team-sync-2026@er.example",
  "start": "2026-09-16T08:00:00.000Z",
  "end": "2026-09-16T08:30:00.000Z",
  "summary": "Busy"
}
```

**Unchanged sidecars:** `public/board-meeting` and `sensitive/hr-review` keep `"washed": null`; pipeline tests assert `outbound` passthrough or `null` directly.

**Schema source:** `test/helpers/load-fixture.ts` `FixtureExpected` (lines 8–14):

```typescript
export interface FixtureExpected {
  uid: string;
  categories: string[];
  tier: 'public' | 'internal' | 'sensitive' | 'untagged';
  propagation: 'full' | 'busy' | 'drop';
  washed: Record<string, unknown> | null;
}
```

---

## Shared Patterns

### ESM imports with `.js` extensions (NodeNext)

**Source:** `src/adapters/ical/parse-source-event.ts` line 3, `test/helpers/parse-ics.ts` lines 1–5  
**Apply to:** All new `src/domain/**` and `test/domain/**` files

```typescript
import type { SourceEvent } from '../../domain/types/index.js';
```

Relative paths from domain subfolders use `../types/index.js`; tests use `../../src/domain/...`.

### Adapter boundary (no `node-ical` in domain/tests)

**Source:** `test/helpers/parse-ics.ts` (lines 1–8)  
**Apply to:** `classify/`, `wash/`, `process-source-event.ts`, all domain tests

Tests and domain import `SourceEvent` and call `parseIcs()` helper only — never `import ical from 'node-ical'`.

### Barrel re-exports per module folder

**Source:** `src/adapters/ical/index.ts` (lines 1–5)  
**Apply to:** `src/domain/classify/index.ts`, `src/domain/wash/index.ts`

### Fixture loading

**Source:** `test/helpers/load-fixture.ts` (lines 16–25)

```typescript
export async function loadFixture(
  tier: 'public' | 'internal' | 'sensitive' | 'untagged' | 'recurrence',
  name: string,
): Promise<{ ics: string; expected: FixtureExpected }> {
  const dir = join(FIXTURES_ROOT, tier);
  const ics = await readFile(join(dir, `${name}.ics`), 'utf8');
  const expected = JSON.parse(
    await readFile(join(dir, `${name}.expected.json`), 'utf8'),
  ) as FixtureExpected;
  return { ics, expected };
}
```

### Vitest project config

**Source:** `vitest.config.ts` (lines 3–8)

```typescript
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
  },
});
```

New tests under `test/domain/*.test.ts` are picked up automatically.

### Security policy placement

**Source:** 02-CONTEXT.md D-12, 02-RESEARCH.md Pattern 1  
**Apply to:** Classifier only — one auditable decision table; washer is mechanical projection.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `test/domain/classify.test.ts` | test | batch | No domain unit tests in repo yet; copy vitest structure from `smoke.test.ts` + RESEARCH examples |
| `test/domain/wash.test.ts` | test | batch | Same as above |
| Synthesized-only multi-tag cases (no `.ics`) | test | transform | No in-memory domain test precedent; use minimal `SourceEvent` literals in new unit files |

---

## Metadata

**Analog search scope:** `src/domain/`, `src/adapters/ical/`, `test/helpers/`, `test/smoke.test.ts`, `test/fixtures/**`, `.planning/phases/01-project-scaffold-and-test-harness/01-PATTERNS.md`  
**Files scanned:** ~20 application/test files  
**Pattern extraction date:** 2026-09-14
