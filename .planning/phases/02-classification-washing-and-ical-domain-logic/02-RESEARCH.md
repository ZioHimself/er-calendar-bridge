# Phase 2: Classification, washing, and iCal domain logic - Research

**Researched:** 2026-09-14
**Domain:** Pure TypeScript domain pipeline — iCalendar `CATEGORIES` classification, fail-closed propagation decisions, outbound event washing
**Confidence:** HIGH

## Summary

Phase 2 implements the security-critical core of the bridge: map parsed `SourceEvent` values to `{ tier, propagation }` using ER tier tags and fail-closed defaults, then produce `OutboundEvent | null` for Google/Graph writers in Phase 3. All logic stays in `src/domain/` with **no** `node-ical`, CalDAV, SQLite, or network I/O. Phase 1 already provides `SourceEvent`, seven `.ics` fixtures with `.expected.json` sidecars (tier/propagation set; `washed: null` pending this phase), and `parseIcs()` wired through `src/adapters/ical/parse-source-event.ts`.

Locked context (02-CONTEXT.md) defines **strictest-wins** among ER tags, **restrict-only full disclosure** (public-only path), busy-blocks with fixed `"Busy"` summary and a field whitelist, sensitive **drop** (`outbound: null`), and public **passthrough** (washer no-op). Tests must become unit-heavy: classify/wash in isolation plus parse → `processSourceEvent` → sidecar assertions including populated `washed` objects for busy-tier fixtures and full recurrence pipeline checks (not UID-only smoke).

**Primary recommendation:** Add `src/domain/classify/`, `src/domain/wash/`, and a top-level `processSourceEvent` orchestrator; extend `domain/types/` with `OutboundEvent` and a processed result type; implement classification as a single pure function with explicit ER token normalization; implement washing as decision-driven whitelist construction (busy), passthrough (full), or null (drop); extend `assert-sidecar` / add `assertProcessed` with ISO date normalization for JSON sidecars; populate `washed` in busy-tier sidecars using adapter-parsed UTC instants (verified below).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Classification (multi-value `CATEGORIES`, fail-closed)
- **D-01:** **Strictest-wins precedence** among ER tier tags on one event: `ER-SENSITIVE` ⇒ `drop`; mixed non-sensitive tiers (e.g. `ER-PUBLIC` + `ER-INTERNAL`) ⇒ `busy` (never full).
- **D-02:** Only a qualifying **public-only** classification yields `full` propagation (restrict-only): full content requires `ER-PUBLIC` without a stricter competing tier per D-01.
- **D-03:** **Unknown / non-ER** category values follow it-strategy default (equivalent to internal): contribute to **busy-block**, not full disclosure.
- **D-04:** Match ER tier tokens **case-insensitively**; parse multi-value `CATEGORIES` correctly (comma-separated values).

#### Washing & outbound shape
- **D-05:** **Busy-block** summary is the fixed English string `"Busy"`.
- **D-06:** Busy-block **whitelist**: `uid`, `start`, `end` (when present), `summary`, plus **sync metadata** (`recurrenceId` and related fields needed for exception upserts in Phase 3). No location, description, attendees, organiser, attachments, or `CATEGORIES` on busy output.
- **D-07:** Stripped fields are **omitted** from `OutboundEvent` (not present as null/empty keys).
- **D-08:** **`drop`** propagation returns `outbound: null` with `propagation: 'drop'`.
- **D-09:** **Public tier**: washer is a **no-op** — outbound carries **all** properties currently on `SourceEvent` (full passthrough). Public fixture sidecars keep `washed: null`.

#### Types & module API
- **D-10:** Submodules **`domain/classify/`** and **`domain/wash/`** with a top-level orchestrator (e.g. `processSourceEvent`) that runs classify then wash. Export split functions for focused unit tests.
- **D-11:** **`OutboundEvent`** lives in **`domain/types/`** alongside `SourceEvent`, `Tier`, and `PropagationDecision`.
- **D-12:** **Restrict-only** enforcement lives in the **classifier only**; washer trusts `PropagationDecision` (no second full-content guard).

#### Attendees & parser scope
- **D-13:** **Defer** attendee/organiser parsing extensions to **Phase 3**; Phase 2 public passthrough covers whatever `SourceEvent` already contains.

