# Phase 1: Project scaffold and test harness - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 28 (grouped; see classification)
**Analogs found:** 0 / 28

> **Greenfield repository.** No application source code exists yet — only planning artifacts (`README.md`, `.planning/`). Phase 1 **establishes** all baseline patterns. The planner must use locked decisions in `01-CONTEXT.md` and code examples in `01-RESEARCH.md` as establishment templates, not copy from existing repo files.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` | config | batch | — | **none** (establish) |
| `package-lock.json` | config | — | — | **none** (establish) |
| `tsconfig.json` | config | transform | — | **none** (establish) |
| `vitest.config.ts` | config | batch | — | **none** (establish) |
| `eslint.config.mjs` | config | transform | — | **none** (establish) |
| `.env.example` | config | file-I/O | — | **none** (establish) |
| `.gitignore` | config | — | — | **none** (establish) |
| `src/index.ts` | entry | request-response (stub) | — | **none** (establish) |
| `src/domain/types/index.ts` | model | transform | — | **none** (establish) |
| `src/domain/.gitkeep` | placeholder | — | — | **none** (establish) |
| `src/adapters/.gitkeep` | placeholder | — | — | **none** (establish) |
| `src/sync/.gitkeep` | placeholder | — | — | **none** (establish) |
| `test/helpers/load-fixture.ts` | utility | file-I/O | — | **none** (establish) |
| `test/helpers/parse-ics.ts` | utility | transform | — | **none** (establish) |
| `test/helpers/assert-sidecar.ts` | utility | transform | — | **none** (establish) |
| `test/smoke.test.ts` | test | batch | — | **none** (establish) |
| `test/fixtures/{tier}/*.ics` | test data | file-I/O | — | **none** (establish) |
| `test/fixtures/{tier}/*.expected.json` | test data | file-I/O | — | **none** (establish) |

**Fixture inventory (8 pairs + 3 recurrence):**

| Tier | `.ics` name | Sidecar |
|------|-------------|---------|
| `public/` | `board-meeting.ics` | `board-meeting.expected.json` |
| `internal/` | `team-sync.ics` | `team-sync.expected.json` |
| `sensitive/` | `hr-review.ics` | `hr-review.expected.json` |
| `untagged/` | `unclassified.ics` | `unclassified.expected.json` |
| `recurrence/` | `weekly-series.ics`, `modified-instance.ics`, `deleted-instance.ics` | matching `.expected.json` each |

## Pattern Assignments

### `package.json` (config, batch)

**Analog:** None — establish from `01-RESEARCH.md` Pattern 1 + D-09/D-10/D-11.

**Core pattern** (`01-RESEARCH.md` lines 241-246, 293):
```json
{
  "type": "module",
  "engines": { "node": "24.x" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  }
}
```

**Dependency scope (Phase 1 only):**
- Runtime: `node-ical@0.27.2` (imported only in `src/adapters/ical/`)
- Dev: `typescript@5.9.3`, `vitest@5.0.0`, `tsx@4.23.13`, `eslint@10.10.0`, `@eslint/js@10.0.1`, `typescript-eslint@8.70.0`, `@types/node@26.5.1`
- Do **not** install CalDAV/API deps yet (D-12, OPS-04)

---

### `tsconfig.json` (config, transform)

**Analog:** None — establish from `01-RESEARCH.md` Pattern 1.

**Core pattern** (`01-RESEARCH.md` lines 249-269):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**Import convention (Pitfall 1):** Relative imports in `src/` use `.js` extensions (e.g. `import { Tier } from './types/index.js'`). NodeNext emits `.js` paths even from `.ts` sources.

**Test typecheck gap (Pitfall 2):** Main tsconfig excludes `test/`. Acceptable for Phase 1 minimum viable; vitest resolves `.ts` at runtime. Optional `tsconfig.test.json` deferred unless IDE/CI needs it.

---

### `vitest.config.ts` (config, batch)

**Analog:** None — establish from `01-RESEARCH.md` Pattern 2.

**Core pattern** (`01-RESEARCH.md` lines 280-290):
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
  },
});
```

---

### `eslint.config.mjs` (config, transform)

**Analog:** None — establish from `01-RESEARCH.md` Pattern 5.

**Core pattern** (`01-RESEARCH.md` lines 357-369):
```javascript
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'node_modules/', '.vitest/'] },
  {
    files: ['**/*.{js,mjs,ts}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
);
```

**Constraint:** `recommended` only — no `strictTypeChecked` in Phase 1 (OPS-04, D-12). No Prettier.

---

### `src/index.ts` (entry, request-response stub)

**Analog:** None — establish from `01-RESEARCH.md` D-03 example.

**Core pattern** (`01-RESEARCH.md` lines 537-547):
```typescript
export const VERSION = '0.0.0';

