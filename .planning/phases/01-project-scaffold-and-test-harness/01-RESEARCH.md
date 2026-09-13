# Phase 1: Project scaffold and test harness - Research

**Researched:** 2026-09-13
**Domain:** TypeScript Node.js project bootstrap, vitest test harness, iCalendar fixture library
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield scaffold: no application code exists yet beyond planning artifacts. The locked decisions in `01-CONTEXT.md` define a precise deliverable — strict TypeScript ESM project with three-layer `src/` layout, vitest unit tests, eslint-only linting (no Prettier), and a fixture library of raw `.ics` files with `.expected.json` sidecars. Business logic (classify, wash, sync) is explicitly out of scope; the smoke test only proves the harness parses fixtures and surfaces UID/CATEGORIES.

The standard stack aligns with `.planning/research/STACK.md`: Node 24 LTS, TypeScript 5.x strict, vitest 5.x, `@pipobscure/ical` for parsing, and `typescript-eslint` flat config. Vitest 5 requires Node `^22.12.0 || ^24.0.0 || >=26.0.0` [CITED: vitest.dev/guide] — compatible with the locked `engines.node: "24.x"` choice. `@pipobscure/ical` is pure ESM, requires Node ≥22, and exposes `parse(src): Calendar` with typed `Event` objects including `uid`, `categories`, `rrules`, and `recurrenceId` [CITED: npmjs.com/package/@pipobscure/ical].

**Primary recommendation:** Bootstrap with `"type": "module"`, `module`/`moduleResolution: "NodeNext"`, vitest `environment: 'node'`, fixture-driven smoke tests loading one `.ics` per tier plus three recurrence-exception files, and eslint flat config using `typescript-eslint` `recommended` preset (not typed linting yet — keeps OPS-04 proportionate while `tsc --strict` enforces type safety).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Source Layout
- **D-01:** Hybrid three-layer layout aligned with ROADMAP success criteria: `src/domain/`, `src/adapters/`, `src/sync/`. Subfolders (e.g., `domain/ical/`, `domain/classify/`, `adapters/caldav/`) are created on demand in later phases — not pre-scaffolded beyond `.gitkeep` placeholders.
- **D-02:** Shared domain types live at `src/domain/types/` (e.g., `SourceEvent`, `Tier`, `PropagationDecision`). Adapters import from domain; domain never imports adapters.
- **D-03:** Include a minimal stub entry point at `src/index.ts` so `tsc` build and future `tsx` dev runner work from day one. No CLI or commander stub yet.
- **D-04:** Empty future module folders use `.gitkeep` only — no README per folder.

#### Fixture Library Design
- **D-05:** Fixtures are raw `.ics` files — realistic CalDAV payloads, easy to inspect.
- **D-06:** Organize by classification tier: `test/fixtures/public/`, `internal/`, `sensitive/`, `untagged/`, `recurrence/`.
- **D-07:** Recurrence coverage is a minimal high-risk set: one recurring series, one modified instance, one deleted instance.
- **D-08:** Each fixture has a sidecar `.expected.json` with expected tier, washed fields, and propagation decision. Tests assert against the sidecar.

#### Scaffold Tooling
- **D-09:** Target Node.js 24 LTS. Set `engines` in `package.json` accordingly.
- **D-10:** Use npm with committed `package-lock.json` for reproducible CI in Phase 01.1.
- **D-11:** Phase 1 npm scripts: `test` (vitest), `lint` (eslint), `typecheck` (tsc --noEmit), `build` (tsc -p → `dist/`).
- **D-12:** No code formatter in Phase 1 — eslint only. Prettier deferred unless Phase 01.1 CI needs it.

#### Test Harness Depth
- **D-13:** Unit-first test pyramid. Phase 1 establishes vitest unit tests against `.ics` fixtures. Integration tests added in Phase 3 (mocked CalDAV/API). No E2E until pilot.
- **D-14:** Acceptance tests enter in Phase 3 — sync loop against fixture CalDAV responses + mocked Google API. No live provider credentials (aligns with TEST-05).
- **D-15:** Shared test helpers in `test/helpers/`: `loadFixture()`, `parseIcs()` (via `@pipobscure/ical`), `assertTier()` / sidecar comparison against `.expected.json`.
- **D-16:** Smoke test loads one `.ics` fixture per tier, parses successfully, asserts UID and CATEGORIES are present. Proves harness is wired — not a trivial hello-world.

