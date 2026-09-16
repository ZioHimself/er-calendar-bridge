# Phase 5: Docker packaging and local pilot deployment - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning
**Discussion title:** GSD Discuss Docker 5

<domain>
## Phase Boundary

Package the bridge as a Docker image with Docker Compose for **local operator pilot** on an encrypted laptop: one container, one member’s secrets, persistent SQLite via host paths, `sync --watch` runtime, and CI that builds/pushes a **public GHCR** image. Operator validates v1.0 end-to-end: CalDAV read → classify → wash → Google write → withhold notify/audit.

**Out of scope:** Microsoft Graph writer (Phase 6); automated mass-delete of Google events; Vault/OpenBao wiring (documented follow-up); Workspace service-account delegation (personal Google accounts).

</domain>

<decisions>
## Implementation Decisions

### Secrets delivery (SEC-02, SEC-05, SYNC-17)
- **D-01:** Use **Docker Compose `secrets:`** — gitignored files under `secrets/<member>/`, **one file per secret** (e.g. CalDAV password, Google client secret, Google refresh token, SMTP password). Copy `secrets/operator/` + service block to onboard another member.
- **D-02:** Treat **all provider credentials and OAuth client secrets** as secrets (never committed). Non-secret config via `.env` / env vars.
- **D-03:** **Thin secrets accessor** in app (file/env provider now) so a future Vault provider swaps without rewriting call sites.
- **D-04:** **Single `compose.yaml`** with a **copy-paste-friendly service example** (pilot operator service + pattern for additional members).

### Google OAuth in container (SEC-03, personal accounts)
- **D-05:** **Refresh token** read from a **mounted secret file** under `secrets/<member>/` (not baked into image).
- **D-06:** **Google OAuth client ID and client secret** as **separate secret files** in the same per-member folder.
- **D-07:** **Re-authentication on the host** (one-off CLI outside container); write updated token into `secrets/`, restart container. No in-container browser flow required for v1.0.
- **D-08:** **Calendar-only OAuth scopes** unchanged from Phase 3. **No** Workspace service-account / domain-wide delegation or workload identity for v1.0 — tenants use **personal Google accounts**; long-lived access = **offline refresh token** kept active by regular sync.
- **D-09:** Document offline consent, token file location, Google refresh limits, and when host re-auth is needed.

### Compose layout & persistence
- **D-10:** SQLite and runtime state: **bind mount** `./data/<member>` → `DATA_DIR` (pilot: `./data/operator`).
- **D-11:** **Default Compose network**; **no published `ports:`** (outbound-only CalDAV/Google/SMTP; aligns with no HTTP admin UI).
- **D-12:** Compose pulls image from **GHCR**; image ref via **`IMAGE` env** (stable semver tag documented in `.env.example`).

### Runtime / entrypoint
- **D-13:** Container default command: **`sync --watch`** with **poll interval from env** (name at planner discretion; must be configurable without image rebuild).
- **D-14:** Restart policy: **`unless-stopped`**.
- **D-15:** Logs: **structured JSON to stdout** (use existing `pino` stack where possible).
- **D-16:** Dockerfile runs app as **non-root** user.

### Docker image & CI (TEST-05 extension)
- **D-17:** **Multi-stage Dockerfile**: **`node:24-alpine`** build → slim runtime (matches CI Node 24).
- **D-18:** CI **5th job `docker-build`**: build and **push to public GHCR on every commit to `main`** (trunk-based; no PR gate). Tag with **semver** (CI derives/increments per project convention — planner documents exact scheme).
- **D-19:** `docker-build` is a **required** merge/CI gate for trunk commits.

### Host migration (OPS-02)
- **D-20:** Image and app code use **no hardcoded laptop paths** — config via env + secret mounts + `DATA_DIR`.
- **D-21:** Migration = copy **`data/<member>`** + **`secrets/<member>`** (+ optional same `compose.yaml`); server uses **`.env` for non-secret** config.
- **D-22:** **Copy Google refresh token secret** with other secrets when migrating hosts (re-auth optional best practice, not required if still valid).
- **D-23:** Phase 5 secrets remain **file-based**; Vault noted in README as server-era follow-up.

