# Phase 5: Docker packaging and local pilot deployment - Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 18
**Analogs found:** 12 / 18

> Phase 5 adds deployment artifacts (Dockerfile, Compose, GHCR CI) and a thin `src/secrets/` layer before existing `loadConfig()`. Six deliverables are greenfield (no in-repo Docker/Compose yet). Application wiring extends established Phase 3–4 patterns (`env.ts`, `index.ts`, vitest fixtures).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `Dockerfile` | config | batch (image build) | — | **none** (establish from RESEARCH + `package.json` build) |
| `.dockerignore` | config | batch | — | **none** (establish from RESEARCH) |
| `compose.yaml` | config | event-driven (orchestration) | — | **none** (establish from RESEARCH) |
| `.env.example` | config | — | `.env.example` | exact |
| `.gitignore` | config | — | `.gitignore` | exact |
| `src/secrets/types.ts` | utility | — | `src/notify/types.ts` | role-match |
| `src/secrets/file-provider.ts` | service | file-I/O | `src/store/mapping-store.ts` | role-match |
| `src/secrets/resolve-env.ts` | utility | transform | `src/config/env.ts` | exact |
| `src/config/env.ts` | config | transform | `src/config/env.ts` | exact (minimal or no change) |
| `src/index.ts` | route/CLI | request-response | `src/index.ts` | exact |
| `.github/workflows/ci.yml` | config | event-driven | `.github/workflows/ci.yml` | exact |
| `package.json` | config | batch | `package.json` | exact |
| `test/secrets/file-provider.test.ts` | test | file-I/O | `test/cli/audit-list.test.ts` | role-match |
| `test/config/env.test.ts` | test | transform | `test/config/env.test.ts` | exact |
| `docs/runbooks/offboarding.md` | docs | — | `README.md` | partial |
| `docs/runbooks/docker-pilot.md` | docs | — | `README.md` | partial |
| `README.md` | docs | — | `README.md` | exact |
| `secrets/operator/*`, `data/operator/` | config (host dirs) | file-I/O | `.gitignore` + `.env.example` | partial |

## Pattern Assignments

### `Dockerfile` (config, batch)

**Analog:** None in-repo — greenfield (no `Dockerfile` in workspace).

**Build contract** — mirror CI and local gate (`package.json` lines 9–15, 6–8):

```9:15:package.json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json",
    "build": "tsc -p tsconfig.json",
```

```6:8:package.json
  "engines": {
    "node": "24.x"
  },
```

**Emit layout** — `tsc` writes `dist/` from `src/` only (`tsconfig.json` lines 7–8, 18):

```7:8:tsconfig.json
    "outDir": "dist",
    "rootDir": "src",
```

**Runtime entry** — container CMD must match host CLI (`src/index.ts` lines 23–27, 231–235):

```23:27:src/index.ts
export function printUsage(): void {
  console.log(`er-calendar-bridge v${VERSION}`);
  console.log('Usage:');
  console.log('  er-calendar-bridge sync [--watch]');
```

```231:235:src/index.ts
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  void main().then((code) => {
    process.exitCode = code;
  });
```

**Constraints:** Multi-stage `node:24-alpine`; compile `better-sqlite3` in build stage; `USER node`; default `CMD` → `sync --watch`; no `ARG`/`ENV` for secrets (RESEARCH Pattern 2).

---

### `.dockerignore` (config, batch)

**Analog:** None — establish per RESEARCH (exclude `.git`, `test/`, `.planning/`, `secrets/`, `data/`, `.env`).

**Parallel:** eslint ignores mirror “do not ship dev artifacts” (`eslint.config.mjs`):

```5:7:eslint.config.mjs
export default defineConfig(
  { ignores: ['dist/', 'node_modules/', '.vitest/'] },
```

---

### `compose.yaml` (config, event-driven)

**Analog:** None — greenfield Compose file.

**Env vars already documented** — align service `env_file` / `environment` with `.env.example` (lines 30–36):

```30:36:.env.example
# Runtime
LOG_LEVEL=info
# Sync poll interval (seconds); default 300 (~5 minutes)
SYNC_INTERVAL_SECONDS=300
# SQLite mapping store (optional — default ./data/bridge.db)
# SQLITE_PATH=./data/bridge.db
# DATA_DIR=./data
```

**Persistence path** — `loadConfig()` resolves DB under `DATA_DIR` (`src/config/env.ts` lines 161–163):

```161:163:src/config/env.ts
  const sqlitePath =
    data.SQLITE_PATH ??
    (data.DATA_DIR ? join(data.DATA_DIR, 'bridge.db') : './data/bridge.db');
```

