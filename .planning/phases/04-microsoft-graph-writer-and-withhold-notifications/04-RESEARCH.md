# Phase 4: Withhold notifications and audit log - Research

**Researched:** 2026-09-16
**Domain:** SMTP owner notifications, SQLite withhold audit/dedup, sync-loop integration (Google pilot)
**Confidence:** HIGH (in-repo integration + locked CONTEXT); MEDIUM (nodemailer version pin — registry not queried this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Notify triggers (SYNC-14)
- **D-01:** Send owner notification for **both** `busy` and `drop` propagation outcomes (not drop-only).
- **D-02:** Notify **on change only** — when propagation (or effective withhold state) **differs from last recorded state** for that event instance; suppress repeated sends across poll cycles while state is unchanged.
- **D-03:** If an event returns to **full** disclosure (e.g. owner adds `ER-PUBLIC`) and later downgrades again, treat as a **new episode** and notify again.
- **D-04:** **Do not** send withhold notifications for normal **source deletions** (CalDAV tombstones); Google cancel behavior from Phase 3 is sufficient.

#### Owner recipient & SMTP gating
- **D-05:** Owner SMTP recipient is an **optional configured member email** (dedicated env var — exact name at planner discretion). If **unset**, **skip all owner notifications** (sync and audit may still record withhold events per D-16).
- **D-06:** **Do not** extend iCal parsing for `ORGANIZER` in Phase 4 — config email only (pilot syncs operator’s own calendar).
- **D-07:** **No IT BCC/copy** on owner mail — IT visibility via **audit log only** (SYNC-16).
- **D-08:** On SMTP misconfiguration or send failure: **log error**, record audit row with failed/skipped notify status, **continue sync cycle** (align with Phase 3 D-18).

#### Email content
- **D-09:** **Minimal body** — no original title, location, description, or attendees in email (avoid SMTP as a PII leak channel).
- **D-10:** **English only** for pilot copy.
- **D-11:** **Fixed subject line** (single static subject for filtering; specifics in body).
- **D-12:** Body includes **tag guidance** — explain `ER-PUBLIC` / `ER-INTERNAL` / `ER-SENSITIVE` and link to internal documentation via **configurable static URL** (planner picks env key).

#### De-duplication & audit (SYNC-15, SYNC-16, OPS-03)
- **D-13:** Stable notification de-dup key: **`bridgeUuid` + `propagation` + `episode`** (episode increments when event returns to full then downgrades again — supports D-03).
- **D-14:** For unchanged withhold state, suppression is **indefinite** (no time-based re-send); on-change semantics from D-02 handle poll noise.
- **D-15:** Operator inspects audit via **CLI subcommand** (e.g. `audit list` with optional `--since`) — no HTTP health/UI server in this phase.
- **D-16:** Audit row fields: **timestamp**, **uid**, **recurrenceId** (if any), **tier**, **propagation**, **notify_status** (`sent` / `skipped` / `failed` / `disabled` when no recipient), **dedup_key**, optional **error**; **no event title/summary** at rest.

### Claude's Discretion
- Exact env names for optional notify email, tag-guidance URL, and wiring into existing Zod `loadConfig`.
- SQLite schema/table name for audit + notification state (ARCHITECTURE.md suggests dedup in store); whether audit and dedup share one table or two.
- **Stable `bridgeUuid` for `drop` on first sight** before an active Google mapping exists — must exist for D-13 (planner: assign/persist uuid at first classification touch, not only on successful Google upsert).
- CLI surface naming (`audit list` vs nested `sync audit`) and mocked integration test strategy (nodemailer transport mock, no live SMTP in CI).
- Episode counter persistence (column vs derived from audit history).

### Deferred Ideas (OUT OF SCOPE)
- **iCal ORGANIZER-based recipient** — deferred; config email sufficient for pilot (D-06).
- **IT BCC on every owner mail** — deferred in favor of audit CLI (D-07).
- **Dutch/bilingual email templates** — deferred post-pilot (D-10).
- **Microsoft Graph writer** — Phase 6 / v1.1; not in this phase despite legacy phase directory slug.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-14 | Notify event owners when content is withheld or downgraded | Hook after `processSourceEvent` for `busy`/`drop`; optional `NOTIFY_*` email; nodemailer SMTP; minimal English template (D-09–D-12) |
| SYNC-15 | De-duplicate withhold notifications (stable key + suppression) | Dedup key `bridgeUuid:propagation:episode` (D-13); persist last propagation + episode; indefinite suppression while unchanged (D-14) — **not** a time window (overrides REQUIREMENTS wording) |
| SYNC-16 | IT/operator access to audit record of withholding events | Append-only SQLite audit table (D-16); CLI `audit list [--since]` (D-15); no BCC (D-07) |
| OPS-03 | Operator can see sync status, last success, and withheld events | Phase 3: cycle counts + `sync_state.last_success_at`; Phase 4 extends with queryable per-event withhold audit (03-VERIFICATION partial OPS-03) |
</phase_requirements>

## Summary

Phase 4 adds two capabilities on top of the existing Google sync loop: **owner SMTP nudges** when classification yields `busy` or `drop`, and a **durable, PII-minimal audit trail** for operators. Neither feature belongs in CalDAV parsing or the Google writer — they sit in a new `notify/` module and an extended SQLite layer, invoked from `handleOutboundEvent` in `run-sync-cycle.ts` after classification and target-side effects, but **not** from `handleDeletedTombstone` (D-04).

The hardest design problem is **state**: Phase 3 persists `bridge_uuid` only on successful mapping upserts, while D-13 requires a stable `bridgeUuid` even for **first-sight `drop`** with no active Google row. Research recommends a dedicated **`withhold_notify_state`** table (uid + recurrence_id → bridge_uuid, last_propagation, episode) separate from append-only **`withhold_audit`**, matching ARCHITECTURE.md’s “notification dedup in store” without overloading `event_mappings` (whose `google_event_id` is NOT NULL).

Config must extend `src/config/env.ts`’s strict `ENV_KEYS` allowlist — today unknown keys throw in tests (SEC-04). SMTP placeholders already exist in `.env.example`; nodemailer is listed in STACK.md but **not yet** in `package.json`.

**Primary recommendation:** Implement a pure `computeWithholdTransition()` (episode + dedup_key + shouldNotify), persist state in SQLite, call injectable `WithholdNotifier` from `handleOutboundEvent` after Google cancel/upsert for that event, append audit on transitions only, and expose `audit list` from `src/index.ts` with vitest coverage via mocked transport — no live SMTP in CI (TEST-05).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Classify busy/drop/full | Domain (`processSourceEvent`) | — | Already implemented Phase 2 |
| Google cancel/upsert for withhold | Sync loop + `CalendarWriter` | — | Phase 3 owns target propagation |
| Detect propagation change + episode | API / store (SQLite) | Sync loop orchestration | Durable dedup must survive restarts |
| SMTP owner notification | `notify/` module | Config (Zod env) | Outbound email is infrastructure concern |
| Withhold audit persistence | `store/` (SQLite) | CLI read path | Same DB file as mappings (`schema.sql`) |
| Operator audit inspect | CLI (`src/index.ts`) | — | D-15: no HTTP server |
| IT visibility | CLI audit query | — | D-7: no mail BCC |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nodemailer | latest (10.x line) [ASSUMED] | SMTP send | Project STACK.md + ARCHITECTURE.md; official Node mail transport [CITED: github.com/nodemailer/nodemailer README] |
| better-sqlite3 | ^13.0.3 (installed) | Audit + notify state | Same pattern as `mapping-store.ts` / `sync-state-store.ts` |
| zod | ^4.6.5 (installed) | SMTP + notify env validation | Existing `loadConfig` strict schema |
| vitest | ^5.0.0 (installed) | Unit + integration tests | Existing `test/integration/sync-cycle.test.ts` pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^10.3.1 (installed) | Error log on SMTP failure | D-08; extend redact paths for SMTP secrets |
| @types/nodemailer | — | **Do not install** | Nodemailer 10+ ships types [CITED: github.com/nodemailer/nodemailer README] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nodemailer | `smtp-connection` / raw TLS | More edge cases; nodemailer is project standard |
| Separate audit DB file | Tables in `bridge.db` | Extra ops burden; ARCHITECTURE expects one SQLite per container |
| Mail on every poll while busy | On-change only (locked) | Violates D-02/D-14 |

**Installation:**

```bash
npm install nodemailer
```

**Version verification:** Planner/executor should run `npm view nodemailer version` before pinning; this research session did not query the registry (Auto-review blocked external npm calls).

## Package Legitimacy Audit

> slopcheck was **not** available in this research session (install blocked). All packages below are `[ASSUMED]` for planner gating per protocol.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| nodemailer | npm | mature | high | github.com/nodemailer/nodemailer | not run | Approved with `[ASSUMED]` — verify at execute |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck not run)