export function main(): void {
  console.log(`er-calendar-bridge v${VERSION} — scaffold only`);
}

// Allow `tsx src/index.ts` without CLI framework
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

**Future integration point:** Phase 3 sync loop entry; no commander/CLI stub yet.

---

### `src/domain/types/index.ts` (model, transform)

**Analog:** None — establish from `01-CONTEXT.md` D-02 + `.planning/research/ARCHITECTURE.md` TypeScript Patterns.

**Core pattern (type stubs only — no business logic):**
```typescript
export type Tier = 'public' | 'internal' | 'sensitive' | 'untagged';

export type PropagationDecision = 'full' | 'busy' | 'drop';

export interface SourceEvent {
  uid: string;
  categories: string[];
  // Expanded in Phase 2 when ical/classify modules land
}
```

**Boundary rule (D-02):** Domain types live here; adapters import from domain; domain never imports adapters.

**Note:** ARCHITECTURE.md originally proposed `src/types/`; D-01 reconciles to `src/domain/types/`. Follow D-01.

---

### `test/helpers/load-fixture.ts` (utility, file-I/O)

**Analog:** None — establish from `01-RESEARCH.md` Code Examples.

**Imports pattern** (`01-RESEARCH.md` lines 442-445):
```typescript
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
```

**Core pattern** (`01-RESEARCH.md` lines 447-468):
```typescript
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, '..', 'fixtures');

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

export interface FixtureExpected {
  uid: string;
  categories: string[];
  tier: 'public' | 'internal' | 'sensitive' | 'untagged';
  propagation: 'full' | 'busy' | 'drop';
  washed: Record<string, unknown> | null;
}
```

**Test import convention:** Helpers imported with `.js` extension from tests (e.g. `./helpers/load-fixture.js`).

---

### `src/adapters/ical/parse-source-event.ts` (adapter, transform)

**Analog:** None — establish from `01-RESEARCH.md` adapter example. **Sole file that imports `node-ical`.**

**Core pattern:** `ical.parseICS(ics)` → `findFirstVEvent()` → map `VEvent` to domain `SourceEvent`. Private `asString()` normalizes `ParameterValue` fields.

**Exports:** `parseIcsToSourceEvent(ics: string): SourceEvent`, `getCategories(event: SourceEvent): string[]`

**Boundary rule:** Domain and `test/` never import `node-ical` — only this adapter.

---

### `test/helpers/parse-ics.ts` (utility, transform)

**Analog:** None — thin wrapper over adapter.

**Core pattern:**
```typescript
import { parseIcsToSourceEvent, getCategories } from '../../src/adapters/ical/index.js';
import type { SourceEvent } from '../../src/domain/types/index.js';

export function parseIcs(ics: string): SourceEvent {
  return parseIcsToSourceEvent(ics);
}

export { getCategories };
```

**Pitfall 3:** node-ical `ParameterValue` fields normalized in adapter — tests use `SourceEvent` only.

---

### `test/helpers/assert-sidecar.ts` (utility, transform)

**Analog:** None — scaffold only in Phase 1.

**Establishment pattern:** Export `assertTier()` and sidecar comparison helpers that compare parsed event fields against `FixtureExpected`. Phase 1 smoke test does **not** exercise full comparison (D-16); scaffold the API so Phase 2 domain tests can call it without refactor.

