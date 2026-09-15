# Phase 3: CalDAV read, UID store, and Google sync loop - Pattern Map

**Mapped:** 2026-09-15
**Files analyzed:** 20
**Analogs found:** 14 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/config/env.ts` | config | transform | `.env.example` + `test/domain/classify.test.ts` (factory) | partial |
| `src/adapters/caldav/client.ts` | adapter | request-response | `src/adapters/ical/parse-source-event.ts` | role-match |
| `src/adapters/caldav/reader.ts` | adapter | batch + event-driven | `src/adapters/ical/parse-source-event.ts` | role-match |
| `src/store/schema.sql` | migration | file-I/O | — | **none** |
| `src/store/mapping-store.ts` | store | CRUD | `src/domain/classify/classify-source-event.ts` (pure API) | partial |
| `src/store/sync-state-store.ts` | store | CRUD | `src/store/mapping-store.ts` (same module family) | partial |
| `src/writers/google/auth.ts` | config | request-response | `src/adapters/caldav/client.ts` (factory) | partial |
| `src/writers/google/calendar-writer.ts` | service | CRUD | `src/domain/wash/wash-source-event.ts` + `src/adapters/ical/parse-source-event.ts` | partial |
| `src/sync/types.ts` | model | transform | `src/domain/types/index.ts` | exact |
| `src/sync/run-sync-cycle.ts` | service | batch | `src/domain/process-source-event.ts` | exact |
| `src/index.ts` | route/entry | request-response | `src/index.ts` (extend) | exact |
| `.env.example` | config | file-I/O | `.env.example` (extend) | exact |
| `package.json` | config | batch | `package.json` (extend deps) | exact |
| `test/integration/sync-cycle.test.ts` | test | batch | `test/domain/pipeline-fixtures.test.ts` | role-match |
| `test/integration/sync-recurrence.test.ts` | test | batch | `test/domain/pipeline-fixtures.test.ts` | role-match |
| `test/config/env.test.ts` | test | transform | `test/domain/classify.test.ts` | role-match |
| `test/store/mapping-store.test.ts` | test | CRUD | `test/domain/classify.test.ts` | partial |
| `test/adapters/caldav-readonly.test.ts` | test | batch | `test/smoke.test.ts` | role-match |
| `test/writers/google-auth.test.ts` | test | transform | `test/config/env.test.ts` (planned) | partial |
| `test/helpers/*` (optional extend) | utility | transform | `test/helpers/load-fixture.ts` | role-match |

**Unchanged integration (call sites only):** `src/domain/process-source-event.ts`, `src/adapters/ical/parse-source-event.ts` — sync loop must call `parseIcsToSourceEvents` then `processSourceEvent` per event.

## Pattern Assignments

### `src/config/env.ts` (config, transform)

**Analog:** `.env.example` (key names) + `test/domain/classify.test.ts` (small pure inputs)

**Env key surface** (`.env.example` lines 1–25):

```bash
MAILBOX_CALDAV_URL=https://dav.mailbox.org
MAILBOX_USERNAME=operator@example.org
MAILBOX_APP_PASSWORD=your-app-password-here
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
LOG_LEVEL=info
SYNC_INTERVAL_MINUTES=5
```

Phase 3 additions per CONTEXT D-01/D-08/D-16: `MAILBOX_CALENDAR_URL`, `GOOGLE_CALENDAR_ID`, `SQLITE_PATH` or `DATA_DIR`, rename interval to **`SYNC_INTERVAL_SECONDS`** (default `300`).

**Validation pattern (establish — no Zod in repo yet):**

- Single exported `loadConfig()` (or `parseEnv`) that runs once at CLI startup.
- Use Zod `.safeParse(process.env)`; on failure, throw with flattened field errors (fail closed, SEC-04).
- Return a **readonly** typed object — no `process.env` reads outside this module.
- Redact secrets in any error messages (never echo `MAILBOX_APP_PASSWORD` / refresh token).

**Test factory analog** (`test/domain/classify.test.ts` lines 5–16) — use explicit object literals in `env.test.ts` instead of mutating global env when possible:

```typescript
function sourceEvent(
  categories: string[],
  overrides: Partial<SourceEvent> = {},
): SourceEvent {
  return {
    uid: 'test@er.example',
    categories,
    start: new Date('2026-09-01T10:00:00.000Z'),
    isRecurring: false,
    ...overrides,
  };
}
```

Mirror with `minimalEnv(overrides: Partial<Env> = {}): Record<string, string>` for Zod tests.

---

### `src/adapters/caldav/client.ts` (adapter, request-response)

**Analog:** `src/adapters/ical/parse-source-event.ts` — **only** this layer imports the external CalDAV library (`tsdav`).

**Imports / boundary** (ical adapter lines 1–3):

```typescript
import ical from 'node-ical';
import type { CalendarResponse, VEvent } from 'node-ical';
import type { SourceEvent } from '../../domain/types/index.js';
```

CalDAV equivalent: `import { DAVClient } from 'tsdav'`; export `createCalDavClient(config)` returning logged-in client. Credentials come from `loadConfig()` — not from `process.env` inside adapter.

**Error handling** (ical lines 36–41):

```typescript
  if (!vevent.uid) {
    throw new Error('VEVENT missing required UID');
  }
  if (!vevent.start) {
    throw new Error('VEVENT missing required DTSTART');
  }
```

Use explicit `Error` messages for programmer/config failures at login; map HTTP/auth failures to thrown errors with safe messages (no password in string).

**SEC-01:** Export only read helpers (`login`, `fetch`, `sync`). Do **not** wrap tsdav create/update/delete calendar object APIs.

---

### `src/adapters/caldav/reader.ts` (adapter, batch)

**Analog:** `src/adapters/ical/parse-source-event.ts` — compose external I/O with domain types; delegate ICS parsing to ical adapter.

**Multi-event parse pattern** (lines 83–91) — reader must call this for each changed `.ics` payload:

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

**Recurrence key normalization** (lines 72–77) — reuse same ISO key idea for mapping `recurrenceId` in store/writer:

```typescript
    const key = recurrenceId.toISOString();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
```

**Reader port shape:** `poll(): Promise<SyncDelta>` where `SyncDelta` includes `changed: { href, data: string, etag? }[]` and `deleted: { href, uid?, recurrenceId? }[]` — map tsdav 404/deleted entries to `deleted` (D-04/D-05). Persist sync token via `sync-state-store`, not inside reader globals.

**Barrel (optional):** If adding `src/adapters/caldav/index.ts`, mirror `src/adapters/ical/index.ts` (lines 1–5):

```typescript
export {
  parseIcsToSourceEvent,
  parseIcsToSourceEvents,
  getCategories,
} from './parse-source-event.js';
```

---

### `src/store/schema.sql` (migration, file-I/O)

**Analog:** None in codebase.

**Establishment authority:** `03-RESEARCH.md` SQLite schema (`event_mappings`, `sync_state`, optional `source_href_snapshot`). Run DDL on open from `mapping-store` or dedicated bootstrap — planner choice.

---

### `src/store/mapping-store.ts` (store, CRUD)

**Analog:** `src/domain/classify/classify-source-event.ts` — small, deterministic exported functions; no network.

**Pure function export style** (classify lines 17–35):

```typescript
export function classifySourceEvent(event: SourceEvent): Classification {
  const tokens = event.categories.map((c) => c.trim()).filter(Boolean);
  const norm = tokens.map(normalizeToken);

  if (norm.includes(ER.SENSITIVE)) {
    return { tier: 'sensitive', propagation: 'drop' };
  }
  // ...
  return { tier: 'internal', propagation: 'busy' };
}
```

**Store API pattern (establish):**

- Constructor or `openMappingStore(path: string)` using `better-sqlite3`.
- Methods: `getMapping({ uid, recurrenceId })`, `upsertMapping(...)`, `markCancelled(...)`.
- Composite key `(source_uid, recurrence_id)` with explicit NULL handling (D-06) — document sentinel in implementation.
- Use **transactions** for upsert + `last_synced_at` in one `db.transaction(() => { ... })()`.
- Never import `googleapis` or `tsdav`.

---

### `src/store/sync-state-store.ts` (store, CRUD)

**Analog:** Same module conventions as `mapping-store.ts`.

**Columns:** `calendar_url`, `sync_token`, `ctag`, `last_success_at`, `last_error`, `degraded_mode` (OPS-03). Update `last_success_at` only after full cycle success; per-event failures do not block state write if cycle completes (D-18).

---

### `src/writers/google/auth.ts` (config, request-response)

**Analog:** `src/adapters/caldav/client.ts` — factory from config, single external dependency boundary.

**Pattern:** `createGoogleCalendarClient(config)` returns authenticated `calendar_v3.Calendar` (or narrow wrapper). Scope constant exported for `google-auth.test.ts` (SEC-03): `https://www.googleapis.com/auth/calendar` or narrower `calendar.events` per org policy.

---

### `src/writers/google/calendar-writer.ts` (service, CRUD)

**Analog:** `src/domain/wash/wash-source-event.ts` (outbound field rules) + ical adapter (explicit field mapping).

**Busy outbound whitelist** (wash lines 9–36) — writer must enforce Google-side equivalents (D-15):

```typescript
export function washSourceEvent(
  source: SourceEvent,
  propagation: PropagationDecision,
): OutboundEvent | null {
  if (propagation === 'drop') {
    return null;
  }
  if (propagation === 'full') {
    return { ...source };
  }

  const outbound: OutboundEvent = {
    uid: source.uid,
    start: source.start,
    summary: BUSY_SUMMARY,
  };
  // optional end, recurrenceId, isRecurring only
```

Map `OutboundEvent` → Google `events.insert` / `events.patch` with `transparency: 'opaque'` for busy, `iCalUID: sourceUid` on create (D-14), `extendedProperties.private['er.bridge_uuid']` (key discretion).

**Cancel-not-delete (D-04):** `cancel()` sets `status: 'cancelled'` — do not call `events.delete`.

**Interface:** Implement `CalendarWriter` from `src/sync/types.ts` (port); keep all `googleapis` imports in this file only.

---

### `src/sync/types.ts` (model, transform)

**Analog:** `src/domain/types/index.ts`

**Type export style** (domain types lines 1–38):

```typescript
export type Tier = 'public' | 'internal' | 'sensitive' | 'untagged';

export type PropagationDecision = 'full' | 'busy' | 'drop';

export interface SourceEvent {
  uid: string;
  categories: string[];
  // ...
}

export interface OutboundEvent {
  uid: string;
  // ...
}
```

Add sync ports here (or adjacent `src/sync/ports.ts` if planner splits): `SyncDelta`, `CalDavReader`, `EventMappingStore`, `CalendarWriter`, `SyncCycleDeps`. Use `import type` for domain types from `../domain/types/index.js`.

---

### `src/sync/run-sync-cycle.ts` (service, batch)

**Analog:** `src/domain/process-source-event.ts` — pure orchestration composing injected steps.

**Pipeline composition** (`process-source-event.ts` lines 1–8):

```typescript
import { classifySourceEvent } from './classify/classify-source-event.js';
import type { ProcessedSourceEvent, SourceEvent } from './types/index.js';
import { washSourceEvent } from './wash/wash-source-event.js';

export function processSourceEvent(source: SourceEvent): ProcessedSourceEvent {
  const { tier, propagation } = classifySourceEvent(source);
  const outbound = washSourceEvent(source, propagation);
  return { tier, propagation, outbound };
}
```

**Sync cycle equivalent (establish):**

```typescript
export async function runSyncCycle(deps: SyncCycleDeps): Promise<SyncCycleResult> {
  const delta = await deps.caldav.poll();
  for (const item of delta.changed) {
    for (const source of parseIcsToSourceEvents(item.data)) {
      const processed = processSourceEvent(source);
      // mapping lookup → writer upsert or cancel on drop (SYNC-05)
    }
  }
  for (const tombstone of delta.deleted) {
    // mapping lookup → writer.cancel (D-04)
  }
  // persist sync token + last_success_at
}
```

**Rules:**

- Import `parseIcsToSourceEvents` from `../adapters/ical/index.js` (not `node-ical`).
- Import `processSourceEvent` from `../domain/process-source-event.js`.
- **No** `process.env`, **no** `googleapis`, **no** `tsdav` in this file — only deps (03-RESEARCH Pattern 1).
- Per-event try/catch: log via `deps.log`, continue (D-18).

---

### `src/index.ts` (entry, request-response)

**Analog:** Current `src/index.ts`

**ESM main guard** (lines 1–13):

```typescript
import { fileURLToPath } from 'node:url';

export const VERSION = '0.0.0';

export function main(): void {
  console.log(`er-calendar-bridge v${VERSION} — scaffold only`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
```

**Phase 3 extension (establish):**

- `loadConfig()` at startup; exit non-zero on invalid env.
- Parse `process.argv[2]` — `sync` subcommand; `--watch` flag for interval loop (D-17).
- Wire real `createCalDavClient`, stores, `GoogleCalendarWriter`, `runSyncCycle`.
- Watch mode: `setInterval` or `while` + `await sleep(ms)` using `SYNC_INTERVAL_SECONDS`.
- Keep `export function main()` testable without executing CLI guard.

---

### `.env.example` (config, file-I/O)

**Analog:** Existing `.env.example`

Extend with `MAILBOX_CALENDAR_URL`, `GOOGLE_CALENDAR_ID`, `SQLITE_PATH`/`DATA_DIR`, replace `SYNC_INTERVAL_MINUTES` with `SYNC_INTERVAL_SECONDS=300`. Keep placeholder credentials; comment SEC-01 read-only CalDAV.

---

### `package.json` (config, batch)

**Analog:** Current `package.json`

**Scripts pattern** (lines 9–14):

```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json",
    "build": "tsc -p tsconfig.json"
  },
```

Add runtime deps: `tsdav`, `googleapis`, `google-auth-library`, `better-sqlite3`, `zod`, `pino`; dev: `@types/better-sqlite3`. Keep `"type": "module"` and Node 24 `engines`.

---

### `test/integration/sync-cycle.test.ts` (test, batch)

**Analog:** `test/domain/pipeline-fixtures.test.ts`

**Imports + fixture loop** (pipeline lines 1–6, 20–35):

```typescript
import { describe, it, expect } from 'vitest';
import { loadFixture } from '../helpers/load-fixture.js';
import { parseIcs } from '../helpers/parse-ics.js';
import { assertProcessed } from '../helpers/assert-sidecar.js';
import { processSourceEvent } from '../../src/domain/process-source-event.js';
```

**Integration extension:**

- `import { runSyncCycle } from '../../src/sync/run-sync-cycle.js'`
- Mock `caldav.poll` with `vi.fn()` returning ICS from `loadFixture('internal', 'team-sync')`.
- Mock `writer.upsertOutbound` / `writer.cancel`; use in-memory SQLite or test double store.
- **Idempotency test:** run `runSyncCycle` twice; expect single upsert (SYNC-11).
- **Delete test:** second poll returns `deleted: [{ uid }]`; expect `cancel` called, not delete.

Use `parseIcsToSourceEvents` in mock setup when simulating full CalDAV payload (multi-instance), not only `parseIcs`.

---

### `test/integration/sync-recurrence.test.ts` (test, batch)

**Analog:** `test/domain/pipeline-fixtures.test.ts` recurrence block (lines 14–18, 38–43):

```typescript
const RECURRENCE_FIXTURES = [
  'weekly-series',
  'modified-instance',
  'deleted-instance',
];

  for (const name of RECURRENCE_FIXTURES) {
    it(`recurrence/${name} matches full pipeline sidecar`, async () => {
      const { ics, expected } = await loadFixture('recurrence', name);
      const result = processSourceEvent(parseIcs(ics));
      assertProcessed(result, expected);
    });
  }
```

Extend to sync cycle: feed `modified-instance` / `deleted-instance` ICS through mocked CalDAV; assert writer instance vs master behavior (SYNC-07).

---

### `test/config/env.test.ts` (test, transform)

**Analog:** `test/domain/classify.test.ts`

**Table-driven expectations** (classify lines 18–36):

```typescript
describe('classifySourceEvent', () => {
  it('ER-SENSITIVE only → sensitive tier and drop propagation', () => {
    const result = classifySourceEvent(sourceEvent(['ER-SENSITIVE']));
    expect(result).toEqual({ tier: 'sensitive', propagation: 'drop' });
  });
```

Test missing required vars, invalid URL shapes, default `SYNC_INTERVAL_SECONDS`, rejection of unknown keys if using `z.strictObject()`.

---

### `test/store/mapping-store.test.ts` (test, CRUD)

**Analog:** `test/domain/classify.test.ts` (isolated unit tests, no fixtures dir required)

Test composite key upsert, `markCancelled` retains row (D-09), distinct rows for master vs `recurrenceId`.

---

### `test/adapters/caldav-readonly.test.ts` (test, batch)

**Analog:** `test/smoke.test.ts` — lightweight contract test.

Assert exported caldav module does not expose write method names (grep or explicit export list). Optional: static import scan.

---

### `test/writers/google-auth.test.ts` (test, transform)

**Analog:** `test/config/env.test.ts` (constant assertion)

Assert exported scope string matches SEC-03; no live OAuth network calls.

---

## Shared Patterns

### Three-layer dependency direction

**Source:** Phase 1/2 PATTERNS + `03-CONTEXT.md` code_context

```
sync/ → adapters/, store/, writers/, domain/
adapters/ical, adapters/caldav → domain/types
writers/google → domain/types + sync/types (ports)
domain/ → (no adapters, no googleapis, no tsdav, no sqlite)
```

### ESM + `.js` import suffix

**Source:** `tsconfig.json`, all existing `src/` files

```typescript
import { processSourceEvent } from '../domain/process-source-event.js';
```

Apply to every new module under `src/` and `test/`.

### Adapter boundary for third-party libraries

**Source:** `src/adapters/ical/parse-source-event.ts`

| Library | Allowed location |
|---------|------------------|
| `node-ical` | `src/adapters/ical/` only |
| `tsdav` | `src/adapters/caldav/` only |
| `googleapis` / `google-auth-library` | `src/writers/google/` only |
| `better-sqlite3` | `src/store/` only |

### Domain pipeline (unchanged)

**Source:** `src/domain/process-source-event.ts`

Sync loop always: `parseIcsToSourceEvents` → per event `processSourceEvent` → writer/store decisions.

### Fixture harness for acceptance tests

**Source:** `test/helpers/load-fixture.ts` (lines 5–25)

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
```

Reuse for mocked CalDAV payloads — no live mailbox.org in CI (D-19).

### Vitest conventions

**Source:** `vitest.config.ts`, `test/domain/classify.test.ts`

- `globals: false` — import `describe`, `it`, `expect` explicitly.
- `include: ['test/**/*.test.ts']` — place integration tests under `test/integration/`.
- Factory helpers at top of file; `expect(result).toEqual(...)` for policy tables.