**Packages flagged as suspicious [SUS]:** none

*Planner must add `checkpoint:human-verify` before first `npm install nodemailer` unless executor re-runs slopcheck.*

## Architecture Patterns

### System Architecture Diagram

```
CalDAV delta
    │
    ▼
parseIcsToSourceEvents ──► processSourceEvent (tier, propagation)
    │
    ▼
handleOutboundEvent ─────────────────────────────────────┐
    │                                                     │
    ├─ propagation === 'full' ──► update last_propagation│
    │                              = full (no mail)       │
    │                                                     │
    ├─ propagation ∈ {busy, drop}                         │
    │       │                                             │
    │       ├─ compare last_propagation (withhold state)  │
    │       │     unchanged busy/drop? ──► skip (D-02/14) │
    │       │                                             │
    │       ├─ episode++ if last was 'full' (D-03)        │
    │       ├─ resolve bridgeUuid (mapping OR state OR new)│
    │       │                                             │
    │       ├─ Google writer cancel / upsert (Phase 3)    │
    │       │                                             │
    │       ├─ build dedup_key (D-13)                     │
    │       ├─ WithholdNotifier ──► SMTP (optional D-05)  │
    │       └─ append withhold_audit row (D-16) ◄─────────┘
    │
handleDeletedTombstone ──► cancel Google only (NO notify, D-04)

CLI: audit list [--since] ──► SELECT withhold_audit
```