### Claude's Discretion

None — all discussed areas had explicit user choices.

### Deferred Ideas (OUT OF SCOPE)

- **Prettier / code formatter** — deferred to Phase 01.1 if CI needs enforced formatting.
- **CLI entry point (`bridge sync`)** — deferred to Phase 3 when sync loop exists.
- **Integration test directory scaffold** — deferred; unit-first now, integration tests added when CalDAV/API adapters land in Phase 3.
- **Comprehensive RRULE fixture set** — minimal high-risk set in Phase 1; expand in Phase 2 if domain tests reveal gaps.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | vitest test runner with strict TypeScript | vitest 5.x + `tsconfig` strict + `vitest.config.ts` with `environment: 'node'`; `npm test` script |
| TEST-02 | iCalendar fixture library covering all classification tiers and untagged events | `test/fixtures/{public,internal,sensitive,untagged}/` with `.ics` + `.expected.json` sidecars per D-05/D-06/D-08 |
| TEST-03 | Recurrence-exception fixtures as explicit high-risk test targets | `test/fixtures/recurrence/` with series + RECURRENCE-ID override + EXDATE/cancelled instance per D-07 and RFC 5545 patterns |
| OPS-04 | Minimum viable tooling — no disproportionate operational complexity | eslint-only (no Prettier), no pre-scaffolded submodules, no integration/E2E dirs, `recommended` eslint preset (not full typed linting) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TypeScript build & typecheck | API / Backend (tooling) | — | `tsc` compiles `src/` to `dist/`; strict mode enforced at compile time |
| Unit test execution | API / Backend (tooling) | — | vitest runs in Node; no browser/DOM needed |
| iCal fixture parsing (harness) | API / Backend (test infra) | — | `parse()` from `@pipobscure/ical` in `test/helpers/`; domain parser module comes Phase 2 |
| Fixture storage | Database / Storage (files) | — | Raw `.ics` files on disk; no DB in Phase 1 |
| Lint enforcement | API / Backend (tooling) | — | eslint flat config at repo root |
| Config key documentation | API / Backend (config) | — | `.env.example` documents future runtime keys; no secrets loader yet |
| Domain types stub | API / Backend | — | `src/domain/types/` holds shared types; no business logic yet |
| Source layout placeholders | API / Backend | — | `src/adapters/`, `src/sync/` `.gitkeep` only — wiring deferred |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 24.x LTS | Runtime | Locked D-09; Active LTS since Oct 2025, supported to Apr 2028 [CITED: github.com/nodejs/Release] |
| TypeScript | 5.9.3 | Language | STACK.md specifies 5.x strict; latest 5.x verified via `npm view typescript@5` |
| vitest | 5.0.0 | Test runner | STACK.md; native ESM, Node 24 support, faster than Jest for TS [CITED: vitest.dev/guide] |
| @pipobscure/ical | 1.0.0 | iCal parse | STACK.md; TypeScript-native RFC 5545 parser; `parse()` → typed `Calendar` [CITED: npmjs.com/package/@pipobscure/ical] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| eslint | 10.10.0 | Lint | D-11/D-12; flat config required in ESLint 9+ [CITED: typescript-eslint.io/getting-started] |
| @eslint/js | 10.0.1 | ESLint recommended rules | Paired with eslint flat config |
| typescript-eslint | 8.70.0 | TS-aware lint rules | `tseslint.configs.recommended` for Phase 1 |
| tsx | 4.23.13 | Dev runner | D-03 future `tsx src/index.ts`; install now as devDep per STACK.md |
| @types/node | 26.5.1 | Node type defs | vitest 5 peer requires `^22.0.0 \|\| >=24.0.0` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @pipobscure/ical | node-ical | node-ical has more downloads but weaker native TS; STACK.md already chose @pipobscure/ical |
| vitest | Jest | Jest ESM/TS setup more painful; STACK.md and team precedent (european-resolve) favor vitest |
| eslint recommended | strictTypeChecked | Typed linting adds config complexity; defer to Phase 01.1 if CI needs it (OPS-04) |
| TypeScript 5.9.x | TypeScript 7.0.2 | TS 7 is latest on npm but STACK.md says 5.x; stay on 5.x unless user revises stack |