### Offboarding (SYNC-18)
- **D-24:** Deliver **runbook only**: revoke CalDAV app password, `compose down`, remove container; **no automated mass-delete** of Google events in v1.0.
- **D-25:** Document optional **manual copy of `bridge.db`** from bind mount before deleting `./data/<member>` if audit retention is needed.

### Claude's Discretion
- Exact env var names for `IMAGE`, sync interval, and secret file → env mapping in the thin accessor.
- Semver tagging mechanics on GHCR (patch bump on each main commit vs manual `package.json` version — prefer single source of truth).
- Whether `docker-build` waits for `test`/`lint`/`typecheck`/`build` jobs or runs in parallel with same bootstrap as Phase 01.1 pattern.
- Offboarding runbook structure and cross-links to Google account “third-party access” revoke steps.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & architecture
- `it-strategy/er-calendar-bridge/calendar-sync-02-requirements.md` — SYNC-17, SYNC-18, SEC-02, SEC-05, OPS-02, OPS-04, TEST-05
- `it-strategy/er-calendar-bridge/calendar-sync-03-architecture.md` — Docker deployment, per-member isolation, secrets interim model
- `.planning/REQUIREMENTS.md` — Phase 5 requirement mapping
- `.planning/ROADMAP.md` — Phase 5 success criteria and v1.0 milestone boundary

### Prior phase context
- `.planning/phases/03-caldav-read-uid-store-and-google-sync-loop/03-CONTEXT.md` — Zod env, `DATA_DIR`/`SQLITE_PATH`, Google OAuth scope, sync CLI
- `.planning/phases/04-microsoft-graph-writer-and-withhold-notifications/04-CONTEXT.md` — CLI-only ops, no HTTP UI
- `.planning/phases/01.1-ci-pipeline/01.1-CONTEXT.md` — Four-job CI layout extended by `docker-build`

### Research
- `.planning/research/ARCHITECTURE.md` — Multi-stage alpine image, Compose per-member pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/config/env.ts` — Zod-validated config; `DATA_DIR` / `SQLITE_PATH` already support container persistence paths.
- `package.json` — Node **24.x**, `pino` for structured logging, `build` via `tsc`.
- `.github/workflows/ci.yml` — Four sibling jobs; append `docker-build` without restructuring (Phase 01.1 D-08).

### Established Patterns
- Pilot credentials today: env vars validated at startup; Phase 5 adds file-based secrets injection without changing domain/sync logic.
- CLI entrypoints: `sync` / `sync --watch`, `audit list` — container should invoke same binaries as host.

### Integration Points
- Google writer + `google-auth-library` — must read refresh token and client credentials from secrets accessor mounts.
- SQLite stores under configurable DB path — bind-mounted `DATA_DIR` on host.

</code_context>

<specifics>
## Specific Ideas

- Discussion session title: **GSD Discuss Docker 5**.
- Prefer **GHCR pull** on laptop with **semver-stable `IMAGE` in `.env`**, not only local `build: .`.
- **Per-secret files** under `secrets/operator/` chosen over per-tenant bundle for blast radius and Compose-native secrets.
- Personal Google accounts → refresh-token path only; user asked about “trusted device” scopes — answered: no extra Calendar scope; keep token alive via regular sync and host re-auth when revoked.

</specifics>

<deferred>
## Deferred Ideas

- **Google Workspace service account + domain-wide delegation** — for org-hosted server if accounts move to Workspace; not viable for current personal-account tenants.
- **Vault / OpenBao secrets backend** — target per IT strategy; implement after file-based pilot.
- **CLI to bulk-delete propagated Google events** — safety risk; manual cleanup in runbook only.
- **Microsoft Graph / dual-target Docker** — Phase 6.

</deferred>

---

*Phase: 05-docker-packaging-and-local-pilot-deployment*
*Context gathered: 2026-09-16*