### Recommended Project Structure

```
src/
├── notify/
│   ├── withhold-notifier.ts    # SMTP send + template (minimal body)
│   └── types.ts                # Notifier interface for tests
├── store/
│   ├── audit-store.ts          # openAuditStore / withhold state + audit append
│   └── schema.sql              # + withhold_notify_state, withhold_audit tables
├── sync/
│   ├── run-sync-cycle.ts       # wire notifier after Google ops per event
│   └── withhold-transition.ts  # pure episode/dedup/shouldNotify (recommended)
├── config/
│   └── env.ts                  # SMTP + NOTIFY_* + TAG_* keys in ENV_KEYS
└── index.ts                    # audit list subcommand
```

### Pattern 1: Withhold transition (pure function)

**What:** Centralize D-02/D-03/D-13 in testable logic.

**When to use:** Before any SMTP or audit I/O.

**Example:**

```typescript
// Recommended shape — implement in src/sync/withhold-transition.ts
export type WithholdPropagation = 'full' | 'busy' | 'drop';

export function computeWithholdTransition(params: {
  previousPropagation: WithholdPropagation | undefined;
  currentPropagation: WithholdPropagation;
  episode: number;
  bridgeUuid: string;
}): {
  shouldRecord: boolean;
  shouldAttemptNotify: boolean;
  nextEpisode: number;
  nextPropagation: WithholdPropagation;
  dedupKey: string | null;
} {
  const { previousPropagation, currentPropagation, episode, bridgeUuid } = params;

  if (currentPropagation === 'full') {
    return {
      shouldRecord: false,
      shouldAttemptNotify: false,
      nextEpisode: episode,
      nextPropagation: 'full',
      dedupKey: null,
    };
  }

  // busy | drop
  if (previousPropagation === currentPropagation) {
    return {
      shouldRecord: false,
      shouldAttemptNotify: false,
      nextEpisode: episode,
      nextPropagation: currentPropagation,
      dedupKey: null,
    };
  }

  let nextEpisode = episode;
  if (previousPropagation === 'full') {
    nextEpisode = episode + 1;
  } else if (previousPropagation === undefined) {
    nextEpisode = 1;
  }

  const dedupKey = `${bridgeUuid}:${currentPropagation}:${nextEpisode}`;
  return {
    shouldRecord: true,
    shouldAttemptNotify: true,
    nextEpisode,
    nextPropagation: currentPropagation,
    dedupKey,
  };
}
```