**Installation (Phase 1 scope only — no CalDAV/API deps yet):**

```bash
npm install @pipobscure/ical

npm install -D typescript@5.9.3 vitest@5.0.0 tsx@4.23.13 \
  eslint@10.10.0 @eslint/js@10.0.1 typescript-eslint@8.70.0 \
  @types/node@26.5.1
```

**Version verification (2026-09-13, `npm view`):**

| Package | Verified Version |
|---------|-----------------|
| typescript@5 | 5.9.3 |
| vitest | 5.0.0 |
| @pipobscure/ical | 1.0.0 |
| eslint | 10.10.0 |
| typescript-eslint | 8.70.0 |
| tsx | 4.23.13 |
| @types/node | 26.5.1 |

## Package Legitimacy Audit

> slopcheck was unavailable at research time (install blocked). All packages below are tagged `[ASSUMED]` — planner must gate each install behind a `checkpoint:human-verify` task.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| typescript | npm | 11+ yrs | ~90M/wk | github.com/microsoft/TypeScript | unavailable | `[ASSUMED]` — verify before install |
| vitest | npm | 3+ yrs | ~25M/wk | github.com/vitest-dev/vitest | unavailable | `[ASSUMED]` — verify before install |
| @pipobscure/ical | npm | ~7 mo | ~6/wk | github.com/pipobscure/ical | unavailable | `[ASSUMED]` — **low downloads; deliberate STACK.md choice; verify repo before install** |
| eslint | npm | 12+ yrs | ~60M/wk | github.com/eslint/eslint | unavailable | `[ASSUMED]` — verify before install |
| typescript-eslint | npm | 5+ yrs | ~30M/wk | github.com/typescript-eslint/typescript-eslint | unavailable | `[ASSUMED]` — verify before install |
| tsx | npm | 2+ yrs | ~15M/wk | github.com/privatenumber/tsx | unavailable | `[ASSUMED]` — verify before install |
| @types/node | npm | 10+ yrs | ~80M/wk | github.com/DefinitelyTyped/DefinitelyTyped | unavailable | `[ASSUMED]` — verify before install |
| @eslint/js | npm | 2+ yrs | ~40M/wk | github.com/eslint/eslint | unavailable | `[ASSUMED]` — verify before install |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck not run)
**Packages flagged as suspicious [SUS]:** `@pipobscure/ical` — low weekly downloads (6/wk) but has authoritative source repo and is the locked stack choice from project research; human should confirm package author (`pipobscure`) matches expected maintainer.

**Postinstall scripts:** None detected on recommended packages (`npm view <pkg> scripts.postinstall` returned empty).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Phase 1: Test Harness                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  npm test ──► vitest ──► smoke.test.ts                          │
│                              │                                   │
│                              ▼                                   │
│                    test/helpers/loadFixture()                    │
│                              │                                   │
│                              ▼                                   │
│                    test/helpers/parseIcs()                       │
│                              │                                   │
│                              ▼                                   │
│                    @pipobscure/ical parse()                      │
│                              │                                   │
│                              ▼                                   │
│              assert UID + CATEGORIES present                     │
│              (sidecar .expected.json loaded but                  │
│               full comparison deferred to Phase 2)               │
│                                                                  │
│  test/fixtures/                                                  │
│    ├── public/*.ics + *.expected.json                           │
│    ├── internal/*.ics + *.expected.json                        │
│    ├── sensitive/*.ics + *.expected.json                      │
│    ├── untagged/*.ics + *.expected.json                         │
│    └── recurrence/                                              │
│         ├── weekly-series.ics        (RRULE master)             │
│         ├── modified-instance.ics    (RECURRENCE-ID override)   │
│         └── deleted-instance.ics     (EXDATE or STATUS:CANCELLED)│
│                                                                  │
│  src/ (scaffold only — no business logic)                       │
│    ├── index.ts          (stub export / console.log)            │
│    ├── domain/types/     (type stubs: Tier, SourceEvent, etc.)  │
│    ├── adapters/.gitkeep                                        │
│    └── sync/.gitkeep                                            │
│                                                                  │
│  Tooling scripts:                                                │
│    npm run typecheck ──► tsc --noEmit                           │
│    npm run lint      ──► eslint .                               │
│    npm run build     ──► tsc -p tsconfig.json → dist/           │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
er-calendar-bridge/
├── package.json              # type: module, engines.node: 24.x, scripts
├── package-lock.json         # committed per D-10
├── tsconfig.json             # strict, NodeNext, rootDir: src
├── vitest.config.ts          # environment: node, include test/**/*.test.ts
├── eslint.config.mjs         # flat config, typescript-eslint recommended
├── .env.example              # documented keys, no secrets
├── .gitignore                # node_modules, dist, .env, .vitest/
├── src/
│   ├── index.ts              # minimal stub entry (D-03)
│   ├── domain/
│   │   ├── types/
│   │   │   └── index.ts      # Tier, SourceEvent, PropagationDecision stubs
│   │   └── .gitkeep
│   ├── adapters/
│   │   └── .gitkeep
│   └── sync/
│       └── .gitkeep
└── test/
    ├── helpers/
    │   ├── load-fixture.ts
    │   ├── parse-ics.ts
    │   └── assert-sidecar.ts # scaffold; full assertTier in Phase 2
    ├── fixtures/
    │   ├── public/
    │   ├── internal/
    │   ├── sensitive/
    │   ├── untagged/
    │   └── recurrence/
    └── smoke.test.ts         # D-16 smoke test