**Constraints:** `image: ${IMAGE}`; `restart: unless-stopped`; no `ports:`; Compose `secrets:` → `/run/secrets/<name>` (RESEARCH Pattern 1).

---

### `.env.example` (modify)

**Analog:** `.env.example`

**Section + comment style** (lines 1–12, 30–33):

```1:12:.env.example
# mailbox.org CalDAV (read-only — enforced in Phase 3; never write to source)
MAILBOX_CALDAV_URL=https://dav.mailbox.org
# Per-calendar collection URL from mailbox.org calendar properties (not server root only)
MAILBOX_CALENDAR_URL=https://dav.mailbox.org/caldav/your-calendar-id/
MAILBOX_USERNAME=operator@example.org
MAILBOX_APP_PASSWORD=your-app-password-here

# Google Calendar API (OAuth — calendar scope only)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
```

**Phase 5 change:** Document `IMAGE=ghcr.io/europeanresolve/er-calendar-bridge:1.0.0`, Docker `DATA_DIR=/data`, and that pilot **secrets move to `secrets/<member>/` files** (credentials removed from committed example or marked “host file only”).

---

### `.gitignore` (modify)

**Analog:** `.gitignore`

**Current entries** (lines 1–4):

```1:4:.gitignore
node_modules/
dist/
.env
.vitest/
```

**Extend:** `secrets/`, `data/` (RESEARCH Pitfall 4 — SEC-02).

---

### `src/secrets/types.ts` (utility)

**Analog:** `src/notify/types.ts`

**Interface-only port** (lines 4–16):

```4:16:src/notify/types.ts
export type WithholdNotifyParams = Readonly<{
  tier: Tier;
  propagation: WithholdPropagation;
  dedupKey: string;
}>;

export type WithholdNotifyResult = Readonly<{
  status: 'sent' | 'failed';
}>;

export interface WithholdNotifier {
  notifyWithhold(params: WithholdNotifyParams): Promise<WithholdNotifyResult>;
}
```

**Apply:** `SecretProvider` with `get(name: string): string | undefined` — swappable for future Vault provider (D-03).

---

### `src/secrets/file-provider.ts` (service, file-I/O)

**Analog:** `src/store/mapping-store.ts` (sync `readFileSync`, fail-soft optional reads)

**Imports** (lines 7–8):

```7:8:src/store/mapping-store.ts
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
```

**Read file UTF-8** (lines 55–58 in mapping-store — same `readFileSync` idiom):

```55:58:src/store/mapping-store.ts
function loadSchema(db: Database.Database): void {
  const ddl = readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(ddl);
}
```

**Apply:** `readFileSync(join(mountDir, name), 'utf8').trim()` with try/catch → `undefined` for missing secrets (RESEARCH Pattern 4). Default `mountDir = '/run/secrets'`.

**Optional host dev analog** — spike reads `.env` with guarded `readFileSync` (`scripts/spike-mailbox-sync.mts` lines 17–39):

```17:39:scripts/spike-mailbox-sync.mts
function loadOptionalDotEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  try {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // ...
    }
  } catch {
    // .env optional when vars are exported in the shell
  }
```

Use **env override wins over file** in `resolve-env.ts`, not full `.env` parsing in secrets module.

---

### `src/secrets/resolve-env.ts` (utility, transform)

**Analog:** `src/config/env.ts`

**Pick known keys only** (lines 105–114):

```105:114:src/config/env.ts
function pickPilotEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const picked: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    const value = env[key];
    if (value !== undefined) {
      picked[key] = value;
    }
  }
  return picked;
}
```

**Public API** (lines 148–158):

```148:158:src/config/env.ts
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // SEC-04: reject typos in explicit env fixtures/tests; real process.env carries OS keys.
  if (env !== process.env) {
    assertNoUnknownEnvKeys(env);
  }
  const picked = pickPilotEnv(env);
  const parsed = envSchema.safeParse(picked);
```

**Apply:** `resolvePilotEnv(baseEnv)` clones env, maps Compose secret filenames → `MAILBOX_APP_PASSWORD`, `GOOGLE_*`, `SMTP_PASSWORD` only when env not already set; return merged `NodeJS.ProcessEnv` for `loadConfig()`.

**Secret redaction in errors** — reuse `SECRET_ENV_KEYS` behavior via existing `formatValidationError` (lines 139–141):

```139:141:src/config/env.ts
    if (SECRET_ENV_KEYS.has(field as EnvKey)) {
      lines.push(`${field}: Invalid value`);
    } else {
```

---

### `src/config/env.ts` (modify, minimal)

**Analog:** `src/config/env.ts` (keep Zod schema and `loadConfig` signature).

