# Phase 4: Withhold notifications and audit log - Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 16
**Analogs found:** 14 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/store/audit-store.ts` | store | CRUD + append-only | `src/store/mapping-store.ts` | exact |
| `src/store/schema.sql` | migration | batch (DDL) | `src/store/schema.sql` | exact |
| `src/sync/withhold-transition.ts` | utility | transform | `src/domain/process-source-event.ts` | role-match |
| `src/notify/types.ts` | utility | — | `src/sync/types.ts` | role-match |
| `src/notify/withhold-notifier.ts` | service | request-response | `src/writers/google/calendar-writer.ts` | role-match |
| `src/sync/types.ts` | utility | — | `src/sync/types.ts` (extend) | exact |
| `src/sync/run-sync-cycle.ts` | service | event-driven | `src/sync/run-sync-cycle.ts` | exact |
| `src/config/env.ts` | config | transform | `src/config/env.ts` | exact |
| `src/index.ts` | route/CLI | request-response | `src/index.ts` | exact |
| `.env.example` | config | — | `.env.example` | exact |
| `package.json` | config | — | `package.json` (existing deps) | partial |
| `test/store/audit-store.test.ts` | test | — | `test/store/mapping-store.test.ts` | exact |
| `test/sync/withhold-transition.test.ts` | test | — | `test/domain/classify.test.ts` | exact |
| `test/notify/withhold-notifier.test.ts` | test | — | `test/writers/calendar-writer.test.ts` | partial |
| `test/integration/sync-cycle.test.ts` | test | — | `test/integration/sync-cycle.test.ts` | exact |
| `test/config/env.test.ts` | test | — | `test/config/env.test.ts` | exact |

## Pattern Assignments

### `src/store/audit-store.ts` (store, CRUD + append-only)

**Analog:** `src/store/mapping-store.ts`

**Imports pattern** (lines 1-10):

```typescript
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
```

**Open + schema bootstrap** (lines 51-58, 95-101):

```typescript
const SCHEMA_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'schema.sql',
);

function loadSchema(db: Database.Database): void {
  const ddl = readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(ddl);
}