```

### Pattern 1: ESM + NodeNext TypeScript

**What:** Pure ESM project aligned with `@pipobscure/ical` and Node 24 native module resolution.
**When to use:** Always — locked by stack and library requirements.

```json
// package.json
{
  "type": "module",
  "engines": { "node": "24.x" }
}
```

```json
// tsconfig.json
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

Source: [CITED: npmjs.com/package/@pipobscure/ical] (pure ESM, Node ≥22); [ASSUMED] NodeNext is standard for Node ESM TypeScript projects.

### Pattern 2: Vitest Node Test Config

**What:** Dedicated vitest config with Node environment (no jsdom).
**When to use:** All Phase 1 tests — pure parsing, no DOM.

```typescript
// vitest.config.ts
// Source: [CITED: vitest.dev/guide]
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
  },
});
```

Use `"test": "vitest run"` in `package.json` so `npm test` exits cleanly (CI-ready for Phase 01.1). Optional `"test:watch": "vitest"` for local dev.

### Pattern 3: Fixture + Sidecar Convention

**What:** Each `.ics` file paired with `.expected.json` sidecar in the same directory.
**When to use:** All tier fixtures (D-08); recurrence fixtures get sidecars too even if Phase 1 smoke test only checks parseability.

```json
// test/fixtures/public/board-meeting.expected.json
{
  "uid": "board-meeting-2026@er.example",
  "categories": ["ER-PUBLIC"],
  "tier": "public",
  "propagation": "full",
  "washed": null
}
```

Phase 1 smoke test: parse `.ics`, assert `event.uid` matches sidecar `uid`, assert categories present. Full `assertTier()` / washed-field comparison is scaffolded in helpers but exercised in Phase 2.

### Pattern 4: Recurrence Exception Fixtures (RFC 5545)

**What:** Three minimal files covering highest-risk recurrence cases per D-07 and PITFALLS.md #1.
**When to use:** `test/fixtures/recurrence/` only.

| File | RFC 5545 mechanism | What it tests |
|------|-------------------|---------------|
| `weekly-series.ics` | `RRULE:FREQ=WEEKLY` on master VEVENT | Series parses; `event.rrules` populated |
| `modified-instance.ics` | Second VEVENT with same `UID` + `RECURRENCE-ID` | Override instance; `event.recurrenceId` set [CITED: icalendar.org RECURRENCE-ID] |
| `deleted-instance.ics` | `EXDATE` on master OR `STATUS:CANCELLED` on exception | Deleted occurrence excluded [CITED: icalendar.org EXDATE] |