**Suggested signature:**
```typescript
import type { FixtureExpected } from './load-fixture.js';
import type { SourceEvent } from '../../src/domain/types/index.js';
import { getCategories } from './parse-ics.js';

export function assertTier(event: SourceEvent, expected: FixtureExpected): void {
  // Phase 1: stub or minimal uid/categories check
  // Phase 2: full tier + propagation + washed field comparison
}
```

---

### `test/smoke.test.ts` (test, batch)

**Analog:** None — establish from `01-RESEARCH.md` D-16 smoke test.

**Imports pattern** (`01-RESEARCH.md` lines 498-500):
```typescript
import { describe, it, expect } from 'vitest';
import { loadFixture } from './helpers/load-fixture.js';
import { parseIcs, getCategories } from './helpers/parse-ics.js';
```

**Core pattern** (`01-RESEARCH.md` lines 502-531):
```typescript
const TIER_FIXTURES = [
  { tier: 'public' as const, name: 'board-meeting' },
  { tier: 'internal' as const, name: 'team-sync' },
  { tier: 'sensitive' as const, name: 'hr-review' },
  { tier: 'untagged' as const, name: 'unclassified' },
];

describe('fixture harness smoke', () => {
  for (const { tier, name } of TIER_FIXTURES) {
    it(`parses ${tier}/${name}.ics with UID and CATEGORIES`, async () => {
      const { ics, expected } = await loadFixture(tier, name);
      const event = parseIcs(ics);

      expect(event.uid).toBe(expected.uid);
      const categories = getCategories(event);
      expect(categories.length).toBeGreaterThan(0);
      for (const cat of expected.categories) {
        expect(categories).toContain(cat);
      }
    });
  }

  it('parses recurrence fixtures without error', async () => {
    for (const name of ['weekly-series', 'modified-instance', 'deleted-instance']) {
      const { ics } = await loadFixture('recurrence', name);
      const event = parseIcs(ics);
      expect(event.uid).toBeTruthy();
    }
  });
});
```

**D-16 constraint:** Must parse real `.ics` fixtures — not a hello-world trivial test.

---

### `test/fixtures/**/*.ics` + `*.expected.json` (test data, file-I/O)

**Analog:** None — establish from `01-RESEARCH.md` Patterns 3–4.

**Sidecar convention** (`01-RESEARCH.md` lines 301-308):
```json
{
  "uid": "board-meeting-2026@er.example",
  "categories": ["ER-PUBLIC"],
  "tier": "public",
  "propagation": "full",
  "washed": null
}
```

**Recurrence fixtures** (`01-RESEARCH.md` lines 318-348):

| File | RFC 5545 mechanism | Validates |
|------|-------------------|-----------|
| `weekly-series.ics` | `RRULE:FREQ=WEEKLY` on master | `event.rrules` populated |
| `modified-instance.ics` | Second VEVENT + `RECURRENCE-ID` | Override instance parsing |
| `deleted-instance.ics` | `EXDATE` or `STATUS:CANCELLED` | Deleted occurrence handling |

**Modified instance excerpt** (`01-RESEARCH.md` lines 326-348) — use consistent `TZID=Europe/Brussels` across master, RECURRENCE-ID, and EXDATE (Pitfall 4).

**Data safety:** Synthetic UIDs/names only (`@er.example`). No real PII or credentials (Pitfall 6).

**Untagged fixture:** Omit `CATEGORIES` line entirely — do not send empty CATEGORIES (Open Question 2 in RESEARCH).

---

### `.env.example` (config, file-I/O)

**Analog:** None — establish from `01-RESEARCH.md` Code Examples.

**Core pattern** (`01-RESEARCH.md` lines 553-577):
```bash
MAILBOX_CALDAV_URL=https://dav.mailbox.org
MAILBOX_USERNAME=operator@example.org
MAILBOX_APP_PASSWORD=your-app-password-here
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@example.org
LOG_LEVEL=info
SYNC_INTERVAL_MINUTES=5
```

**Constraint:** Documentation only — no runtime config loader in Phase 1. Key names are `[ASSUMED]`; reconcile in Phase 3.

---

### `.gitignore` (config)

**Analog:** None — establish per RESEARCH Wave 0 gaps.