**Note:** Tier changes with same propagation (e.g. `untagged`→`internal`, both `busy`) must **not** notify — matches D-02 “propagation differs” and existing classify rules [VERIFIED: codebase `classify-source-event.ts` + integration test D-10 tier public→busy].

### Pattern 2: Injectable notifier (CI-safe)

**What:** `WithholdNotifier` interface; production uses nodemailer; tests use mock or `jsonTransport`.

**When to use:** All SMTP I/O; keeps TEST-05 compliance.

**Example:**

```typescript
// Source: nodemailer README — createTransport + sendMail pattern [CITED: github.com/nodemailer/nodemailer]
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpPort === 465,
  auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
});

await transporter.sendMail({
  from: config.smtpFrom,
  to: config.notifyOwnerEmail,
  subject: 'Calendar bridge: event disclosure limited', // D-11 static
  text: buildMinimalBody({ tier, propagation, tagDocUrl: config.tagGuidanceUrl }),
});
```

**Node runtime:** Project uses Node 24.x; nodemailer targets Node 20+ [CITED: github.com/nodemailer/nodemailer README].

### Pattern 3: SQLite schema split (state vs audit)

**What:** Two tables in shared `schema.sql`:

1. **`withhold_notify_state`** — one row per `(source_uid, recurrence_id)`: `bridge_uuid`, `last_propagation`, `episode`, `updated_at`
2. **`withhold_audit`** — append-only log for CLI; index on `recorded_at`, optional unique on `dedup_key` if enforcing at DB level

**When to use:** Always — do not store dedup only in memory; do not require `google_event_id` for drop-first-sight uuid (D-13 discretion).

### Pattern 4: Sync loop integration point

**What:** Extend `SyncCycleDeps` with `withholdNotifier`, `auditStore`, and notify-related config snapshot.

**When to use:** After existing Google `cancel`/`upsert` for the event inside `handleOutboundEvent`, inside the same per-event try/catch so Google failures follow Phase 3 D-18; SMTP failures caught separately (D-08).

**Current gap [VERIFIED: codebase]:** `handleOutboundEvent` early-returns on `drop` without persisting `bridgeUuid` when no active mapping — must call withhold state upsert before return.

### Anti-Patterns to Avoid

- **Notify from `handleDeletedTombstone`:** Violates D-04; deletion ≠ classification withhold.
- **Dedup by uid alone:** Collides across episode boundaries (D-03) and busy vs drop (D-13).
- **Store SUMMARY in audit/email:** Violates D-09/D-16; same minimization as washing.
- **Fail sync cycle on SMTP error:** Violates D-08 and Phase 3 D-18.
- **Adding env vars without updating `ENV_KEYS`:** Breaks SEC-04 strict config tests [VERIFIED: `test/config/env.test.ts`].
- **Require SMTP when notify email unset:** D-05 allows audit without mail — use `notify_status: disabled`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMTP session / TLS / AUTH | Raw socket mail | nodemailer | STARTTLS, port 465 vs 587, timeouts [CITED: nodemailer README FAQ] |
| Email address parsing | Custom regex | Fixed config recipient (D-06) | Pilot single owner |
| Dedup TTL / sliding window | Timer-based resend | On-change + episode (locked D-14) | REQUIREMENTS “suppression window” superseded by CONTEXT |
| Audit query API | HTTP server | CLI + SQLite | D-15, OPS-04 minimal tooling |
| UUID stability | Re-randomize each poll | Persist `bridge_uuid` in mapping OR withhold state | D-13 |