export function openMappingStore(sqlitePath: string): MappingStore {
  if (sqlitePath !== ':memory:') {
    mkdirSync(dirname(sqlitePath), { recursive: true });
  }

  const db = new Database(sqlitePath);
  loadSchema(db);
```

**Recurrence key normalization** (reuse same rule as mappings — lines 61-68):

```typescript
function normalizeRecurrenceKey(recurrenceId?: Date | string): string {
  if (recurrenceId === undefined) {
    return '';
  }
  if (recurrenceId instanceof Date) {
    return recurrenceId.toISOString();
  }
  return recurrenceId;
}
```

**Prepared statements + transaction upsert** (lines 103-129, 149-181):

```typescript
  const upsertStmt = db.prepare(`
    INSERT INTO event_mappings ( /* ... */ ) VALUES ( /* @named */ )
    ON CONFLICT(source_uid, recurrence_id) DO UPDATE SET
      google_event_id = excluded.google_event_id,
      /* ... */
      bridge_uuid = event_mappings.bridge_uuid
  `);

  const upsertTransaction = db.transaction((params) => {
    const recurrenceKey = normalizeRecurrenceKey(params.recurrenceId);
    const existing = selectMapping.get(params.uid, recurrenceKey);
    const bridgeUuid = params.bridgeUuid ?? existing?.bridge_uuid ?? randomUUID();
    upsertStmt.run({ /* snake_case @params */ });
  });
```

**Interface + close** (lines 26-48, 220-222):

```typescript
export interface MappingStore {
  getMapping(params: { uid: string; recurrenceId?: Date | string }): EventMappingRow | undefined;
  upsertMapping(params: { /* ... */ }): void;
  close(): void;
}
```

**Apply to audit-store:** Export `openAuditStore(sqlitePath)` with `WithholdNotifyStateStore` (get/upsert by uid+recurrence) + `appendAuditRow` (INSERT only). Share `schema.sql` path and `:memory:` test pattern from `test/store/mapping-store.test.ts`.

---

### `src/store/schema.sql` (migration)

**Analog:** `src/store/schema.sql`

**Table + PK pattern** (lines 1-15):

```sql
CREATE TABLE IF NOT EXISTS event_mappings (
  source_uid TEXT NOT NULL,
  recurrence_id TEXT NOT NULL DEFAULT '',
  bridge_uuid TEXT NOT NULL,
  /* ... */
  PRIMARY KEY (source_uid, recurrence_id)
);
```

**Apply:** Add `withhold_notify_state` (PK `source_uid`, `recurrence_id`; columns `bridge_uuid`, `last_propagation`, `episode`, `updated_at`) and append-only `withhold_audit` with index on `recorded_at`. Master rows use `recurrence_id ''` per mapping-store comment (lines 1-2 of schema + mapping-store.ts header).

---

### `src/sync/withhold-transition.ts` (utility, transform)

**Analog:** `src/domain/process-source-event.ts` + `test/domain/classify.test.ts`

**Pure function export** (lines 1-9):

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

**Test shape** (`test/domain/classify.test.ts` lines 1-22):

```typescript
import { describe, it, expect } from 'vitest';

describe('classifySourceEvent', () => {
  it('ER-SENSITIVE only → sensitive tier and drop propagation', () => {
    const result = classifySourceEvent(sourceEvent(['ER-SENSITIVE']));
    expect(result).toEqual({ tier: 'sensitive', propagation: 'drop' });
  });
```

**Apply:** Implement `computeWithholdTransition()` as side-effect-free logic; table-driven tests for episode, unchanged busy/drop suppression, full→busy→full→busy (per `04-RESEARCH.md` Pattern 1). No I/O in this module.

---

### `src/notify/types.ts` (utility)

**Analog:** `src/sync/types.ts`

**Injectable interface** (lines 14-26):

```typescript
export interface CalendarWriter {
  upsertOutbound(params: {
    mappingKey: { uid: string; recurrenceId?: string };
    outbound: OutboundEvent;
    existingGoogleEventId?: string;
    bridgeUuid: string;
  }): Promise<{ googleEventId: string }>;

  cancel(params: {
    googleEventId: string;
    isRecurringInstance: boolean;
  }): Promise<void>;
}
```

**Apply:** Define `WithholdNotifier` with a single `notifyWithhold(params)` (tier, propagation, dedupKey — no summary). Production impl + no-op/mock for tests.

---

### `src/notify/withhold-notifier.ts` (service, request-response)

**Analog:** `src/writers/google/calendar-writer.ts` + `src/writers/google/auth.ts`

**Factory returning interface** (`calendar-writer.ts` lines 7, 85-133):

```typescript
export function createGoogleCalendarWriter(
  deps: { auth: OAuth2Client; calendarId: string },
): CalendarWriter {
  const calendar = google.calendar({ version: 'v3', auth: deps.auth });

  return {
    async upsertOutbound(params) { /* ... */ },
    async cancel(params) { /* ... */ },
  };
}
```

**Config-only factory deps** (`auth.ts` lines 7-21):

```typescript
export type GoogleAuthConfig = Readonly<{
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
}>;

export function createGoogleAuthClient(
  config: GoogleAuthConfig,
): OAuth2Client {
  const client = new OAuth2Client(/* ... */);
  client.setCredentials({ refresh_token: config.googleRefreshToken });
  return client;
}
```

**Apply:** `createWithholdNotifier(config)` builds nodemailer transport from `AppConfig` SMTP fields; catch/log errors internally or return result enum for audit `notify_status` (D-08). Do not throw through sync loop. Minimal `text` body only (D-09).

---

### `src/sync/types.ts` (extend deps)

**Analog:** `src/sync/types.ts`

**SyncCycleDeps** (lines 43-51):

```typescript
export interface SyncCycleDeps {
  caldav: CalDavReader;
  writer: CalendarWriter;
  mappingStore: MappingStore;
  syncStateStore: SyncStateStore;
  calendarUrl: string;
  log: Logger;
  now?: () => Date;
}
```

**Apply:** Add optional `auditStore`, `withholdNotifier`, and notify config snapshot (or pass via deps from `index.ts`). Keep interfaces in `types.ts` for test mocking (same as `CalDavReader` / `CalendarWriter`).

---

### `src/sync/run-sync-cycle.ts` (modify)

**Analog:** `src/sync/run-sync-cycle.ts`

**Per-event try/catch (D-18)** (lines 127-136):

```typescript
    for (const source of sources) {
      try {
        await handleOutboundEvent(deps, source, item.href, item.etag, result);
      } catch (err) {
        deps.log.error(
          { uid: source.uid, recurrenceId: source.recurrenceId, err },
          'sync event failed',
        );
        result.errors += 1;
      }
    }
```

**Drop branch early return (integration gap)** (lines 18-37):

```typescript
  const processed = processSourceEvent(source);
  const mapping = deps.mappingStore.getMapping({
    uid: source.uid,
    recurrenceId: source.recurrenceId,
  });

  if (processed.propagation === 'drop') {
    result.dropped += 1;
    if (mapping?.status === 'active') {
      await deps.writer.cancel({ /* ... */ });
      deps.mappingStore.markCancelled({ /* ... */ });
      result.cancelled += 1;
    }
    return;
  }
```

**Busy upsert + bridgeUuid** (lines 44-72):

```typescript
  const bridgeUuid = mapping?.bridgeUuid ?? randomUUID();
  const { googleEventId } = await deps.writer.upsertOutbound({ /* ... */, bridgeUuid });
  deps.mappingStore.upsertMapping({ uid: source.uid, recurrenceId: source.recurrenceId, googleEventId, bridgeUuid, status: 'active', /* ... */ });
```

**Tombstone path — no notify (D-04)** (lines 75-103): `handleDeletedTombstone` only cancels Google; do not call notifier here.

**Apply:** After Google cancel/upsert inside `handleOutboundEvent`, run transition → persist state → notifier → audit. Wrap SMTP in inner try/catch so failures log + audit but do not increment `result.errors` unless planner chooses otherwise (D-08). Persist `bridgeUuid` on drop-before-map via audit store before `return` on drop branch.

---

### `src/config/env.ts` (modify)

**Analog:** `src/config/env.ts`

**ENV_KEYS allowlist (SEC-04)** (lines 4-17):

```typescript
const ENV_KEYS = [
  'MAILBOX_CALDAV_URL',
  'MAILBOX_CALENDAR_URL',
  /* ... */
  'LOG_LEVEL',
] as const;
```

**Secret redaction in errors** (lines 21-25, 90-94):

```typescript
const SECRET_ENV_KEYS = new Set<EnvKey>([
  'MAILBOX_APP_PASSWORD',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
]);
```

**loadConfig + strict parse** (lines 99-128):

```typescript
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env !== process.env) {
    assertNoUnknownEnvKeys(env);
  }
  const picked = pickPilotEnv(env);
  const parsed = envSchema.safeParse(picked);
  if (!parsed.success) {
    throw new Error(formatValidationError(parsed.error));
  }
  /* map to camelCase AppConfig */
}
```

**Apply:** Add `SMTP_*`, `NOTIFY_OWNER_EMAIL`, tag URL key to `ENV_KEYS` and `SECRET_ENV_KEYS` (`SMTP_PASSWORD`). Conditional Zod: require SMTP fields only when notify email is set (D-05). Extend `AppConfig` with camelCase SMTP/notify fields.

---

### `src/index.ts` (modify)

**Analog:** `src/index.ts`

**Pino redact** (lines 19-36):

```typescript
function createLogger(logLevel: string): pino.Logger {
  return pino({
    level: logLevel,
    redact: {
      paths: [
        'MAILBOX_APP_PASSWORD',
        'GOOGLE_REFRESH_TOKEN',
        /* ... */
      ],
      remove: true,
    },
  });
}
```

**Subcommand dispatch** (lines 97-105):

```typescript
  const subcommand = argv[0];
  const watch = argv.includes('--watch');

  if (subcommand !== 'sync') {
    console.log(`er-calendar-bridge v${VERSION}`);
    console.log('Usage: er-calendar-bridge sync [--watch]');
    return subcommand === undefined ? 0 : 1;
  }
```

**Store lifecycle in sync** (lines 39-84):

```typescript
  const mappingStore = openMappingStore(config.sqlitePath);
  const syncStateStore = openSyncStateStore(config.sqlitePath);
  try {
    /* runSyncCycle */
  } finally {
    mappingStore.close();
    syncStateStore.close();
  }
```

**Apply:** Branch `audit` → `list` with `--since`; open `auditStore` on same `config.sqlitePath`; print tabular/text rows (no HTTP). Update usage string. Add `SMTP_PASSWORD` to redact paths.

---

### `.env.example` (modify)

**Analog:** `.env.example` (lines 19-24)

```dotenv
# SMTP (withhold notifications — Phase 4)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@example.org
```

**Apply:** Add commented `NOTIFY_OWNER_EMAIL` and tag guidance URL placeholders alongside SMTP block.

---

### `test/store/audit-store.test.ts` (test)

**Analog:** `test/store/mapping-store.test.ts`

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { openMappingStore } from '../../src/store/mapping-store.js';

function memoryStore() {
  return openMappingStore(':memory:');
}

describe('openMappingStore', () => {
  let store: ReturnType<typeof openMappingStore>;

  afterEach(() => {
    store?.close();
  });
```

**Apply:** Same `:memory:` + `afterEach(close)` pattern; assert PII-free columns and `listSince` filtering.

---

### `test/sync/withhold-transition.test.ts` (test)

**Analog:** `test/domain/classify.test.ts` — pure function + `expect().toEqual()` tables.

---

### `test/notify/withhold-notifier.test.ts` (test)

**Analog:** `test/integration/sync-cycle.test.ts` mock style (lines 65-68):

```typescript
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-team' }),
      cancel: vi.fn().mockResolvedValue(undefined),
    };
```

**Apply:** Inject mock `WithholdNotifier` or nodemailer `jsonTransport`; assert subject/body lack fixture titles.

---

### `test/integration/sync-cycle.test.ts` (extend)

**Analog:** `buildDeps` helper (lines 21-37) and drop test (lines 169-208):

```typescript
function buildDeps(overrides: {
  caldav: CalDavReader;
  writer: CalendarWriter;
  now?: () => Date;
}): { deps: SyncCycleDeps; mappingStore: /* ... */ } {
  const mappingStore = openMappingStore(':memory:');
  const syncStateStore = openSyncStateStore(':memory:');
  const deps: SyncCycleDeps = { caldav: overrides.caldav, writer: overrides.writer, mappingStore, syncStateStore, calendarUrl: CALENDAR_URL, log: silentLogger, now: overrides.now };
  return { deps, mappingStore, syncStateStore };
}
```

**Apply:** Extend `buildDeps` with `vi.fn()` withhold notifier; assert not called on tombstone delete test (`deleted delta`); assert called on busy/drop transition; extend drop test for first-sight drop without mapping.

---

### `test/config/env.test.ts` (extend)

**Analog:** `minimalEnv` + SEC-04 test (lines 4-26, 60-64):

```typescript
  it('rejects unknown env keys (SEC-04 strict schema)', () => {
    expect(() =>
      loadConfig(minimalEnv({ UNKNOWN_PILOT_KEY: 'nope' })),
    ).toThrow(/UNKNOWN_PILOT_KEY/i);
  });
```

**Apply:** Add SMTP keys to `minimalEnv` when testing notify-enabled path; assert optional notify email without SMTP does not throw.

---

## Shared Patterns

### SQLite store module layout
**Source:** `src/store/mapping-store.ts`, `src/store/sync-state-store.ts`  
**Apply to:** `audit-store.ts`  
Same file layout: types → `openXStore(path)` → `loadSchema` from co-located `schema.sql` → prepared statements → `close()`.

### Recurrence identity key
**Source:** `src/store/mapping-store.ts` lines 61-68, 1-5 file header  
**Apply to:** All audit/state rows keyed by `(source_uid, recurrence_id)` with `''` for masters.

### Injectable outbound adapters
**Source:** `src/sync/types.ts` (`CalendarWriter`), `test/integration/sync-cycle.test.ts` (`vi.fn()` writers)  
**Apply to:** `WithholdNotifier` in sync deps and integration tests.

### Per-event failure isolation
**Source:** `src/sync/run-sync-cycle.ts` lines 127-136, 140-161  
**Apply to:** Google errors stay in outer try/catch; SMTP failures handled without aborting cycle (D-08).

### Strict environment configuration
**Source:** `src/config/env.ts` + `test/config/env.test.ts`  
**Apply to:** Every new env key must land in `ENV_KEYS` simultaneously with `.env.example` and tests.

### PII minimization
**Source:** `src/domain/process-source-event.ts` pipeline, Phase 2 washing  
**Apply to:** Audit rows and email bodies — store tier/propagation/uid only (D-16, D-09); never persist `summary`.

### Logger secret redaction
**Source:** `src/index.ts` lines 19-36  
**Apply to:** Extend `redact.paths` with `SMTP_PASSWORD` and camelCase config fields.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `package.json` (nodemailer dep) | config | — | New dependency; follow existing `better-sqlite3` / `pino` pin style in `package.json` — planner should read current file at execute |

## Metadata

**Analog search scope:** `src/store/`, `src/sync/`, `src/config/`, `src/index.ts`, `src/writers/google/`, `src/domain/`, `test/store/`, `test/integration/`, `test/config/`, `test/domain/`, `.env.example`
**Files scanned:** ~25 TypeScript/SQL sources + phase docs
**Pattern extraction date:** 2026-09-16
