# Phase 3: CalDAV read, UID store, and Google sync loop - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate mailbox.org CalDAV read (tsdav), per-container SQLite mapping (source identity ↔ Google event ID), and a Google Calendar API writer with a sync loop that propagates create/update/delete for the **operator's single-account pilot** — including recurrence exceptions — using the Phase 2 classify/wash pipeline. No withhold notifications, audit SMTP, Docker packaging, or Microsoft Graph.

**Deployment model:** One bridge instance = one member = one mailbox.org CalDAV account + one Google account + one configured source calendar + one configured target Google calendar.

</domain>

<decisions>
## Implementation Decisions

### CalDAV read & deltas
- **D-01:** **Single configured source calendar** per instance (URL/ID in config) — not multi-calendar merge; aligns with one-person-per-container model.
- **D-02:** Prefer **sync-collection / sync-token deltas** on each cycle; **spike mailbox.org semantics early** (STATE concern). Fall back to alternate delta strategy only if spike fails — record outcome in research/plan.
- **D-03:** Pilot credentials via **environment variables validated with Zod** (CalDAV URL, username, app-specific password). Docker secrets abstraction deferred to Phase 5.
- **D-04:** Source **removals** propagate to Google as **cancelled events**, not hard delete — reduces risk of data loss from bridge bugs while satisfying SYNC-12 intent (no stale *active* copies). **Planner/verifier:** treat SYNC-12 as “deletion on source removes user-visible event on target (cancelled OK)” unless REQUIREMENTS text is updated in it-strategy.
- **D-05:** Surface deletions to the loop via **sync-collection removed UIDs** when available; if spike shows gaps, implementer may add snapshot diff as fallback (must still honor D-04).

### UID store & idempotency
- **D-06:** SQLite primary mapping key is **`source uid` + optional `recurrenceId`** (composite) — separate rows for recurrence exceptions; prevents duplicate Google instances on restart (SYNC-11).
- **D-07:** Add **`bridge_uuid`** column generated on first sync — stable bridge-side identifier for possible future bi-directional work; not used for day-to-day one-way logic beyond create/link metadata.
- **D-08:** Persist database at **configurable path** (e.g. `DATA_DIR` / `SQLITE_PATH`) with sensible local default; Docker volume in Phase 5.
- **D-09:** On drop/sensitive or source cancel: **keep SQLite row**, mark **cancelled** state, cancel on Google (D-04); do not delete mapping row by default.
- **D-10:** Day-to-day **tier changes** (public ↔ busy ↔ drop): **update the same mapped Google event in place** — no bulk migration tooling in Phase 3.

### Google writer & recurrence
- **D-11:** **OAuth2 refresh token** + client id/secret via env (Zod); **calendar scope only** (SEC-01).
- **D-12:** Target **`GOOGLE_CALENDAR_ID`** in config — explicit pilot calendar, not implicit primary.
- **D-13:** Recurrence: **Google recurring master + instance API pattern** for modified/deleted exceptions (SYNC-07); align with Phase 1/2 recurrence fixtures.
- **D-14:** On create: **`iCalUID` = source UID**; persist **`bridge_uuid` in private extended property** (and SQLite). Source UID remains canonical for one-way idempotency.
- **D-15:** Busy-blocks on Google: summary **"Busy"**, **opaque** transparency, strip PII fields per Phase 2 washing.

### Sync loop & pilot run
- **D-16:** **Configurable `SYNC_INTERVAL_SECONDS`**, default **~5 minutes** — meets SYNC-06 “within minutes”.
- **D-17:** CLI entrypoint: **`sync` (one shot)** and **`sync --watch`** loop from `src/index.ts` stub.
- **D-18:** Per-event Google write failures: **log, skip, continue**; retry on next poll — do not fail entire cycle.
- **D-19:** **Mocked acceptance tests** in CI (fixture CalDAV + mocked Google client); no live provider credentials in CI (Phase 1 D-13/D-14).
- **D-20:** **SYNC-13:** No extra client-side far-future filter in Phase 3 — sync what CalDAV returns; **document mailbox.org ~1-year limit** in ops notes.