**Key insight:** Withhold notify is an **operational nudge**, not a second disclosure channel — minimal content and audit without titles is intentional security design.

## Common Pitfalls

### Pitfall 1: Drop-first-sight without bridgeUuid

**What goes wrong:** Dedup key cannot be formed; duplicate mails after mapping appears.

**Why it happens:** `run-sync-cycle.ts` returns on `drop` before `randomUUID()` path used for upserts.

**How to avoid:** Persist `bridge_uuid` in `withhold_notify_state` on first `busy`/`drop` touch regardless of Google mapping.

**Warning signs:** Tests only cover drop-with-existing-mapping (`sync-cycle.test.ts` SYNC-05).

### Pitfall 2: Notifying on tier-only changes

**What goes wrong:** Spurious mail when categories change but propagation stays `busy`.

**Why it happens:** Confusing tier with propagation.

**How to avoid:** Compare `last_propagation` only; tier goes in audit for operator context.

### Pitfall 3: Episode not reset/increment on full return

**What goes wrong:** Second downgrade suppressed — violates D-03.

**Why it happens:** Episode not incremented when `previousPropagation === 'full'`.

**How to avoid:** Unit tests: full→busy→full→busy yields two notifies with different dedup keys.

### Pitfall 4: SMTP `secure: true` on port 587

**What goes wrong:** TLS handshake failures against typical SUBMISSION servers.

**Why it happens:** Misreading nodemailer `secure` flag.

**How to avoid:** `secure: true` only for 465; 587 uses STARTTLS with `secure: false` [CITED: nodemailer README TLS FAQ].

### Pitfall 5: Audit row on every poll

**What goes wrong:** SQLite bloat; false sense of “new” withhold events.

**Why it happens:** Logging notify attempts without transition check.

**How to avoid:** Append audit only when `computeWithholdTransition` says `shouldRecord`.

### Pitfall 6: Strict env rejects pilot `.env`

**What goes wrong:** Startup failure when operator adds `SMTP_*` before allowlist update.

**Why it happens:** `assertNoUnknownEnvKeys` in test fixtures.

**How to avoid:** Add all Phase 4 keys to `ENV_KEYS` and schema together with `.env.example`.

## Code Examples

### Existing integration anchor (sync loop)

```18:72:src/sync/run-sync-cycle.ts
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
  // ... upsert path assigns bridgeUuid from mapping ?? randomUUID()
```

Planner task: insert withhold handler **before** `return` on drop branch and **after** successful upsert/cancel on busy/drop paths, not on `full`-only updates that skip withhold.

### Config allowlist extension (pattern)

```4:17:src/config/env.ts
const ENV_KEYS = [
  'MAILBOX_CALDAV_URL',
  // ...
  'LOG_LEVEL',
] as const;
```

Extend with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, plus planner-chosen `NOTIFY_OWNER_EMAIL` and tag URL key.

### CLI extension pattern

```101:105:src/index.ts
  if (subcommand !== 'sync') {
    console.log(`er-calendar-bridge v${VERSION}`);
    console.log('Usage: er-calendar-bridge sync [--watch]');
    return subcommand === undefined ? 0 : 1;
  }
```

