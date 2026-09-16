# Phase 4: Withhold notifications and audit log - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Add SMTP owner notifications and a durable withhold audit trail when events are **downgraded** (busy-block on Google) or **withheld** (sensitive drop / cancel on Google), with **de-duplication** and **operator inspectability**, integrated into the Phase 3 Google sync loop (`runSyncCycle` → `processSourceEvent`). Extends OPS-03 with per-event withhold history. **No Microsoft Graph writer** (v1.1 / Phase 6). **No Docker packaging** (Phase 5).

**Deployment model:** Unchanged — one bridge instance = one member; pilot is operator single-account.

</domain>

<decisions>
## Implementation Decisions

### Notify triggers (SYNC-14)
- **D-01:** Send owner notification for **both** `busy` and `drop` propagation outcomes (not drop-only).
- **D-02:** Notify **on change only** — when propagation (or effective withhold state) **differs from last recorded state** for that event instance; suppress repeated sends across poll cycles while state is unchanged.
- **D-03:** If an event returns to **full** disclosure (e.g. owner adds `ER-PUBLIC`) and later downgrades again, treat as a **new episode** and notify again.
- **D-04:** **Do not** send withhold notifications for normal **source deletions** (CalDAV tombstones); Google cancel behavior from Phase 3 is sufficient.

### Owner recipient & SMTP gating
- **D-05:** Owner SMTP recipient is an **optional configured member email** (dedicated env var — exact name at planner discretion). If **unset**, **skip all owner notifications** (sync and audit may still record withhold events per D-16).
- **D-06:** **Do not** extend iCal parsing for `ORGANIZER` in Phase 4 — config email only (pilot syncs operator’s own calendar).
- **D-07:** **No IT BCC/copy** on owner mail — IT visibility via **audit log only** (SYNC-16).
- **D-08:** On SMTP misconfiguration or send failure: **log error**, record audit row with failed/skipped notify status, **continue sync cycle** (align with Phase 3 D-18).

### Email content
- **D-09:** **Minimal body** — no original title, location, description, or attendees in email (avoid SMTP as a PII leak channel).
- **D-10:** **English only** for pilot copy.
- **D-11:** **Fixed subject line** (single static subject for filtering; specifics in body).
- **D-12:** Body includes **tag guidance** — explain `ER-PUBLIC` / `ER-INTERNAL` / `ER-SENSITIVE` and link to internal documentation via **configurable static URL** (planner picks env key).

### De-duplication & audit (SYNC-15, SYNC-16, OPS-03)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap (in-repo)
- `.planning/REQUIREMENTS.md` — SYNC-14, SYNC-15, SYNC-16; OPS-03 (extended in this phase)
- `.planning/ROADMAP.md` — Phase 4 goal and success criteria
- `.planning/PROJECT.md` — Notify owners on withhold/downgrade; fail-closed classification

### Architecture & stack (in-repo)
- `.planning/research/ARCHITECTURE.md` — `notify/` module, SMTP, store dedup, pipeline step 7
- `.planning/research/STACK.md` — nodemailer for withhold notifications
- `.planning/research/SUMMARY.md` — build order: notify after sync loop

### External IT strategy (not vendored in repo — read if available locally)
- `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md` — SYNC-14–16, OPS-03
- `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md` — notifier + audit expectations

### Prior phase context (in-repo)
- `.planning/phases/03-caldav-read-uid-store-and-google-sync-loop/03-CONTEXT.md` — Sync loop, `bridgeUuid`, drop/busy/cancel paths, D-18 per-event failure policy
- `.planning/phases/02-classification-washing-and-ical-domain-logic/02-CONTEXT.md` — Tiers, `processSourceEvent`, washing rules

### Existing code (in-repo)
- `src/sync/run-sync-cycle.ts` — Integration point after `processSourceEvent` / mapping updates
- `src/domain/process-source-event.ts` — Tier + propagation decisions
- `src/store/mapping-store.ts` — `bridgeUuid` on mapped events
- `.env.example` — `SMTP_*` placeholders for Phase 4

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`runSyncCycle` / `handleOutboundEvent`** — Already branches on `drop` vs busy upsert; notification hook should run when propagation **changes**, using mapping store + new audit store.
- **`bridgeUuid` in mapping store** — Primary stable id for dedup key (D-13); may need extension for drop-before-map cases.
- **`openMappingStore` / `openSyncStateStore`** — SQLite pattern via better-sqlite3; audit table fits same DB file.
- **`.env.example` `SMTP_*` keys** — Pre-scaffolded for nodemailer config.

### Established Patterns
- **Phase 3 D-18** — Per-event ancillary failures must not abort whole cycle; applies to notify path.
- **OPS-03** — Cycle aggregates + `last_success_at`; Phase 4 adds queryable per-event withhold audit (03-VERIFICATION noted partial OPS-03).
- **PII minimization** — Phase 2 washing strips fields on outbound; email and audit follow same spirit (D-09, D-16).

### Integration Points
- After classify/wash decision and mapping read/write in sync loop — compare to **last known propagation** per `uid`+`recurrenceId` (and episode rules).
- **`src/index.ts` CLI** — Add audit subcommand alongside `sync` / `sync --watch`.
- **Config loader** — Extend Zod schema: SMTP + optional notify email + tag doc URL.

</code_context>

<specifics>
## Specific Ideas

- Discussion session title: **"GSD notifications and audit log 4"**.
- User focus phrase: **withhold notifications and audit log**.
- Optional notify email: if not configured, **no owner emails** (audit/logging still expected for operator).

</specifics>

<deferred>
## Deferred Ideas

- **iCal ORGANIZER-based recipient** — deferred; config email sufficient for pilot (D-06).
- **IT BCC on every owner mail** — deferred in favor of audit CLI (D-07).
- **Dutch/bilingual email templates** — deferred post-pilot (D-10).
- **Microsoft Graph writer** — Phase 6 / v1.1; not in this phase despite legacy phase directory slug.

</deferred>

---

*Phase: 4-Withhold notifications and audit log*
*Context gathered: 2026-09-16*