**Required entries:**
```
node_modules/
dist/
.env
.vitest/
```

---

### `.gitkeep` placeholders (`src/domain/`, `src/adapters/`, `src/sync/`)

**Analog:** None — D-01/D-04.

**Pattern:** Empty directory tracked via `.gitkeep` only. No README per folder. Subfolders (`domain/ical/`, `adapters/caldav/`) created on demand in later phases.

---

## Shared Patterns

### ESM + NodeNext (project-wide)

**Source:** `01-RESEARCH.md` Pattern 1
**Apply to:** All `src/` and `test/` TypeScript files

```json
{ "type": "module", "engines": { "node": "24.x" } }
```

- Pure ESM — no `require()`; `node-ical` imported via ESM in adapter only
- `module` / `moduleResolution`: `"NodeNext"`
- Relative imports use `.js` extension in source

### Three-layer source layout

**Source:** `01-CONTEXT.md` D-01, `.planning/research/ARCHITECTURE.md`
**Apply to:** `src/` directory structure

```
src/
├── index.ts           # entry stub
├── domain/            # pure types + business logic (later)
│   └── types/
├── adapters/          # CalDAV, Google, Graph (later)
└── sync/              # orchestration loop (later)
```

**Dependency direction:** `adapters` → `domain` ← `sync`. Domain never imports adapters.

### Strict TypeScript + fail-closed

**Source:** `.planning/PROJECT.md` Constraints
**Apply to:** `tsconfig.json`, domain type design

- `strict: true`, `noUncheckedIndexedAccess: true`
- No `any` — parse iCal into typed structures before business logic
- Classifier will default untagged → internal (Phase 2); fixtures should reflect restrict-only posture

### Fixture + sidecar test convention

**Source:** `01-RESEARCH.md` Pattern 3, D-08
**Apply to:** All `test/fixtures/` files and test helpers

- Each `.ics` paired with `.expected.json` in same directory
- Sidecar fields: `uid`, `categories`, `tier`, `propagation`, `washed`
- Phase 1 smoke: parse + UID/CATEGORIES; full sidecar comparison in Phase 2

### Validation commands (per-commit / per-wave)

**Source:** `01-RESEARCH.md` Validation Architecture
**Apply to:** All Phase 1 tasks

| When | Commands |
|------|----------|
| Per task commit | `npm test && npm run typecheck` |
| Per wave merge | `npm test && npm run typecheck && npm run lint && npm run build` |
| Phase gate | All four scripts green |

### Package install gate

**Source:** `01-RESEARCH.md` Package Legitimacy Audit
**Apply to:** `npm install` step

Runtime dep is `node-ical@0.27.2` (mainstream). Type safety enforced at `src/adapters/ical/` → `SourceEvent` boundary (stack pivot 2026-09-13).

---

## No Analog Found

All 28 classified files have **no in-repo analog**. This is expected — the repository is greenfield.

| Category | Count | Planner guidance |
|----------|-------|------------------|
| Tooling config | 7 | Copy verbatim from `01-RESEARCH.md` Patterns 1, 2, 5 |
| Source scaffold | 5 | Minimal stubs; no business logic |
| Test harness | 4 | Copy from `01-RESEARCH.md` Code Examples |
| Fixture data | 11 files (8 tier + 3 recurrence pairs) | Follow Patterns 3–4; synthetic data only |
| Lockfile | 1 | Generated by `npm install`; commit per D-10 |

**External precedent (not in this repo):** STACK.md notes vitest as "same runner as european-resolve" — that project is out of workspace and cannot serve as a copy source. Treat `01-RESEARCH.md` as the sole establishment reference.

---

## Metadata

**Analog search scope:** Entire repository (`/Users/serhiy/dev/github/ziohimself/er-calendar-bridge`)
**Files scanned:** 22 (planning + README + LICENSE; zero `.ts`/`.js` source)
**Pattern extraction date:** 2026-09-13
**Establishment authority:** `01-CONTEXT.md` (locked decisions) > `01-RESEARCH.md` (code examples) > `.planning/research/ARCHITECTURE.md` (module boundaries, adjusted by D-01)