Add `audit` branch with `list` and optional `--since ISO-8601` (D-15).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@types/nodemailer` | Built-in types in nodemailer 10+ | nodemailer 10 | Drop `@types/nodemailer` if present |
| OPS-03 withhold UI | Cycle logs + audit CLI | Phase 3 → 4 split | 03-VERIFICATION noted partial OPS-03 |
| IT BCC on mail | Audit log only | Phase 4 CONTEXT D-07 | No dual SMTP recipients |

**Deprecated/outdated:**
- REQUIREMENTS SYNC-15 “suppression window” language — **superseded** by CONTEXT D-14 indefinite on-change suppression.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | nodemailer latest is 10.x on npm | Standard Stack | Pin mismatch; run `npm view` at execute |
| A2 | slopcheck would pass nodemailer | Package audit | Human-verify install |
| A3 | `notify_status: skipped` used for dedup re-entry or SMTP skipped paths | D-16 | Planner should define exact enum mapping in one module |
| A4 | Audit rows on every **transition** to busy/drop even when notify disabled | D-05/D-16 | Operator expects history without mail — aligns with CONTEXT |
| A5 | Episode starts at 1 on first withhold transition | Pattern 1 | Off-by-one duplicate or missed notify |

## Open Questions

1. **Exact env var names for notify email and tag URL**
   - What we know: D-05/D-12 leave naming to planner; must join `ENV_KEYS`.
   - Recommendation: `NOTIFY_OWNER_EMAIL` + `TAG_GUIDANCE_URL` (optional URL default empty string with copy omitting link).

2. **SMTP required when notify email unset**
   - What we know: D-05 skips mail; audit may still run.
   - Recommendation: Validate SMTP fields only when `NOTIFY_OWNER_EMAIL` is non-empty; otherwise omit transporter creation.

3. **Should audit record `notify_status: skipped` when dedup_key already sent?**
   - What we know: D-14 indefinite suppression; D-02 no repeat while unchanged — typically **no second row**.
   - Recommendation: Reserve `skipped` for explicit “recipient disabled” or “policy skip”, not poll duplicates.

4. **Busy→drop transition in one step**
   - What we know: Propagation change ⇒ new notify; dedup key includes propagation.
   - Recommendation: Single cycle transition generates one audit row + one mail with `drop` key.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | runtime | ✓ | 24.x (engines) | — |
| better-sqlite3 | audit store | ✓ | ^13.0.3 | — |
| nodemailer | SMTP | ✗ (not installed) | — | `npm install nodemailer` |
| Live SMTP | manual pilot | unknown | — | Mock in CI; optional Ethereal for dev [ASSUMED] |
| ctx7 / slopcheck | research tooling | ✗ | — | Manual doc/registry verify |

**Missing dependencies with no fallback:**
- nodemailer package (blocks implementation until install)

**Missing dependencies with fallback:**
- Live SMTP server (unit/integration mocks)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^5.0.0 |
| Config file | none — vitest defaults |
| Quick run command | `npm test -- test/store/audit-store.test.ts -x` (file ❌ Wave 0) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-14 | Notify on busy/drop transition | unit + integration | `npm test -- test/notify/withhold-notifier.test.ts -x` | ❌ Wave 0 |
| SYNC-14 | No mail on full / unchanged busy | unit | `npm test -- test/sync/withhold-transition.test.ts -x` | ❌ Wave 0 |
| SYNC-15 | Dedup key stable; no second send same state | integration | `npm test -- test/integration/sync-cycle.test.ts -t withhold` | ❌ Wave 0 |
| SYNC-15 | New episode after full→busy again | unit | `npm test -- test/sync/withhold-transition.test.ts -t episode` | ❌ Wave 0 |
| SYNC-16 | Audit append + CLI list | unit + integration | `npm test -- test/store/audit-store.test.ts -x` | ❌ Wave 0 |
| SYNC-16 | No title in audit rows | unit | assert schema + insert payload | ❌ Wave 0 |
| OPS-03 | Withhold history queryable | integration | extend sync-cycle + audit list smoke | ❌ Wave 0 |
| D-04 | Tombstone delete no notify | integration | `npm test -- test/integration/sync-cycle.test.ts -t deleted` + assert notifier not called | ✅ extend existing |
| D-08 | SMTP failure continues cycle | unit | mock transporter reject; assert `errors` unchanged / cycle completes | ❌ Wave 0 |
| SEC-04 | New env keys in allowlist | unit | `npm test -- test/config/env.test.ts` | ✅ extend |

### Sampling Rate

- **Per task commit:** targeted vitest file for touched module
- **Per wave merge:** `npm test`
- **Phase gate:** full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/sync/withhold-transition.test.ts` — episode + dedup + unchanged suppression
- [ ] `test/store/audit-store.test.ts` — schema, list since, PII-free columns
- [ ] `test/notify/withhold-notifier.test.ts` — mock transport, minimal body assertions
- [ ] `test/integration/sync-cycle-withhold.test.ts` or extend `sync-cycle.test.ts` — notifier mock in deps
- [ ] `test/config/env.test.ts` — SMTP + notify keys, conditional validation
- [ ] Framework install: `npm install nodemailer`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes (SMTP AUTH) | Credentials via env; redact in pino |
| V3 Session Management | no | — |
| V4 Access Control | yes (audit CLI) | Local operator CLI; no network exposure |
| V5 Input Validation | yes | Zod for ports, emails, URLs; ISO `--since` parse |
| V6 Cryptography | partial | TLS via nodemailer STARTTLS; no custom crypto |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII in email/audit | Information disclosure | D-09/D-16 minimal fields; no SUMMARY |
| SMTP cred leak via logs | Information disclosure | Extend pino redact for `SMTP_PASSWORD`, auth errors |
| Audit tampering | Tampering | Append-only table; no update API in Phase 4 |
| Misdirected notify | Spoofing/wrong recipient | Single config recipient (D-06); validate email format |
| Env typo secrets | Information disclosure | Keep SEC-04 strict allowlist |