### Claude's Discretion
- Exact Zod env schema names and extended-property key string for `bridge_uuid`.
- sync-collection fallback strategy if mailbox.org spike fails (ETag poll vs snapshot diff) while preserving D-04/D-05.
- SQLite schema details beyond keys (columns for `google_event_id`, `status`, `last_synced_at`, etc.).
- Google client library wiring (`googleapis`) and writer interface shape matching ARCHITECTURE.md `CalendarWriter`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Architecture (external — NGO IT strategy repo)
- `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md` — SYNC-01, SYNC-06–07, SYNC-11–13, SEC-01, SEC-03–04, OPS-01, OPS-03
- `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md` — CalDAV reader, store, Google writer, sync orchestration

### Project Planning (in-repo)
- `.planning/PROJECT.md` — One container per member, read-only source, idempotent sync, Google-first v1.0
- `.planning/REQUIREMENTS.md` — Phase 3 requirement mapping (note D-04 interpretation for SYNC-12)
- `.planning/ROADMAP.md` — Phase 3 goal and success criteria

### Prior Phase Context (in-repo)
- `.planning/phases/02-classification-washing-and-ical-domain-logic/02-CONTEXT.md` — Washing rules, `recurrenceId` on busy outbound, `processSourceEvent`
- `.planning/phases/01-project-scaffold-and-test-harness/01-CONTEXT.md` — Mocked integration in Phase 3, three-layer layout

### Research (in-repo)
- `.planning/research/ARCHITECTURE.md` — Module boundaries, build order, writer interface, UID map
- `.planning/research/PITFALLS.md` — #4 duplicates, #5 deletes, #9 recurrence, #10 tsdav sync-collection
- `.planning/research/STACK.md` — tsdav, googleapis, better-sqlite3

### Existing Code (in-repo)
- `src/domain/process-source-event.ts` — Pipeline entry after parse
- `src/adapters/ical/parse-source-event.ts` — CalDAV payload → `SourceEvent`
- `src/domain/types/index.ts` — `SourceEvent`, `OutboundEvent`
- `test/fixtures/**` — Recurrence + tier fixtures for acceptance tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 2 **`processSourceEvent`** orchestrator — sync loop calls after CalDAV parse.
- Phase 1 **fixture library + helpers** — extend for mocked CalDAV/Google acceptance path.
- Empty placeholders: `src/sync/`, future `src/adapters/caldav/`, `src/store/`, `src/writers/google/` per ARCHITECTURE.md.

### Established Patterns
- Parse only through **`src/adapters/ical/`**; domain stays pure.
- Hybrid layout: **`src/domain/`**, **`src/adapters/`**, **`src/sync/`** (Phase 1 D-01).

### Integration Points
- Sync orchestrator: poll CalDAV → parse → processSourceEvent → store lookup → Google writer → persist mapping.
- `src/index.ts` stub becomes CLI host for `sync` / `sync --watch`.

</code_context>

<specifics>
## Specific Ideas

- User session title: **"GSD discuss caldav, uid, google 3"**.
- One app instance serves **one person only** — single CalDAV + single Google account (no shared multi-user bridge).
- Prefer **cancel over hard-delete** on Google to avoid accidental data loss from bugs; willing to align decision docs / SYNC-12 wording.
- **`bridge_uuid` column** now for possible future bi-directional sync — not projecting bulk tier-migration tooling in Phase 3.

</specifics>

<deferred>
## Deferred Ideas

- **Bulk classification migration** (mass tier changes) — operational tool, not Phase 3.
- **Bi-directional sync** — out of scope per PROJECT.md; `bridge_uuid` is forward-looking metadata only.
- **Withhold notifications & IT audit** — Phase 4.
- **Docker secrets / Compose pilot packaging** — Phase 5.

</deferred>

---

*Phase: 3-CalDAV read, UID store, and Google sync loop*
*Context gathered: 2026-09-15*