**Modified instance example (multi-VEVENT file):**

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ER Calendar Bridge//Fixtures//EN
BEGIN:VEVENT
UID:standup@er.example
DTSTAMP:20260901T080000Z
DTSTART;TZID=Europe/Brussels:20260901T090000
DTEND;TZID=Europe/Brussels:20260901T093000
RRULE:FREQ=WEEKLY;COUNT=4
SUMMARY:Daily standup
CATEGORIES:ER-INTERNAL
END:VEVENT
BEGIN:VEVENT
UID:standup@er.example
DTSTAMP:20260908T080000Z
DTSTART;TZID=Europe/Brussels:20260915T140000
DTEND;TZID=Europe/Brussels:20260915T143000
RECURRENCE-ID;TZID=Europe/Brussels:20260915T090000
SUMMARY:Standup (moved)
CATEGORIES:ER-INTERNAL
END:VEVENT
END:VCALENDAR
```

### Pattern 5: ESLint Flat Config (Minimum Viable)

**What:** `eslint.config.mjs` with `typescript-eslint` `recommended` preset — no typed linting yet.
**When to use:** Phase 1 per OPS-04; upgrade to `recommendedTypeChecked` in Phase 01.1 if desired.

```javascript
// eslint.config.mjs
// Source: [CITED: typescript-eslint.io/getting-started]
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

### Anti-Patterns to Avoid