### CLI entry guard

**Source:** `src/index.ts` lines 9–12

Use `fileURLToPath(import.meta.url)` comparison for `isMain` (NodeNext-safe), not string `file://${process.argv[1]}`.

### Per-event error isolation

**Source:** `03-CONTEXT.md` D-18

Inside `runSyncCycle`, catch errors around single-event processing; log structured fields `{ uid, recurrenceId, err }`; do not rethrow to abort cycle unless fatal (config/store open failure).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/store/schema.sql` | migration | file-I/O | No SQL or migrations in repo yet |
| `src/store/mapping-store.ts` | store | CRUD | No persistence layer; follow RESEARCH schema + better-sqlite3 idioms |
| `src/store/sync-state-store.ts` | store | CRUD | Same as mapping store |
| `src/writers/google/auth.ts` | config | request-response | No OAuth code; use RESEARCH OAuth example |
| `src/writers/google/calendar-writer.ts` | service | CRUD | No Google client; field rules from `wash-source-event.ts` |
| `src/config/env.ts` | config | transform | No Zod/env loader; keys from `.env.example` only |

## Metadata

**Analog search scope:** `src/`, `test/`, `.env.example`, `.planning/phases/01-*/01-PATTERNS.md`, `.planning/phases/02-*/02-PATTERNS.md`, `.planning/research/ARCHITECTURE.md`
**Files scanned:** ~35 TypeScript/config/planning files
**Pattern extraction date:** 2026-09-15

## PATTERN MAPPING COMPLETE

**Phase:** 03 - caldav-read-uid-store-and-google-sync-loop
**Files classified:** 20
**Analogs found:** 14 / 20

### Coverage

- Files with exact analog: 4 (`src/sync/types.ts`, `src/sync/run-sync-cycle.ts`, `src/index.ts`, `.env.example`)
- Files with role-match analog: 10
- Files with no analog: 6 (store SQL/SQLite, Google auth/writer, Zod env — establish from RESEARCH)

### Key Patterns Identified

- **Port-based `runSyncCycle(deps)`** mirrors `processSourceEvent` composition — no env/globals in orchestrator.
- **CalDAV + Google I/O isolated** to `adapters/caldav/` and `writers/google/` like `node-ical` in `adapters/ical/`.
- **Sync path uses `parseIcsToSourceEvents`** then existing classify/wash pipeline per logical event.
- **Integration tests** extend `pipeline-fixtures.test.ts` + `loadFixture` with `vi.fn()` ports (credential-free CI).
- **CLI** extends existing `src/index.ts` `main` + `fileURLToPath` guard for `sync` / `sync --watch`.

### File Created

`.planning/phases/03-caldav-read-uid-store-and-google-sync-loop/03-PATTERNS.md`

### Ready for Planning

Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