## Sources

### Primary (HIGH confidence)

- In-repo `04-CONTEXT.md` — locked decisions D-01–D-16
- In-repo `src/sync/run-sync-cycle.ts`, `src/store/mapping-store.ts`, `src/config/env.ts` — integration points
- In-repo `.planning/research/ARCHITECTURE.md` — notify module + pipeline step 7
- [github.com/nodemailer/nodemailer README](https://raw.githubusercontent.com/nodemailer/nodemailer/master/README.md) — Node 20+, types, TLS/port guidance

### Secondary (MEDIUM confidence)

- In-repo `.planning/research/STACK.md` — nodemailer as withhold transport
- In-repo `test/integration/sync-cycle.test.ts` — drop/delete/tier behaviors

### Tertiary (LOW confidence)

- nodemailer exact npm version — not verified via registry this session

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — nodemailer version unpinned; direction aligned with STACK.md + official README
- Architecture: HIGH — codebase + locked CONTEXT define clear hook points and tables
- Pitfalls: HIGH — derived from Phase 3 gaps (drop early return, strict env)

**Research date:** 2026-09-16
**Valid until:** 2026-10-16 (stable domain); re-verify nodemailer major before install if >30 days

## RESEARCH COMPLETE

**Phase:** 04 - Withhold notifications and audit log
**Confidence:** HIGH (integration architecture); MEDIUM (package pin)

### Key Findings

- Wire withhold notify/audit in `handleOutboundEvent` only; exclude CalDAV tombstone deletes (D-04).
- Add `withhold_notify_state` + `withhold_audit` SQLite tables; persist `bridge_uuid` before first-sight `drop`.
- Dedup = `bridgeUuid:propagation:episode`; episode increments on `full` → `busy`/`drop`; indefinite suppression while propagation unchanged.
- Extend strict `ENV_KEYS` / Zod for SMTP + optional owner email; nodemailer not yet in `package.json`.
- Vitest: pure transition tests + mocked notifier in sync integration; extend `env.test.ts`.

### File Created

`.planning/phases/04-microsoft-graph-writer-and-withhold-notifications/04-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | MEDIUM | Registry/slopcheck not run; README + STACK agree on nodemailer |
| Architecture | HIGH | Verified against run-sync-cycle + CONTEXT locks |
| Pitfalls | HIGH | Concrete gaps in drop path and env allowlist |

### Open Questions

- Final env key names; exact semantics of `notify_status: skipped` vs `disabled`.
- Whether audit inserts on transitions when Google write failed (recommend: record withhold decision after classify, notify after best-effort Google — planner choice).

### Ready for Planning

Research complete. Planner can now create PLAN.md files.