**Do not** add secret file paths to `ENV_KEYS` unless required for SEC-04 — file injection happens in `resolve-env.ts` before `loadConfig`.

**DATA_DIR / sync interval** already container-ready (lines 45–46, 175–176):

```45:46:src/config/env.ts
  DATA_DIR: z.string().min(1).optional(),
  SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().optional(),
```

```175:176:src/config/env.ts
    syncIntervalSeconds: data.SYNC_INTERVAL_SECONDS ?? 300,
    logLevel: data.LOG_LEVEL ?? 'info',
```

---

### `src/index.ts` (modify)

**Analog:** `src/index.ts`

**Injectable env for tests** (lines 169–180):

```169:180:src/index.ts
export async function main(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  let config;
  try {
    config = loadConfig(env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }
```

**Apply:** `const resolved = resolvePilotEnv(env); config = loadConfig(resolved);` — tests keep passing explicit `minimalEnv()` without secret files.

**Watch mode interval** (lines 215–218) — Compose sets `SYNC_INTERVAL_SECONDS` only:

```215:218:src/index.ts
  const intervalMs = config.syncIntervalSeconds * 1000;
  log.info(
    { syncIntervalSeconds: config.syncIntervalSeconds },
    'watch mode: running sync on interval',
```

**Structured JSON logs** (lines 91–110):

```91:110:src/index.ts
function createLogger(logLevel: string): pino.Logger {
  return pino({
    level: logLevel,
    redact: {
      paths: [
        'MAILBOX_APP_PASSWORD',
        'GOOGLE_REFRESH_TOKEN',
        'GOOGLE_CLIENT_SECRET',
        'mailboxAppPassword',
        'googleRefreshToken',
        'googleClientSecret',
        'SMTP_PASSWORD',
        'smtpPassword',
        'password',
        'refresh_token',
        'client_secret',
      ],
      remove: true,
    },
  });
}
```

**Google auth** still consumes `AppConfig` only (`src/writers/google/auth.ts` lines 13–21) — no changes required if secrets resolve into config:

```13:21:src/writers/google/auth.ts
export function createGoogleAuthClient(
  config: GoogleAuthConfig,
): OAuth2Client {
  const client = new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
  );
  client.setCredentials({ refresh_token: config.googleRefreshToken });
  return client;
}
```

---

### `.github/workflows/ci.yml` (modify)

**Analog:** `.github/workflows/ci.yml` + Phase 01.1 extension contract

**Existing four-job bootstrap** (lines 1–55) — append fifth job without restructuring:

```1:22:.github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
```

**Phase 01.1 D-08** (`.planning/phases/01.1-ci-pipeline/01.1-PATTERNS.md`): parallel jobs; Phase 5 adds `docker-build` alongside.

**New job pattern:** `needs: [test, lint, typecheck, build]`; job-level `permissions.packages: write`; `docker/build-push-action` with `push` only on `main` push; no provider secrets in workflow (TEST-05). Full YAML in `05-RESEARCH.md` Pattern 3.

---

### `package.json` (modify — version)

**Analog:** `package.json`

**Version source for GHCR tags** (lines 1–4):

```1:4:package.json
{
  "name": "er-calendar-bridge",
  "version": "0.0.0",
  "private": true,
```

Bump to `1.0.0` at milestone; align `src/index.ts` `VERSION` constant (line 14) if kept in sync manually.

---

### `test/secrets/file-provider.test.ts` (test, file-I/O)

**Analog:** `test/cli/audit-list.test.ts` (temp dir lifecycle)

**mkdtemp + cleanup** (lines 1–3, 41–58):

```1:3:test/cli/audit-list.test.ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
```

```41:58:test/cli/audit-list.test.ts
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'er-bridge-audit-cli-'));
    sqlitePath = join(tempDir, 'bridge.db');
    // ...
  });

  afterEach(async () => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
```

**Apply:** Write secret files under `tempDir` mimicking `/run/secrets/google_refresh_token`; assert `createComposeFileSecretProvider(tempDir).get(...)` trims newlines and maps to `resolvePilotEnv`.

**Unit test style** — small focused describe blocks (`test/writers/google-auth.test.ts` lines 1–21):

```1:21:test/writers/google-auth.test.ts
import { describe, it, expect } from 'vitest';
import {
  GOOGLE_CALENDAR_SCOPE,
  createGoogleAuthClient,
} from '../../src/writers/google/auth.js';

describe('Google auth (SEC-03)', () => {
  it('exports calendar-only OAuth scope constant', () => {
```

---

### `test/config/env.test.ts` (extend)

**Analog:** `test/config/env.test.ts`

**`minimalEnv` factory** (lines 5–27):