- **Pre-scaffolding `domain/ical/`, `adapters/caldav/` subfolders:** D-01 says create on demand; only `.gitkeep` at layer roots.
- **Hello-world-only smoke test:** D-16 requires fixture parsing with UID/CATEGORIES assertions.
- **Installing CalDAV/API deps in Phase 1:** tsdav, googleapis, better-sqlite3 etc. belong in later phases; keeps `package-lock.json` lean.
- **CommonJS `require()`:** Conflicts with `@pipobscure/ical` pure ESM requirement.
- **Hand-rolled iCal parser in test helpers:** Use `parse()` from `@pipobscure/ical` per D-15.
- **Real PII in fixtures:** Use synthetic UIDs, names, and emails (`@er.example`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iCal parsing | Custom VEVENT/CATEGORIES parser | `@pipobscure/ical` `parse()` | RFC 5545 edge cases (folding, TZID, EXDATE, RECURRENCE-ID) are subtle [CITED: PITFALLS.md #1, #9] |
| Test runner | Custom assert framework | vitest | ESM-native, fast, team precedent |
| Type checking | eslint-only without tsc | `tsc --noEmit` script | Strict types enforced at compile time per PROJECT.md |
| RRULE expansion in Phase 1 | Full recurrence engine | Fixture files only; `@martinhipp/rrule` deferred to Phase 2/3 | D-07 specifies minimal fixture set, not expansion logic |
| Config validation | Custom env parser | `.env.example` documentation only; zod in later phase | No runtime config loading in Phase 1 |

**Key insight:** Phase 1 establishes the test harness boundary — parsing and fixture structure — so Phase 2 domain logic can be pure functions tested against known inputs without network or provider mocks.

## Common Pitfalls

### Pitfall 1: ESM Import Extension Mismatch

**What goes wrong:** `Cannot find module './foo'` when running vitest or `node dist/index.js` with TypeScript imports lacking `.js` extensions.
**Why it happens:** `module: NodeNext` requires `.js` extensions in import paths (TypeScript emits `.js` even from `.ts` sources).
**How to avoid:** Use `.js` extensions in relative imports within `src/` (e.g., `import { Tier } from './types/index.js'`). Vitest resolves `.ts` files correctly with NodeNext.
**Warning signs:** MODULE_NOT_FOUND errors only at runtime, not during `tsc`.

### Pitfall 2: tsconfig Excludes Test Files from Typecheck

**What goes wrong:** `npm run typecheck` passes but test files have type errors; or test files can't resolve `src/` types.
**Why it happens:** `rootDir: src` in main tsconfig excludes `test/`.
**How to avoid:** Either add a `tsconfig.test.json` that extends base and includes `test/`, or use vitest's built-in typecheck (`vitest --typecheck`) as supplement. Minimum viable: separate `tsconfig.json` (src only) + ensure test imports use paths that resolve.
**Warning signs:** IDE shows errors in `test/` but CI typecheck is green.

### Pitfall 3: @pipobscure/ical Categories Type Shape

**What goes wrong:** Smoke test asserts `CATEGORIES` as string but parser returns `ICalValue[]`.
**Why it happens:** `@pipobscure/ical` uses structured value types, not plain strings.
**How to avoid:** Helper normalizes categories: `event.categories.map(c => typeof c === 'string' ? c : String(c))` or check `event.getValues('CATEGORIES')`. Read actual parsed shape in first smoke test before locking assertions.
**Warning signs:** `expect(categories).toContain('ER-PUBLIC')` fails despite fixture having the tag.

### Pitfall 4: Recurrence Fixture TZID Mismatch

**What goes wrong:** RECURRENCE-ID doesn't match series DTSTART timezone form; parser treats override as orphan.
**Why it happens:** RFC 5545 requires RECURRENCE-ID value type matches master DTSTART [CITED: icalendar.org RECURRENCE-ID].
**How to avoid:** Use consistent `TZID=Europe/Brussels` (or UTC `Z`) across master, EXDATE, and RECURRENCE-ID in all recurrence fixtures.
**Warning signs:** Modified-instance fixture parses as separate unrelated event.

### Pitfall 5: Node Version Mismatch (Dev vs engines)

**What goes wrong:** Developer on Node 22 runs tests fine locally but CI/production targets Node 24; or vice versa.
**Why it happens:** Research machine has Node 22.19.0; locked engines is 24.x.
**How to avoid:** Document Node 24 requirement in README; use `engines.node: "24.x"` with optional `engine-strict` in `.npmrc` for Phase 01.1 CI.
**Warning signs:** `engines` warning on `npm install`; vitest 5 may warn on Node <22.12.

### Pitfall 6: Secrets in Fixtures or .env.example

**What goes wrong:** Real mailbox.org app password committed in fixture or example file.
**Why it happens:** Copy-paste from real CalDAV export.
**How to avoid:** Synthetic values only; `.env.example` uses placeholder format (`MAILBOX_APP_PASSWORD=your-app-password-here`).
**Warning signs:** Strings matching app-password format in git diff.

## Code Examples

### loadFixture() Helper

```typescript
// test/helpers/load-fixture.ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

### parseIcs() Helper

```typescript
// test/helpers/parse-ics.ts
// Source: [CITED: npmjs.com/package/@pipobscure/ical]
import { parse, type Event } from '@pipobscure/ical';

export function parseIcs(ics: string): Event {
  const cal = parse(ics);
  const event = cal.events[0];
  if (!event) {
    throw new Error('No VEVENT found in fixture');
  }
  return event;
}

export function getCategories(event: Event): string[] {
  return event.categories
    .map((c) => (typeof c === 'string' ? c : String(c)))
    .filter(Boolean);
}
```

### Smoke Test (D-16)

```typescript
// test/smoke.test.ts
import { describe, it, expect } from 'vitest';
import { loadFixture } from './helpers/load-fixture.js';
import { parseIcs, getCategories } from './helpers/parse-ics.js';

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

### Minimal src/index.ts Stub (D-03)

```typescript
// src/index.ts
export const VERSION = '0.0.0';

export function main(): void {
  console.log(`er-calendar-bridge v${VERSION} — scaffold only`);
}

// Allow `tsx src/index.ts` without CLI framework
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

### .env.example Keys

```bash
# mailbox.org CalDAV (read-only app password)
MAILBOX_CALDAV_URL=https://dav.mailbox.org
MAILBOX_USERNAME=operator@example.org
MAILBOX_APP_PASSWORD=your-app-password-here

# Google Calendar API (OAuth — calendar scope only)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=

# Microsoft Graph (calendar scope only)
MICROSOFT_TENANT_ID=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# SMTP (withhold notifications — Phase 4)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@example.org

# Runtime
LOG_LEVEL=info
SYNC_INTERVAL_MINUTES=5
```

Key names are `[ASSUMED]` — planner should cross-check against `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md` when that doc becomes available in workspace. Phase 1 only requires the file exist with placeholders, no loader.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.eslintrc.*` config | ESLint flat config (`eslint.config.mjs`) | ESLint 9+ (2024) | Must use `defineConfig` + `typescript-eslint` helper [CITED: typescript-eslint.io/getting-started] |
| `parserOptions.project` | `parserOptions.projectService` | typescript-eslint 8.0 (2024) | Faster typed linting; defer to Phase 01.1 |
| Jest + ts-jest | vitest 5 + native ESM | vitest 5 (2025-2026) | Node 20 dropped; requires Node 22.12+ [CITED: vitest.dev/guide] |
| CommonJS default | ESM `"type": "module"` | Node ecosystem norm | Required by @pipobscure/ical |
| node-ical | @pipobscure/ical | STACK.md 2026-09-11 | TypeScript-native; project-locked choice |

**Deprecated/outdated:**
- **ESLint legacy `.eslintrc`:** Removed in ESLint 9; use flat config.
- **Node 20 for vitest 5:** Below minimum engine; use Node 24 per D-09.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.env.example` key names (MAILBOX_*, GOOGLE_*, etc.) | Code Examples | Phase 3 config loader needs rename |
| A2 | `module: NodeNext` is correct tsconfig for this project | Pattern 1 | Import path issues if bundler resolution preferred |
| A3 | Phase 1 eslint uses `recommended` not `strictTypeChecked` | Pattern 5 | May need tightening in Phase 01.1 |
| A4 | `@pipobscure/ical` `event.categories` normalization approach | Pitfall 3 | Smoke test assertions may need adjustment after first parse |
| A5 | All package versions marked `[ASSUMED]` due to slopcheck unavailability | Package Legitimacy Audit | Planner must human-verify each install |
| A6 | TypeScript 5.9.3 over 7.0.2 | Standard Stack | STACK.md says 5.x; TS 7 may be viable but unverified for this project |

## Open Questions (RESOLVED)

1. **Exact `.env.example` key names** — **RESOLVED**
   - What we knew: ROADMAP success criterion #5 requires documented keys; architecture mentions CalDAV, Google, Graph, SMTP.
   - Resolution: Phase 1 uses the descriptive placeholder keys documented in the `.env.example` Code Examples section (`MAILBOX_*`, `GOOGLE_*`, `MICROSOFT_*`, `SMTP_*`, `LOG_LEVEL`, `SYNC_INTERVAL_MINUTES`). Canonical names from the external IT strategy repo will be reconciled when Phase 3 secrets/config loader is planned.
   - Planner action: Plan 01-01 Task 3 creates `.env.example` with these exact keys — no loader, placeholders only.

2. **Untagged fixture: absent vs empty CATEGORIES** — **RESOLVED**
   - What we knew: SYNC-03 defaults untagged to Internal; fixture must have no `ER-*` category.
   - Resolution: `test/fixtures/untagged/unclassified.ics` **omits the `CATEGORIES` property entirely** (not an empty `CATEGORIES:` line). This is the safer fail-closed test case for Phase 2 classification.
   - Planner action: Plan 01-02 Task 2 creates untagged fixture without any CATEGORIES line; smoke test in plan 01-04 asserts `getCategories(event)` returns empty array.

3. **Node 24 on developer machine** — **RESOLVED**
   - What we knew: Research environment has Node 22.19.0; `engines.node` targets `24.x`.
   - Resolution: `package.json` enforces `engines.node: "24.x"`. README documents Node 24 LTS install requirement. Phase 01.1 CI workflow enforces Node 24 via `actions/setup-node`. Local dev on Node 22.12+ is tolerated for vitest 5 compatibility but pilot deployment requires Node 24.
   - Planner action: Plan 01-01 Task 2 sets engines; Phase 01.1 adds CI Node version pin.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 24.x | D-09 engines, vitest 5 | ✗ (22.19.0 found) | 22.19.0 | Node 22.12+ runs vitest 5; install Node 24 for production parity |
| npm | D-10 package management | ✓ | 10.9.3 | — |
| TypeScript (global tsc) | — | ✗ | — | Project-local `typescript` devDep (not needed globally) |
| ctx7 CLI | Documentation lookup | ✗ | — | Used WebFetch + npm view instead |
| slopcheck | Package legitimacy | ✗ | — | All packages marked `[ASSUMED]` |

**Missing dependencies with no fallback:**
- None blocking — `npm install` bootstraps all project deps.

**Missing dependencies with fallback:**
- Node 24 — Node 22.19.0 on research machine can execute vitest 5 (meets `^22.12.0`); install Node 24 before pilot deployment.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 5.0.0 |
| Config file | `vitest.config.ts` (Wave 0 — create) |
| Quick run command | `npm test` → `vitest run` |
| Full suite command | `npm test` (single smoke suite in Phase 1) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | vitest runs with strict TS | smoke | `npm test` | ❌ Wave 0 |
| TEST-01 | typecheck passes | unit/tooling | `npm run typecheck` | ❌ Wave 0 |
| TEST-02 | All tier fixtures present and parseable | smoke | `npm test` | ❌ Wave 0 |
| TEST-03 | Recurrence fixtures parse without error | smoke | `npm test` | ❌ Wave 0 |
| OPS-04 | lint passes | tooling | `npm run lint` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test && npm run typecheck`
- **Per wave merge:** `npm test && npm run typecheck && npm run lint && npm run build`
- **Phase gate:** All four scripts green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `package.json` — scripts, engines, type: module
- [ ] `tsconfig.json` — strict, NodeNext
- [ ] `vitest.config.ts` — node environment
- [ ] `eslint.config.mjs` — flat config
- [ ] `src/index.ts` — stub entry
- [ ] `src/domain/types/index.ts` — Tier, SourceEvent, PropagationDecision stubs
- [ ] `test/helpers/load-fixture.ts`, `parse-ics.ts`, `assert-sidecar.ts`
- [ ] `test/smoke.test.ts` — D-16 smoke test
- [ ] `test/fixtures/{public,internal,sensitive,untagged,recurrence}/*.ics` + sidecars
- [ ] `.env.example` — config key documentation
- [ ] `.gitignore` — node_modules, dist, .env, .vitest/

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in Phase 1 |
| V3 Session Management | no | No sessions in Phase 1 |
| V4 Access Control | no | No runtime access control yet |
| V5 Input Validation | partial | Fixture parsing only; zod config validation deferred to Phase 3 |
| V6 Cryptography | no | No crypto operations in Phase 1 |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secrets committed to git | Information Disclosure | `.gitignore` `.env`; `.env.example` placeholders only; no real credentials in fixtures |
| PII in test fixtures | Information Disclosure | Synthetic data only (`@er.example` domains, fake names) |
| Supply-chain package risk | Tampering | Package legitimacy audit; human-verify `@pipobscure/ical` low-download package |
| Misconfigured strict mode bypass | Elevation | `strict: true` in tsconfig; `tsc --noEmit` in CI (Phase 01.1) |

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` present in repository. Applicable constraints sourced from `.planning/PROJECT.md`:

- TypeScript only, strict mode
- Fail-closed security posture (fixtures should reflect this)
- Minimum viable tooling (OPS-04)
- No Python
- Read-only source access (document in `.env.example` comments, not enforced until Phase 3)

## Sources

### Primary (HIGH confidence)

- [npmjs.com/package/@pipobscure/ical](https://www.npmjs.com/package/@pipobscure/ical) — API (`parse`, `Event.categories`, `recurrenceId`, `rrules`), ESM/Node requirements
- [vitest.dev/guide](https://vitest.dev/guide/) — installation, Node engine requirements, config
- [typescript-eslint.io/getting-started](https://typescript-eslint.io/getting-started/) — flat config setup
- [github.com/nodejs/Release](https://github.com/nodejs/Release/blob/main/README.md) — Node 24 LTS schedule
- `.planning/phases/01-project-scaffold-and-test-harness/01-CONTEXT.md` — locked decisions D-01 through D-16
- `.planning/research/STACK.md` — dependency choices and versions
- `.planning/research/PITFALLS.md` — recurrence and datetime pitfalls

### Secondary (MEDIUM confidence)

- [icalendar.org RECURRENCE-ID](https://icalendar.org/iCalendar-RFC-5545/3-8-4-4-recurrence-id.html) — recurrence override semantics
- [icalendar.org EXDATE](https://icalendar.org/iCalendar-RFC-5545/3-8-5-1-exception-date-times.html) — exception date semantics
- `npm view` commands (2026-09-13) — verified package versions

### Tertiary (LOW confidence)

- WebSearch results on vitest 5 + TypeScript ESM setup patterns — cross-checked against vitest.dev
- `.env.example` key naming — not verified against external IT strategy doc

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked in CONTEXT.md and STACK.md, versions verified via npm
- Architecture: HIGH — greenfield with explicit layout decisions; no legacy code conflicts
- Pitfalls: MEDIUM — recurrence fixture patterns verified against RFC 5545 refs; `@pipobscure/ical` category shape needs first-parse validation

**Research date:** 2026-09-13
**Valid until:** 2026-10-13 (30 days — stable toolchain domain)