#### Tests & fixtures (TEST-04)
- **D-14:** **Test pyramid for this phase**: many fast **unit** tests on classify/wash; smoke tests remain thin; **no network**. Depth = parse → classify → wash → assert against sidecar for each tier fixture.
- **D-15:** Busy-tier (and applicable recurrence) `.expected.json` files populate **`washed` as a full expected `OutboundEvent`** object; recurrence fixtures run the **full pipeline**, not UID-only smoke checks.
- **D-16:** Extend test helpers (`assertTier` / `assertProcessed`) to compare washed output; assertion strategy (deep-equal vs field-by-field) is implementer discretion.

### Claude's Discretion

- **Multi-tag edge-case fixtures**: add minimal `.ics` + sidecar and/or synthesized `SourceEvent` unit tests to lock strictest-wins rules — planner chooses smallest sufficient set.
- **Module file layout** within `domain/classify/` and `domain/wash/` (file names, barrel exports).
- **Washed output assertion helper** implementation details (normalization of dates, forbidden-key scans).

### Deferred Ideas (OUT OF SCOPE)

- **Attendee/organiser on `SourceEvent`** — Phase 3 parser/adapter enrichment; public passthrough will include them once parsed.
- **Withhold notifications / audit** — Phase 4 (not this phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-02 | Per-event classification via `CATEGORIES` (`ER-PUBLIC`, `ER-INTERNAL`, `ER-SENSITIVE`) | `classifySourceEvent()` with case-insensitive ER token set; multi-value categories already parsed to `string[]` at adapter boundary |
| SYNC-03 | Default untagged events to Internal (busy-block), never full disclosure | Empty `categories` ⇒ `tier: 'untagged'`, `propagation: 'busy'` (matches `untagged/unclassified` sidecar) |
| SYNC-04 | Content washing — strip title, description, location, attendees, organiser, attachments, tags for non-public events | Busy whitelist + fixed `"Busy"` summary; omit stripped keys (D-07); drop removes outbound entirely |
| SYNC-08 | Restrict-only — only `ER-PUBLIC` enables full disclosure | Classifier-only gate (D-12): `full` only when public-only ER classification; washer has no promote-to-full path |
| SYNC-09 | Bridge MUST NOT modify/write classification tags on mailbox.org | Pure read-only domain functions; busy output must not include `categories`; no write adapters in this phase |
| SYNC-10 | Attendee/organiser PII not propagated except for `ER-PUBLIC` | Busy/drop paths strip fields not on whitelist; `SourceEvent` has no attendee fields yet (D-13) — whitelist prevents future leak |
| TEST-04 | Domain logic (classify, wash) covered by pure unit tests — no network | vitest unit files under `test/domain/` + fixture pipeline tests; extend `assertProcessed` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse `CATEGORIES` from iCal | API / Backend (adapter) | — | `src/adapters/ical/parse-source-event.ts` owns `node-ical`; domain receives `SourceEvent.categories` |
| Classify tier & propagation | API / Backend (domain) | — | Pure functions in `src/domain/classify/`; fail-closed policy |
| Wash outbound shape | API / Backend (domain) | — | Pure functions in `src/domain/wash/`; whitelist busy-blocks |
| Orchestrate classify → wash | API / Backend (domain) | — | `processSourceEvent()` for Phase 3 sync loop |
| Fixture expectations | Database / Storage (files) | — | `.expected.json` sidecars; `washed` populated in Phase 2 |
| Unit test execution | API / Backend (tooling) | — | vitest in Node; imports `src/` + `test/helpers/` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Language | Already locked; strict mode + `noUncheckedIndexedAccess` |
| vitest | 5.0.0 | Unit tests | Phase 1 harness; fast pure-function tests |
| node-ical | 0.27.2 | Parse fixtures only | **Adapter boundary only** — domain never imports it |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | 4.23.13 | Run snippets | Dev-only; optional for generating sidecar instants |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled CATEGORIES parse in domain | Trust adapter `string[]` | Domain must not re-parse iCal; classification normalizes tokens only |
| zod for `SourceEvent` | TypeScript interfaces only | OPS-04 proportionate; optional later at adapter boundary |

**Installation:** None — Phase 2 adds **no new npm dependencies**.

**Version verification (2026-09-14, `npm view` on existing deps):** typescript 5.9.3, vitest 5.0.0, node-ical 0.27.2 [VERIFIED: npm registry]

## Package Legitimacy Audit

> Phase 2 installs no external packages. Legitimacy gate not applicable.

| Package | Disposition |
|---------|-------------|
| *(none)* | No installs this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
  test/fixtures/*.ics
         │
         ▼
  adapters/ical/parse-source-event.ts  (node-ical → SourceEvent)
         │
         ▼
  domain/process-source-event.ts
         │
    ┌────┴────┐
    ▼         ▼
 classify/   wash/
    │         │
    │   PropagationDecision
    │   ('full' | 'busy' | 'drop')
    └────┬────┘
         ▼
  ProcessedSourceEvent { tier, propagation, outbound }
         │
         ▼
  test/helpers/assertProcessed → .expected.json sidecar
```

### Recommended Project Structure

```
src/domain/
├── types/index.ts           # SourceEvent, OutboundEvent, Tier, PropagationDecision, ProcessedSourceEvent
├── classify/
│   ├── index.ts
│   └── classify-source-event.ts
├── wash/
│   ├── index.ts
│   └── wash-source-event.ts
└── process-source-event.ts  # orchestrator

test/
├── domain/
│   ├── classify.test.ts
│   ├── wash.test.ts
│   └── pipeline-fixtures.test.ts
└── helpers/
    └── assert-sidecar.ts    # assertProcessed + forbidden-key scan for busy
```

### Pattern 1: Restrict-only classifier (single gate)

**What:** One function maps `SourceEvent.categories` → `{ tier, propagation }`. Washer never upgrades disclosure.

**When to use:** All classification; satisfies SYNC-08 and PITFALLS #2.

**Decision table (implement exactly):**

| Condition (after trim + case-normalize ER tokens) | `tier` | `propagation` |
|---------------------------------------------------|--------|---------------|
| Contains `ER-SENSITIVE` | `sensitive` | `drop` |
| `categories` empty | `untagged` | `busy` |
| Contains `ER-PUBLIC`, no `ER-INTERNAL`, no `ER-SENSITIVE`, **and no non-ER category tokens** | `public` | `full` |
| All other cases (incl. `ER-INTERNAL` only, mixed ER tags, unknown-only, `ER-PUBLIC` + unknown) | `internal`* | `busy` |

\*Reported `tier` for busy paths: use `internal` when any `ER-INTERNAL`, mixed ER tags, or unknown/non-ER tokens present; use `untagged` only for the empty-category case. Mixed `ER-PUBLIC` + `ER-INTERNAL` ⇒ `internal` + `busy` (D-01).

**Example:**

```typescript
// Source: 02-CONTEXT.md D-01–D-04, PROJECT.md restrict-only
const ER = {
  PUBLIC: 'er-public',
  INTERNAL: 'er-internal',
  SENSITIVE: 'er-sensitive',
} as const;

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase();
}

function isErToken(norm: string): boolean {
  return norm === ER.PUBLIC || norm === ER.INTERNAL || norm === ER.SENSITIVE;
}

export function classifySourceEvent(event: SourceEvent): Classification {
  const tokens = event.categories.map((c) => c.trim()).filter(Boolean);
  const norm = tokens.map(normalizeToken);

  if (norm.includes(ER.SENSITIVE)) {
    return { tier: 'sensitive', propagation: 'drop' };
  }
  if (tokens.length === 0) {
    return { tier: 'untagged', propagation: 'busy' };
  }

  const hasPublic = norm.includes(ER.PUBLIC);
  const hasInternal = norm.includes(ER.INTERNAL);
  const hasNonEr = tokens.some((_, i) => !isErToken(norm[i]!));

  if (hasPublic && !hasInternal && !hasNonEr) {
    return { tier: 'public', propagation: 'full' };
  }
  return { tier: 'internal', propagation: 'busy' };
}
```

### Pattern 2: Decision-driven washer

**What:** `washSourceEvent(source, propagation)` — no re-classification.

**When to use:** After classify; satisfies SYNC-04 and PITFALLS #5.

**Example:**

```typescript
// Source: 02-CONTEXT.md D-05–D-09
const BUSY_SUMMARY = 'Busy';

export function washSourceEvent(
  source: SourceEvent,
  propagation: PropagationDecision,
): OutboundEvent | null {
  if (propagation === 'drop') return null;
  if (propagation === 'full') {
    return { ...source }; // passthrough all current SourceEvent fields
  }

  const outbound: OutboundEvent = {
    uid: source.uid,
    start: source.start,
    summary: BUSY_SUMMARY,
  };
  if (source.end !== undefined) outbound.end = source.end;
  if (source.recurrenceId !== undefined) outbound.recurrenceId = source.recurrenceId;
  if (source.isRecurring) outbound.isRecurring = true;
  return outbound;
}
```

### Pattern 3: Orchestrator

```typescript
export function processSourceEvent(source: SourceEvent): ProcessedSourceEvent {
  const { tier, propagation } = classifySourceEvent(source);
  const outbound = washSourceEvent(source, propagation);
  return { tier, propagation, outbound };
}
```

### Pattern 4: Sidecar `washed` population (busy tiers)

Use adapter-parsed UTC ISO strings in JSON (tests normalize to `Date`). Verified instants for fixture sidecars:

| Fixture | Expected `washed` (busy) |
|---------|---------------------------|
| `internal/team-sync` | `uid`, `start`/`end` ISO, `summary: "Busy"` — no `categories`, `description`, `location` |
| `untagged/unclassified` | same shape |
| `recurrence/weekly-series` | include `isRecurring: true` |
| `recurrence/deleted-instance` | include `isRecurring: true` |
| `recurrence/modified-instance` | include `recurrenceId` ISO + `summary: "Busy"` |

Example fragment for `internal/team-sync.expected.json` [VERIFIED: local parse via `parseIcsToSourceEvent`]:

```json
"washed": {
  "uid": "team-sync-2026@er.example",
  "start": "2026-09-16T08:00:00.000Z",
  "end": "2026-09-16T08:30:00.000Z",
  "summary": "Busy"
}
```

Public / sensitive sidecars keep `"washed": null`; tests assert `outbound` passthrough or `null` directly.

### Anti-Patterns to Avoid

- **Passthrough on busy/drop:** Any `{ ...source, summary: 'Busy' }` leaves PII fields — violates D-06/D-07 and PITFALLS #5.
- **Second “safety” full check in washer:** Duplicates policy and risks divergence (D-12).
- **Importing `node-ical` in domain/tests:** Breaks adapter boundary (Phase 1 D-15).
- **Promoting to full without public-only ER set:** e.g. treating unknown categories as neutral — violates D-03.
- **UID-only recurrence tests:** Phase 2 requires full pipeline on recurrence fixtures (D-15).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iCal `CATEGORIES` comma-splitting | Custom RFC 5545 parser in domain | Adapter + `node-ical` `categoriesParameter` | Escaped commas, folding handled in parser [CITED: github.com/jens-maus/node-ical `ical-parser-utils.js`] |
| Deep equality with `Date` in JSON sidecars | Ad-hoc compares | Helper that maps ISO strings ↔ `Date` before compare | Sidecars are JSON; vitest `toEqual` fails on type mismatch |
| Policy engine / rules DSL | YAML-driven classifier | Explicit decision table in TS | 3 tiers + strictest-wins fits in one function; easier to audit for security |

**Key insight:** Security policy belongs in one auditable classifier function; washing is mechanical field projection.

## Common Pitfalls

### Pitfall 1: Full-content leak on untagged or mixed tags

**What goes wrong:** Titles/descriptions appear externally without public-only tagging.  
**Why it happens:** Treating “has ER-PUBLIC” as sufficient without checking competing tags or unknown categories.  
**How to avoid:** Implement decision table above; unit tests for `ER-PUBLIC+ER-INTERNAL`, `ER-PUBLIC+WORK`, empty categories.  
**Warning signs:** `propagation === 'full'` when `categories.length !== 1` or non-ER tokens present.

### Pitfall 2: PII left on busy-blocks

**What goes wrong:** Original `summary`, `location`, or `categories` remain on outbound object.  
**Why it happens:** Spread-copy washing or nulling instead of omitting keys.  
**How to avoid:** Build busy object from whitelist only; test forbidden keys (`categories`, `description`, `location`).  
**Warning signs:** Busy outbound `summary !== 'Busy'`.

### Pitfall 3: Sensitive events emitted as busy

**What goes wrong:** HR events show as “Busy” externally.  
**Why it happens:** Mapping sensitive to `busy` instead of `drop`.  
**How to avoid:** Check `ER-SENSITIVE` first in classifier (D-01).  
**Warning signs:** `hr-review` fixture produces non-null outbound.

### Pitfall 4: Recurrence exception metadata dropped

**What goes wrong:** Phase 3 cannot upsert exception instances.  
**Why it happens:** Busy wash copies only uid/start/end.  
**How to avoid:** Pass through `recurrenceId` when present; include `isRecurring` when master series (D-06).  
**Warning signs:** `modified-instance` washed object missing `recurrenceId`.

### Pitfall 5: Date assertion flakiness in sidecars

**What goes wrong:** Tests fail comparing JSON ISO strings to `Date` objects.  
**Why it happens:** `FixtureExpected.washed` typed as `Record<string, unknown>`.  
**How to avoid:** Normalize in `assertProcessed` (known date fields → `Date` before deep equal).  
**Warning signs:** Vitest shows string vs Date mismatches on `start`/`end`/`recurrenceId`.

## Code Examples

### Multi-value `CATEGORIES` at adapter (already handled)

RFC 5545 defines comma-separated values; `node-ical` splits with `splitUnescapedCommas` into `string[]` [CITED: github.com/jens-maus/node-ical `ical-parser-utils.js` categoriesParameter] [CITED: RFC 5545 §3.8.1.2].

Domain classification should **not** re-split raw iCal lines — only normalize each entry in `event.categories`.

### Forbidden-key scan (busy tests)

```typescript
const FORBIDDEN_BUSY_KEYS = [
  'categories',
  'description',
  'location',
] as const;

export function assertBusyOutbound(outbound: OutboundEvent): void {
  for (const key of FORBIDDEN_BUSY_KEYS) {
    if (key in outbound) {
      throw new Error(`Busy outbound must not include ${key}`);
    }
  }
  if (outbound.summary !== 'Busy') {
    throw new Error(`Busy outbound summary must be "Busy"`);
  }
}
```

### Pipeline fixture test sketch

```typescript
import { describe, it } from 'vitest';
import { loadFixture } from '../helpers/load-fixture.js';
import { parseIcs } from '../helpers/parse-ics.js';
import { processSourceEvent } from '../../src/domain/process-source-event.js';
import { assertProcessed } from '../helpers/assert-sidecar.js';

describe('domain pipeline fixtures', () => {
  it('internal/team-sync matches sidecar', async () => {
    const { ics, expected } = await loadFixture('internal', 'team-sync');
    const result = processSourceEvent(parseIcs(ics));
    assertProcessed(result, expected);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ARCHITECTURE.md flat `src/classify/` | `src/domain/classify/` | Phase 1 D-01 / Phase 2 D-10 | Planner must place modules under domain layer |
| Smoke-only recurrence checks | Full classify/wash pipeline on recurrence fixtures | Phase 2 D-15 | Replace UID-only recurrence smoke expectations |
| `assertTier` uid/categories only | `assertProcessed` tier + propagation + washed | Phase 2 D-16 | Completes TEST-04 |

**Deprecated/outdated:**

- Washer as second restrict-only gate — rejected by D-12.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Unknown-only non-ER categories ⇒ `tier: 'internal'`, `propagation: 'busy'` (not `untagged`) | Pattern 1 | Sidecar/tier reporting mismatch if IT strategy treats unknown as untagged |
| A2 | `ER-PUBLIC` + any non-ER category ⇒ busy (not full) | Pattern 1 | Accidental full disclosure if unknown treated as neutral |
| A3 | Busy outbound includes `isRecurring: true` when `source.isRecurring` | Pattern 2 | Phase 3 series upsert bugs if flag omitted |
| A4 | Override instances (`recurrenceId` set, `isRecurring: false`) still pass `recurrenceId` on busy wash | Pattern 2 | Exception upsert failures in Phase 3 |

## Open Questions (RESOLVED)

1. **Multi-tag fixture files vs synthesized unit tests only** — **RESOLVED:** Use synthesized in-memory `SourceEvent` unit tests in `test/domain/classify.test.ts` for mixed-tag and case-fold cases (D-01 discretion). No additional `.ics` files required for Phase 2.

2. **External IT strategy markdown (not in repo)** — **RESOLVED:** `02-CONTEXT.md` D-03 is authoritative in this repo: unknown/non-ER category tokens contribute to busy-block (`internal` tier); empty `categories` array maps to `untagged` + busy per D-02/SYNC-03.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest, tsc | ✓ | v22.19.0 (local) | CI/README require **24.x** per `package.json` engines — align runner before release |
| npm | scripts | ✓ | 10.9.3 | — |
| vitest | TEST-04 | ✓ | 5.0.0 | — |
| node-ical | fixture parse | ✓ | 0.27.2 | — |

**Missing dependencies with no fallback:** none for Phase 2 scope.

**Note:** Local dev on Node 22 runs tests today; `engines.node: "24.x"` is the project contract [VERIFIED: package.json].

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 5.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` (same; no split integration suite yet) |
| Typecheck gate | `npm run typecheck` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-02 | ER tag classification | unit | `npm test -- test/domain/classify.test.ts` | ❌ Wave 0 |
| SYNC-03 | Untagged → busy | unit + fixture | `npm test -- test/domain/pipeline-fixtures.test.ts -t untagged` | ❌ Wave 0 |
| SYNC-04 | Busy whitelist / strip PII fields | unit | `npm test -- test/domain/wash.test.ts` | ❌ Wave 0 |
| SYNC-08 | No full without public-only | unit | `npm test -- test/domain/classify.test.ts -t restrict` | ❌ Wave 0 |
| SYNC-09 | No categories on busy outbound | unit | `npm test -- test/domain/wash.test.ts -t forbidden` | ❌ Wave 0 |
| SYNC-10 | No extra fields on busy | unit | same as SYNC-04 | ❌ Wave 0 |
| TEST-04 | Full domain coverage | unit + fixture | `npm test` | ❌ Wave 0 (extend beyond smoke) |

### Sampling Rate

- **Per task commit:** `npm test -- test/domain/<changed>.test.ts`
- **Per wave merge:** `npm test && npm run typecheck`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/domain/classify/classify-source-event.ts` + exports
- [ ] `src/domain/wash/wash-source-event.ts` + exports
- [ ] `src/domain/process-source-event.ts`
- [ ] `src/domain/types/index.ts` — `OutboundEvent`, `Classification`, `ProcessedSourceEvent`
- [ ] `test/domain/classify.test.ts`, `wash.test.ts`, `pipeline-fixtures.test.ts`
- [ ] `test/helpers/assert-sidecar.ts` — `assertProcessed`, date normalization, busy forbidden-key scan
- [ ] Update busy/recurrence `.expected.json` `washed` objects (D-15)
- [ ] Optional: multi-tag edge cases (D-01) via unit tests or fixtures

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | N/A this phase |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | Restrict-only classifier; default busy/drop |
| V5 Input Validation | yes | Trim/normalize category strings; ignore empty tokens; no `any` |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for TypeScript domain pipeline

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Information disclosure via misclassification | Information Disclosure | Fail-closed table; unit tests per tier; PITFALLS #2 |
| PII in busy-blocks | Information Disclosure | Whitelist construction; forbidden-key tests; PITFALLS #5 |
| Policy bypass via washer | Elevation | Single classifier gate (D-12); no full path in washer |
| Tag write-back to source | Tampering | Out of scope — Phase 3 writers only; SYNC-09 satisfied by not emitting tags on busy outbound |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/02-classification-washing-and-ical-domain-logic/02-CONTEXT.md` — locked decisions D-01–D-16
- `src/domain/types/index.ts`, `src/adapters/ical/parse-source-event.ts` — current types and parse boundary [VERIFIED: codebase]
- `test/fixtures/**`, `test/helpers/*` — sidecar schema and harness [VERIFIED: codebase]
- RFC 5545 §3.8.1.2 Categories — comma-separated values [CITED: rfc-editor.org/rfc/rfc5545]
- node-ical `categoriesParameter` — splits multi-value categories [CITED: github.com/jens-maus/node-ical]

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` #2, #5 — leak and PII patterns
- `.planning/research/ARCHITECTURE.md` — classify/wash build order (paths adjusted to `src/domain/`)
- `.planning/PROJECT.md` — restrict-only and fail-closed product rules

### Tertiary (LOW confidence)

- `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md` — not present in workspace; rules taken from in-repo CONTEXT/REQUIREMENTS

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — no new deps; existing vitest/TS patterns from Phase 1
- Architecture: **HIGH** — locked module layout and decision table in CONTEXT
- Pitfalls: **HIGH** — aligned with PITFALLS research and fixture inventory

**Research date:** 2026-09-14  
**Valid until:** 2026-10-14 (stable domain rules; extend if IT strategy doc contradicts A1–A2)