```5:27:test/config/env.test.ts
function minimalEnv(
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  const base: Record<string, string> = {
    MAILBOX_CALDAV_URL: 'https://dav.mailbox.org',
    MAILBOX_CALENDAR_URL: 'https://dav.mailbox.org/caldav/pilot/',
    MAILBOX_USERNAME: 'operator@example.org',
    MAILBOX_APP_PASSWORD: 'app-password-secret',
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REFRESH_TOKEN: 'refresh-token-secret',
    GOOGLE_CALENDAR_ID: 'primary@group.calendar.google.com',
  };

  const merged = { ...base, ...overrides };
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}
```

**Secret redaction tests** (lines 170–179):

```170:179:test/config/env.test.ts
  it('does not echo secrets in error messages', () => {
    try {
      loadConfig(minimalEnv({ MAILBOX_CALENDAR_URL: undefined }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain('app-password-secret');
      expect(message).not.toContain('refresh-token-secret');
      return;
    }
    expect.fail('expected loadConfig to throw');
  });
```

**Extend:** Tests for `resolvePilotEnv` — env wins over file; file fills missing secret keys; no secret values in thrown messages.

---

### `docs/runbooks/offboarding.md` & `docs/runbooks/docker-pilot.md` (docs)

**Analog:** `README.md`

**Deployment framing** (lines 32–42):

```32:42:README.md
## Deployment

Docker image, orchestrated with Docker Compose — one container per synced member, each with only that member's secrets.

| Phase | Host | Scope |
|-------|------|-------|
| Pilot (v1.0) | Operator laptop (encrypted) | Operator's calendar → Google only |
```

**Operator env list** (lines 58–66) — migrate into docker-pilot runbook; add Compose secrets layout and `IMAGE` pull.

**CI / local gate** (lines 48–54) — reference fifth job after Phase 5:

```48:54:README.md
GitHub Actions runs on every push to `main` with four parallel jobs: test, lint, typecheck, and build.

Before pushing, run the local gate:

```bash
npm test && npm run lint && npm run typecheck && npm run build
```

Update job count and add `docker compose` / migration / offboarding sections (SYNC-18 runbook only).

---

### `README.md` (modify)

**Analog:** `README.md` (same file — extend Deployment + Development sections; link runbooks).

---

## Shared Patterns

### Port interface + factory (secrets and notify)

**Source:** `src/notify/types.ts`, `src/sync/types.ts`  
**Apply to:** `src/secrets/types.ts`, `file-provider.ts`, future Vault provider

```14:16:src/sync/types.ts
export interface CalDavReader {
  poll(): Promise<SyncDelta>;
}
```

```14:16:src/notify/types.ts
export interface WithholdNotifier {
  notifyWithhold(params: WithholdNotifyParams): Promise<WithholdNotifyResult>;
}
```

### Config fail-closed + SEC-04 strict fixtures

**Source:** `src/config/env.ts`  
**Apply to:** `resolve-env.ts`, all tests passing synthetic `ProcessEnv`

```116:124:src/config/env.ts
function assertNoUnknownEnvKeys(env: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(env)) {
    if (env[key] === undefined) {
      continue;
    }
    if (!(ENV_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Invalid environment configuration: Unrecognized key: "${key}"`);
    }
  }
}
```

### CLI test injection

**Source:** `src/index.ts` + `test/cli/audit-list.test.ts`  
**Apply to:** Optional smoke test `main([], minimalEnv())` after secrets wiring

```169:172:src/index.ts
export async function main(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
```

### Vitest layout

**Source:** `vitest.config.ts`

```3:8:vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
  },
});
```

New tests under `test/secrets/*.test.ts` are picked up automatically.

### CI sibling jobs (no restructure)

**Source:** `.github/workflows/ci.yml`, Phase 01.1 D-08  
**Apply to:** `docker-build` only — same `checkout@v7`, Node 24 jobs unchanged.

### Logging / D-15

**Source:** `src/index.ts` `createLogger` — default pino → stdout JSON; no `pino-pretty` in production image.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `Dockerfile` | config | batch | First container image in repo — follow `05-RESEARCH.md` Pattern 2 |
| `.dockerignore` | config | batch | No prior Docker context |
| `compose.yaml` | config | event-driven | No Compose file in repo |
| `secrets/operator/*` (host files) | config | file-I/O | Gitignored operator-created files; document filenames only |

## Metadata

**Analog search scope:** `src/`, `test/`, `.github/workflows/`, `.env.example`, `.gitignore`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `scripts/spike-mailbox-sync.mts`, `.planning/phases/01.1-ci-pipeline/01.1-PATTERNS.md`, `.planning/research/ARCHITECTURE.md`
**Files scanned:** ~35
**Pattern extraction date:** 2026-09-16
