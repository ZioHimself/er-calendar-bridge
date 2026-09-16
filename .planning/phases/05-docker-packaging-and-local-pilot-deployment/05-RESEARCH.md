# Phase 5: Docker packaging and local pilot deployment - Research

**Researched:** 2026-09-16
**Domain:** Docker multi-stage image, Compose secrets, GHCR CI publish, Node native modules (better-sqlite3)
**Confidence:** HIGH (Compose/GHCR/CI patterns); MEDIUM (Alpine + better-sqlite3 build details until Dockerfile spike)

## Summary

Phase 5 closes the v1.0 milestone by packaging the existing CLI (`node dist/index.js sync --watch`) as a **multi-stage `node:24-alpine` image**, orchestrating a **single-member pilot** with **Docker Compose `secrets:`** and **bind-mounted `./data/<member>`**, and extending `.github/workflows/ci.yml` with a fifth sibling job **`docker-build`** that **builds on every workflow run** and **pushes to public GHCR on `push` to `main`**.

The application already centralizes configuration in `loadConfig()` (`src/config/env.ts`) with `DATA_DIR` / `SQLITE_PATH`, `SYNC_INTERVAL_SECONDS`, and secret redaction in `pino`. There is **no `src/secrets/` module yet** — Phase 5 must add a **thin file/env secrets accessor** and wire it **before** `loadConfig()` so Compose-mounted files under `/run/secrets/<name>` satisfy SEC-02/SEC-05 without baking credentials into the image. Domain/sync logic should not change.

**Primary recommendation:** Implement `Dockerfile` + `.dockerignore` + `compose.yaml` (GHCR `image: ${IMAGE}`, no `ports:`, `restart: unless-stopped`, per-secret files under `secrets/operator/`), add `src/secrets/` with a swappable provider that maps Compose secret names → env values, extend CI with `docker-build` (`needs: [test, lint, typecheck, build]`, job-level `packages: write`, push only on `main` push), document operator pilot + host migration + offboarding runbooks, and gate with unit tests for the secrets provider plus CI `docker build` (no live provider credentials — TEST-05).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Secrets delivery (SEC-02, SEC-05, SYNC-17)
- **D-01:** Use **Docker Compose `secrets:`** — gitignored files under `secrets/<member>/`, **one file per secret** (e.g. CalDAV password, Google client secret, Google refresh token, SMTP password). Copy `secrets/operator/` + service block to onboard another member.
- **D-02:** Treat **all provider credentials and OAuth client secrets** as secrets (never committed). Non-secret config via `.env` / env vars.
- **D-03:** **Thin secrets accessor** in app (file/env provider now) so a future Vault provider swaps without rewriting call sites.
- **D-04:** **Single `compose.yaml`** with a **copy-paste-friendly service example** (pilot operator service + pattern for additional members).

#### Google OAuth in container (SEC-03, personal accounts)
- **D-05:** **Refresh token** read from a **mounted secret file** under `secrets/<member>/` (not baked into image).
- **D-06:** **Google OAuth client ID and client secret** as **separate secret files** in the same per-member folder.
- **D-07:** **Re-authentication on the host** (one-off CLI outside container); write updated token into `secrets/`, restart container. No in-container browser flow required for v1.0.
- **D-08:** **Calendar-only OAuth scopes** unchanged from Phase 3. **No** Workspace service-account / domain-wide delegation or workload identity for v1.0 — tenants use **personal Google accounts**; long-lived access = **offline refresh token** kept active by regular sync.
- **D-09:** Document offline consent, token file location, Google refresh limits, and when host re-auth is needed.

#### Compose layout & persistence
- **D-10:** SQLite and runtime state: **bind mount** `./data/<member>` → `DATA_DIR` (pilot: `./data/operator`).
- **D-11:** **Default Compose network**; **no published `ports:`** (outbound-only CalDAV/Google/SMTP; aligns with no HTTP admin UI).
- **D-12:** Compose pulls image from **GHCR**; image ref via **`IMAGE` env** (stable semver tag documented in `.env.example`).

#### Runtime / entrypoint
- **D-13:** Container default command: **`sync --watch`** with **poll interval from env** (name at planner discretion; must be configurable without image rebuild).
- **D-14:** Restart policy: **`unless-stopped`**.
- **D-15:** Logs: **structured JSON to stdout** (use existing `pino` stack where possible).
- **D-16:** Dockerfile runs app as **non-root** user.

#### Docker image & CI (TEST-05 extension)
- **D-17:** **Multi-stage Dockerfile**: **`node:24-alpine`** build → slim runtime (matches CI Node 24).
- **D-18:** CI **5th job `docker-build`**: build and **push to public GHCR on every commit to `main`** (trunk-based; no PR gate). Tag with **semver** (CI derives/increments per project convention — planner documents exact scheme).
- **D-19:** `docker-build` is a **required** merge/CI gate for trunk commits.

#### Host migration (OPS-02)
- **D-20:** Image and app code use **no hardcoded laptop paths** — config via env + secret mounts + `DATA_DIR`.
- **D-21:** Migration = copy **`data/<member>`** + **`secrets/<member>`** (+ optional same `compose.yaml`); server uses **`.env` for non-secret** config.
- **D-22:** **Copy Google refresh token secret** with other secrets when migrating hosts (re-auth optional best practice, not required if still valid).
- **D-23:** Phase 5 secrets remain **file-based**; Vault noted in README as server-era follow-up.

#### Offboarding (SYNC-18)
- **D-24:** Deliver **runbook only**: revoke CalDAV app password, `compose down`, remove container; **no automated mass-delete** of Google events in v1.0.
- **D-25:** Document optional **manual copy of `bridge.db`** from bind mount before deleting `./data/<member>` if audit retention is needed.

### Claude's Discretion
- Exact env var names for `IMAGE`, sync interval, and secret file → env mapping in the thin accessor.
- Semver tagging mechanics on GHCR (patch bump on each main commit vs manual `package.json` version — prefer single source of truth).
- Whether `docker-build` waits for `test`/`lint`/`typecheck`/`build` jobs or runs in parallel with same bootstrap as Phase 01.1 pattern.
- Offboarding runbook structure and cross-links to Google account “third-party access” revoke steps.

### Deferred Ideas (OUT OF SCOPE)
- **Google Workspace service account + domain-wide delegation** — for org-hosted server if accounts move to Workspace; not viable for current personal-account tenants.
- **Vault / OpenBao secrets backend** — target per IT strategy; implement after file-based pilot.
- **CLI to bulk-delete propagated Google events** — safety risk; manual cleanup in runbook only.
- **Microsoft Graph / dual-target Docker** — Phase 6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-17 | Docker image with Compose orchestration — one container per synced member | Multi-stage Dockerfile, `compose.yaml` with one `bridge-operator` service, GHCR `IMAGE`, bind mount `DATA_DIR`, Compose `secrets:` per member |
| SYNC-18 | Offboarding support — revoke credential, remove container, delete propagated copies | Runbook only (D-24/D-25); no bulk Google delete automation |
| SEC-02 | Credentials encrypted at rest; never plaintext in config or VCS | Gitignored `secrets/` + `data/`; Compose secrets as files; host disk encryption (operator); no secrets in image layers or CI |
| SEC-05 | Secrets retrieval abstracted behind accessor | New `src/secrets/` provider interface; file + env implementations; `loadConfig` fed resolved values |
| OPS-01 | Single-account pilot configuration | `secrets/operator/` + `./data/operator` + documented `.env` non-secrets |
| OPS-02 | Host migration is deployment change, not rewrite | Portable env + mounts; no hardcoded paths in `src/` (verified: none) |
| OPS-04 | Minimum viable tooling | Single Compose file, one CI job extension, no K8s/Vault in v1.0 |
| TEST-05 | CI runs tests without live provider credentials | Existing vitest fixtures; `docker build` needs no provider secrets; optional `docker run … sync` usage smoke without env |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Image build & registry publish | CI (GitHub Actions `docker-build`) | GHCR | Image artifact produced on trunk; laptop pulls tagged image |
| Runtime sync loop | Container (Node CLI) | — | Same `sync --watch` as host; outbound-only network |
| Credential storage at rest | Host filesystem (`secrets/<member>/`, encrypted laptop) | Compose secrets mount | SEC-02; never in git or image |
| Credential injection at runtime | Container entry/bootstrap (`src/secrets/`) | Compose `secrets:` → `/run/secrets/*` | Maps files to config without env var leakage in compose file |
| SQLite UID map / audit | Host bind mount (`./data/<member>`) | Container `DATA_DIR` | Persistence across restarts (D-10); ROADMAP “named volume” superseded by CONTEXT bind mount |
| Poll interval / log level | Container env (`.env`) | — | D-13; no rebuild |
| Quality gate (tests + image) | CI runner | — | Fifth job after compile graph green |
| Offboarding procedure | Operator runbook (docs) | mailbox.org / Google account UIs | SYNC-18 manual steps only |

## Standard Stack

### Core

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `node:24-alpine` | 24 (Docker Official Image) | Build + runtime base | Matches `engines.node: "24.x"` and CI Node 24 (D-17) [CITED: Docker Hub `library/node`] |
| Docker Engine + Compose V2 | ≥ 20.x / compose plugin | Local pilot | `docker compose` is default orchestration for single-host pilots [CITED: docs.docker.com/compose] |
| GHCR | `ghcr.io` | Image registry | Native GitHub integration; `GITHUB_TOKEN` publish from Actions [CITED: docs.github.com Container registry] |
| `docker/login-action` | Pin SHA from GitHub docs | CI registry auth | Official pattern for `ghcr.io` [CITED: docs.github.com publishing Docker images] |
| `docker/build-push-action` | Pin SHA from GitHub docs | Build/push in CI | Builds Dockerfile context; conditional `push` on `main` |
| `docker/metadata-action` | Pin SHA from GitHub docs | Semver/`latest` tags | Derives tags from `package.json` version or git refs [CITED: metadata-action README via GitHub docs example] |
| Existing app deps | `package-lock.json` | Runtime in image | No new runtime npm packages required for Docker itself |
| `better-sqlite3` | ^13.0.3 (lockfile) | SQLite in container | Native addon — must compile or copy from build stage on Alpine [VERIFIED: `npm view better-sqlite3` → 13.0.3] |

### Supporting

| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| `.dockerignore` | — | Smaller, safer build context | Exclude `.git`, `test/`, `.planning/`, `secrets/`, `data/` |
| `compose.yaml` | Compose spec 3.x | Pilot stack | Single file per D-04 |
| `secrets/operator/*.example` or README table | — | Onboarding template | Document required secret filenames without real values |
| `docs/runbooks/offboarding.md` (or README section) | — | SYNC-18 | Revoke, `compose down`, optional `bridge.db` backup |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Compose `secrets:` | Env vars in `.env` for passwords | Violates D-01/SEC-02; secrets appear in process listings and logs |
| Bind mount `./data/<member>` | Named Docker volume | CONTEXT locked bind mount for easy migration/copy (D-10/D-21) |
| GHCR public image | `build: .` only on laptop | CONTEXT requires GHCR pull + `IMAGE` in `.env` (D-12) |
| Shell entrypoint exporting secrets | TS `SecretProvider` only | Shell harder to unit test; hybrid OK if TS owns mapping (D-03) |
| `docker compose` build in CI | Image build only in Actions | Laptop pilot pulls GHCR; local build optional for dev |

**Installation (operator laptop):** Pull image — no npm install on host for production pilot.

```bash
docker pull ghcr.io/europeanresolve/er-calendar-bridge:1.0.0   # example tag from IMAGE in .env
docker compose up -d
```

**Version verification (2026-09-16):**

```bash
npm view better-sqlite3 version   # 13.0.3
node --version                  # CI/local target 24.x (dev machine may differ)
docker --version                # 29.7.2 (local probe)
```

**GHCR image name:** `ghcr.io/europeanresolve/er-calendar-bridge` [VERIFIED: `git remote` → `europeanresolve/er-calendar-bridge`]

## Package Legitimacy Audit

> Phase 5 adds **no new npm runtime dependencies** for Docker packaging. CI uses **GitHub Actions** (not npm). `slopcheck` was **not run** in this session (host install blocked); treat any future npm additions as `[ASSUMED]` until slopcheck + docs verification.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none new)* | — | — | — | — | n/a | No new `npm install` for phase core |

**GitHub Actions (pin to commit SHAs per GitHub docs examples):**

| Action | Disposition |
|--------|-------------|
| `docker/login-action` | Approved — official Docker org action [CITED: docs.github.com] |
| `docker/build-push-action` | Approved — official Docker org action [CITED: docs.github.com] |
| `docker/metadata-action` | Approved — official Docker org action [CITED: docs.github.com] |

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none  

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────── Operator laptop (encrypted disk) ─────────────────┐
│  secrets/operator/*  (gitignored files, one secret per file)       │
│  .env (non-secret: URLs, IMAGE, DATA_DIR, SYNC_INTERVAL_SECONDS) │
│  ./data/operator/  ──bind mount──►  DATA_DIR in container        │
└────────────────────────────┬──────────────────────────────────────┘
                             │ docker compose up
                             ▼
┌──────────────── Container: bridge-operator ──────────────────────┐
│  /run/secrets/*  ◄── Compose secrets (read-only files)            │
│       │                                                            │
│       ▼                                                            │
│  SecretProvider (file) ──► resolved env ──► loadConfig()          │
│       │                                                            │
│       ▼                                                            │
│  node dist/index.js sync --watch  ──► pino JSON ──► stdout        │
│       │                                                            │
│       ├──► CalDAV (mailbox.org) outbound HTTPS                    │
│       ├──► Google Calendar API (refresh token)                    │
│       └──► SMTP (optional withhold notify)                        │
└────────────────────────────────────────────────────────────────────┘
                             ▲
                             │ docker pull
┌──────────────── GitHub Actions: docker-build (on main push) ───────┐
│  needs: test, lint, typecheck, build                               │
│  build-push-action ──► ghcr.io/europeanresolve/er-calendar-bridge │
└────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
Dockerfile
.dockerignore
compose.yaml
.env.example          # add IMAGE=, DATA_DIR=, document secrets/ layout
secrets/
  operator/           # gitignored; operator-created files
data/
  operator/           # gitignored; SQLite bind mount
src/
  secrets/
    types.ts          # SecretProvider interface
    file-provider.ts  # /run/secrets + optional *_FILE paths
    resolve-env.ts    # merge provider → env for loadConfig
  config/env.ts       # unchanged contract; fed by resolve-env
docs/runbooks/
  offboarding.md      # SYNC-18
  docker-pilot.md     # optional: onboarding + migration
```

### Pattern 1: Compose secrets → `/run/secrets/<name>`

**What:** Declare top-level `secrets` with `file:` paths; grant per-service with `secrets:` list.  
**When to use:** All pilot credentials (D-01).  
**Example:**

```yaml
# Source: https://docs.docker.com/compose/use-secrets/
services:
  bridge-operator:
    image: ${IMAGE}
    restart: unless-stopped
    env_file: .env
    environment:
      DATA_DIR: /data
    volumes:
      - ./data/operator:/data
    secrets:
      - mailbox_app_password
      - google_client_id
      - google_client_secret
      - google_refresh_token
    command: ["node", "dist/index.js", "sync", "--watch"]

secrets:
  mailbox_app_password:
    file: ./secrets/operator/mailbox_app_password
  google_client_id:
    file: ./secrets/operator/google_client_id
  google_client_secret:
    file: ./secrets/operator/google_client_secret
  google_refresh_token:
    file: ./secrets/operator/google_refresh_token
```

**Note:** Compose delivers Linux bind-mounted secret **files** at `/run/secrets/<secret_name>` [CITED: docs.docker.com/compose/use-secrets/]. Map `mailbox_app_password` → `MAILBOX_APP_PASSWORD` in the TS accessor (discretion).

### Pattern 2: Multi-stage Alpine Dockerfile with native module build

**What:** Builder stage installs build tools, runs `npm ci` + `npm run build`; runtime stage copies `dist/`, production `node_modules`, runs as `USER node`.  
**When to use:** `better-sqlite3` native compile on Alpine (D-17).  
**Example:**

```dockerfile
# Source: Docker multi-stage pattern + Node alpine conventions [CITED: docs.docker.com/reference/dockerfile]
FROM node:24-alpine AS build
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime
LABEL org.opencontainers.image.source=https://github.com/europeanresolve/er-calendar-bridge
WORKDIR /app
RUN chown -R node:node /app
USER node
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/index.js", "sync", "--watch"]
```

**Planner task:** Validate `npm prune --omit=dev` leaves working `better-sqlite3` binary for `linux-musl` + Node 24; fallback is `npm ci --omit=dev` in build stage with same build deps.

### Pattern 3: CI `docker-build` job (GHCR, push on `main` only)

**What:** Fifth sibling job; `needs` prior four jobs; job-level `permissions: packages: write`; login to `ghcr.io` with `GITHUB_TOKEN`; build always, push only on `push` to `main`.  
**When to use:** D-18/D-19 + TEST-05 (build without provider creds).  
**Example:**

```yaml
# Source: https://docs.github.com/en/actions/publishing-packages/publishing-docker-images
  docker-build:
    runs-on: ubuntu-latest
    needs: [test, lint, typecheck, build]
    if: always() && !cancelled() && (needs.test.result == 'success' && needs.lint.result == 'success' && needs.typecheck.result == 'success' && needs.build.result == 'success')
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7
      - uses: docker/login-action@65b78e6e13532edd9afa3aa52ac7964289d1a9c1
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@9ec57ed1fcdbf14dcef7dfbe97b2010124a938b7
        with:
          images: ghcr.io/europeanresolve/er-calendar-bridge
          tags: |
            type=semver,pattern={{version}}
            type=raw,value=latest,enable={{is_default_branch}}
      - uses: docker/build-push-action@f2a1d5e99d037542a71f64918e516c093c6f3fc4
        with:
          context: .
          push: ${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

**Recommendation (discretion — semver):** Use **`package.json` `version` as single source of truth**; bump to `1.0.0` at v1.0 completion; CI tags `1.0.0` and `latest` on `main`. Avoid auto-increment patch on every commit unless you add a release bot — keeps operator `IMAGE=` stable until intentional version bumps.

**Workflow-level permissions:** Keep `contents: read` globally; only `docker-build` escalates `packages: write` [CITED: GitHub Container registry docs].

**Public GHCR:** First workflow publish links package to repo via `org.opencontainers.image.source` label; set package visibility **public** in GitHub UI (defaults private) [CITED: docs.github.com Container registry].

### Pattern 4: Thin `SecretProvider` before `loadConfig`

**What:** Interface + file provider reading `/run/secrets/<compose_name>`; optional env override for host dev; `resolvePilotEnv(process.env)` returns env object passed to `loadConfig()`.  
**When to use:** SEC-05 without changing Google/CalDAV call sites.  
**Example:**

```typescript
// Source: project pattern + Compose secret mount paths [CITED: docs.docker.com/compose/use-secrets/]
export type SecretProvider = {
  get(name: string): string | undefined;
};

export function createComposeFileSecretProvider(
  mountDir = '/run/secrets',
): SecretProvider {
  return {
    get(name: string): string | undefined {
      const path = `${mountDir}/${name}`;
      try {
        return readFileSync(path, 'utf8').trim();
      } catch {
        return undefined;
      }
    },
  };
}

const COMPOSE_TO_ENV: Record<string, string> = {
  mailbox_app_password: 'MAILBOX_APP_PASSWORD',
  google_client_id: 'GOOGLE_CLIENT_ID',
  google_client_secret: 'GOOGLE_CLIENT_SECRET',
  google_refresh_token: 'GOOGLE_REFRESH_TOKEN',
  smtp_password: 'SMTP_PASSWORD',
};
```

Wire `main()` / tests to call `loadConfig(resolvePilotEnv(process.env))` when provider is enabled.

### Anti-Patterns to Avoid

- **Baking secrets via `ARG`/`ENV` in Dockerfile:** Layers can leak credentials; use runtime mounts only (D-02).
- **Publishing `ports:` for “health”:** No HTTP admin UI; violates D-11 and expands attack surface.
- **Shared secrets file per org:** Violates SEC-04 / per-member isolation; use `secrets/<member>/` copy pattern.
- **Running as root in container:** Violates D-16; use `USER node` on official image.
- **Skipping `needs` on `docker-build`:** Broken TypeScript could still publish images; D-19 implies gate after compile/tests.
- **ROADMAP “named volume” only:** CONTEXT requires bind mount for migration (D-10/D-21).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret file mounting | Custom volume encryption layer | Compose `secrets:` + host FDE | Compose standard mount to `/run/secrets` [CITED: Docker docs] |
| Image registry auth in CI | Custom token exchange | `docker/login-action` + `GITHUB_TOKEN` | Documented GHCR flow |
| Semver + `latest` tagging | Ad-hoc shell in CI | `docker/metadata-action` | Handles branch/ref rules |
| Process supervision | systemd inside container | `restart: unless-stopped` + watch loop | D-14; single-process CLI |
| OAuth browser in container | Headless Chrome flow | Host re-auth + update secret file | Locked D-07 |

**Key insight:** Phase 5 is packaging and ops glue — reuse existing CLI, `loadConfig`, and `pino`; only add secrets resolution and deployment artifacts.

## Common Pitfalls

### Pitfall 1: `better-sqlite3` fails on Alpine runtime

**What goes wrong:** Container exits on startup with native module load error.  
**Why it happens:** Alpine uses musl; module must be built for target libc/Node ABI.  
**How to avoid:** Compile in `node:24-alpine` build stage with `python3 make g++`; copy `node_modules` from build stage; smoke-test `node -e "require('better-sqlite3')"` in CI build.  
**Warning signs:** `Error: Could not locate the bindings file` in container logs.

### Pitfall 2: Secrets present on disk but empty in app

**What goes wrong:** `loadConfig` throws “Invalid value” for secret fields.  
**Why it happens:** Compose secret name ≠ accessor mapping; trailing newlines; wrong mount path.  
**How to avoid:** Document exact filenames; `.trim()` on read; unit tests with temp dirs mimicking `/run/secrets`.  
**Warning signs:** Zod errors for `GOOGLE_*` / `MAILBOX_APP_PASSWORD` immediately on start.

### Pitfall 3: CI pushes on PRs or leaks credentials

**What goes wrong:** Unwanted tags on GHCR; fork PR exfiltration patterns.  
**Why it happens:** `push: true` without branch guard.  
**How to avoid:** `push` only when `github.ref == refs/heads/main` and `github.event_name == push`; no build secrets in Dockerfile.  
**Warning signs:** PR workflow uploading to registry.

### Pitfall 4: `.gitignore` omits `secrets/` or `data/`

**What goes wrong:** Credential or SQLite commit (SEC-02 failure).  
**Why it happens:** Current `.gitignore` only has `node_modules/`, `dist/`, `.env` [VERIFIED: repo `.gitignore`].  
**How to avoid:** Add `secrets/`, `data/`, and keep `.env` ignored; commit only `.env.example` and secret filename templates.  
**Warning signs:** `git status` shows `secrets/operator/*` as trackable.

### Pitfall 5: ROADMAP vs CONTEXT drift

**What goes wrong:** Planner implements named volumes or skips GHCR push.  
**Why it happens:** ROADMAP success criteria #3 (named volume) and #6 (no registry push) predate discuss-phase.  
**How to avoid:** Follow CONTEXT D-10, D-12, D-18; update ROADMAP after phase execution.  
**Warning signs:** Plan mentions only `docker compose build` or anonymous volumes.

## Code Examples

### Pino JSON to stdout (existing — D-15)

```typescript
// Source: src/index.ts (existing)
return pino({
  level: logLevel,
  redact: { paths: [/* secrets */], remove: true },
});
```

Default pino destination is stdout (JSON when not using pino-pretty) — suitable for `docker logs`.

### Host re-auth flow (D-07, D-09)

```bash
# On host (outside container), after OAuth consent:
# 1. Obtain new refresh token via existing host CLI / documented script
# 2. Write token to gitignored file
printf '%s' "$NEW_REFRESH_TOKEN" > secrets/operator/google_refresh_token
# 3. Restart stack
docker compose restart bridge-operator
```

Document Google “third-party access” revoke and token invalidation limits in runbook (discretion).

### CI image smoke without credentials (TEST-05)

```bash
docker build -t er-calendar-bridge:ci .
docker run --rm er-calendar-bridge:ci node dist/index.js
# Expect usage text exit 0 — no provider env required
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Host-only `tsx src/index.js` | GHCR image + Compose | Phase 5 | Operator pilot standardized |
| Env-only secrets in `.env` | Compose `secrets:` files | Discuss 2026-09-16 | SEC-02 alignment |
| 4-job CI | 5-job CI + GHCR | Phase 5 | TEST-05 extends to image build |
| `package.json` version `0.0.0` | Bump to `1.0.0` at milestone | Phase 5 gate | Stable `IMAGE` tag for pilots |

**Deprecated/outdated:**
- **ROADMAP Phase 5 criterion #6 (no registry push):** Superseded by CONTEXT D-18 — push public GHCR on `main`.
- **ROADMAP Phase 5 criterion #3 (named volume):** Superseded by CONTEXT D-10 bind mounts.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `npm prune --omit=dev` after build retains working `better-sqlite3` on Alpine | Pattern 2 | CI/docker smoke fails — use full `npm ci --omit=dev` in build stage |
| A2 | GHCR package visibility set to **public** after first push | Standard Stack | `docker pull` fails for operators without auth |
| A3 | `docker/metadata-action` semver tags read `package.json` version from context | Pattern 3 | Wrong tags — may need `version` input from `jq` step |
| A4 | Official `node` image `USER node` can read `/run/secrets` mounts | Compose secrets | Permission denied — may need root group or custom uid (rare on Linux) |
| A5 | `it-strategy/er-calendar-bridge/*.md` paths in CONTEXT are external to this repo | Canonical refs | Planner links README to in-repo docs only |

## Open Questions (RESOLVED)

1. **Should `docker-build` run on `pull_request` with `push: false`?**
   - **RESOLVED:** Yes — build on every CI event (`pull_request` and `push`); `docker push` to GHCR **only** on `push` to `main`. PRs get `push: false` image build for TEST-05 without registry publish.

2. **Optional SMTP secrets in pilot?**
   - **RESOLVED:** Do **not** declare `smtp_password` in the default `compose.yaml` (Compose `file:` secrets require the path to exist). Base stack omits SMTP secret; operators enable notify via optional overlay `compose.notify.yaml` (or documented second compose file) that adds `smtp_password` when `NOTIFY_OWNER_EMAIL` is set. `resolve-env` skips SMTP when notify disabled.

3. **Bump `package.json` to `1.0.0` in this phase?**
   - **RESOLVED:** Yes — bump in plan `05-04` Task 1 so `IMAGE=ghcr.io/europeanresolve/er-calendar-bridge:1.0.0` matches v1.0 milestone.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine | Local pilot, CI build | ✓ (dev machine) | 29.7.2 | CI uses ubuntu-latest + buildx |
| Docker Compose V2 | `compose.yaml` | ✓ (with Docker Desktop / plugin) | — | Document install link |
| Node.js 24 | Image runtime | ✓ in image | 24-alpine | — |
| GitHub Actions | `docker-build` | ✓ on push/PR | hosted | — |
| GHCR | Image pull/push | ✓ (with `packages: write`) | — | None for pilot |
| Live CalDAV/Google/SMTP | Runtime sync | Operator-provided | — | Not needed for CI TEST-05 |

**Missing dependencies with no fallback:**
- None for CI image build path.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^5.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test && npm run lint && npm run typecheck && npm run build` |
| Docker gate | `docker build -t er-calendar-bridge:ci .` (CI `docker-build` job) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-05 | Unit/integration tests without live credentials | unit/integration | `npm test` | ✅ existing suite |
| TEST-05 | Docker image builds without provider secrets | CI integration | `docker build` in `docker-build` job | ❌ Wave 0 |
| SEC-05 | File secret provider maps Compose names → env | unit | `npm test -- test/secrets/file-provider.test.ts` | ❌ Wave 0 |
| SEC-02 | Secret values not echoed in config errors | unit | extend `test/config/env.test.ts` | ✅ partial |
| SYNC-17 | Compose file valid syntax | smoke | `docker compose config` (CI or local) | ❌ Wave 0 |
| OPS-02 | No hardcoded host paths in `src/` | static | `rg '/Users/|/home/' src/` empty | ✅ verified |
| SYNC-18 | Offboarding steps documented | manual/doc | Review runbook checklist | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` (+ `npm run typecheck` if touching `src/secrets/`)
- **Per wave merge:** Full npm gate + `docker build` locally when Dockerfile changes
- **Phase gate:** CI green including `docker-build`; operator UAT: `docker compose up` with real secrets (manual)

### Wave 0 Gaps

- [ ] `Dockerfile` + `.dockerignore`
- [ ] `compose.yaml` + `.env.example` updates (`IMAGE`, `DATA_DIR`)
- [ ] `src/secrets/*` + wire into `main()` / `loadConfig` entry
- [ ] `test/secrets/file-provider.test.ts`
- [ ] `.gitignore` — `secrets/`, `data/`
- [ ] `.github/workflows/ci.yml` — `docker-build` job
- [ ] Runbook: offboarding (SYNC-18) + Docker pilot / migration / Google re-auth (D-09, D-21)
- [ ] `package.json` version bump to `1.0.0` (recommended)
- [ ] GHCR package visibility → public (one-time operator/GitHub setting)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | partial | OAuth refresh token via secret files; host re-auth (D-07) |
| V3 Session Management | no | Long-lived refresh token; no server sessions |
| V4 Access Control | partial | Per-member secret dirs; one container per member (SYNC-17) |
| V5 Input Validation | yes | Existing Zod `loadConfig`; trim secret file reads |
| V6 Cryptography | partial | TLS to providers (Node defaults); **at-rest** = host encryption + gitignore (SEC-02), not app-layer crypto for files |

### Known Threat Patterns for Docker + Node CLI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret committed to git | Information Disclosure | `.gitignore` + CI no secrets; review |
| Secret in image layer | Information Disclosure | Runtime mounts only; scan with `docker history` in review |
| Over-privileged `GITHUB_TOKEN` | Elevation | Job-scoped `packages: write` only on `docker-build` |
| Credential env vars in `docker inspect` | Information Disclosure | Compose secrets as files; avoid env for passwords (D-01) |
| Supply-chain compromised action | Tampering | Pin actions to SHAs from GitHub docs |
| Container runs as root | Elevation | `USER node` (D-16) |

## Sources

### Primary (HIGH confidence)
- [Docker Compose secrets](https://docs.docker.com/compose/use-secrets/) — mount semantics, `/run/secrets/<name>`, Linux-only note
- [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) — `ghcr.io`, labels, visibility
- [Publishing Docker images (Actions)](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images) — login/build-push/metadata pattern, `packages: write`
- [Dockerfile reference — USER](https://docs.docker.com/reference/dockerfile/) — non-root execution
- Repo: `src/config/env.ts`, `src/index.ts`, `.github/workflows/ci.yml`, `package.json`, `.gitignore`

### Secondary (MEDIUM confidence)
- `.planning/phases/05-docker-packaging-and-local-pilot-deployment/05-CONTEXT.md` — locked decisions
- `.planning/phases/01.1-ci-pipeline/01.1-RESEARCH.md` — fifth job extension point
- `.planning/research/ARCHITECTURE.md` — deployment sketch, `secrets/` module intent

### Tertiary (LOW confidence)
- `better-sqlite3` Alpine build specifics — validate in Dockerfile spike (A1)
- External `it-strategy/er-calendar-bridge/*.md` — not present in workspace clone (A5)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — official Docker + GitHub docs, existing Node 24 toolchain
- Architecture: **HIGH** — CONTEXT locks Compose secrets, bind mounts, GHCR, watch CMD
- Pitfalls: **MEDIUM** — native module on Alpine needs build verification

**Research date:** 2026-09-16  
**Valid until:** 2026-10-16 (GHCR/Actions stable); re-check Alpine/native if Node or better-sqlite3 minor bumps

## RESEARCH COMPLETE

**Phase:** 05 - docker-packaging-and-local-pilot-deployment  
**Confidence:** HIGH

### Key Findings
- Package existing `sync --watch` CLI; add `src/secrets/` file provider mapping Compose `/run/secrets/*` → `loadConfig` inputs (SEC-05).
- Multi-stage `node:24-alpine` with build tools for `better-sqlite3`; non-root `USER node`; no `ports:` (D-11/D-16/D-17).
- Fifth CI job `docker-build` with `needs` on four jobs; push to `ghcr.io/europeanresolve/er-calendar-bridge` on `main` only; semver from `package.json` recommended.
- Bind mount `./data/operator` → `DATA_DIR`; gitignore `secrets/` and `data/` (current `.gitignore` gap).
- ROADMAP criteria on named volumes and no GHCR push are superseded by CONTEXT — follow discuss-phase decisions.

### File Created
`.planning/phases/05-docker-packaging-and-local-pilot-deployment/05-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Official Docker/GitHub documentation |
| Architecture | HIGH | Locked CONTEXT + existing env/CLI patterns |
| Pitfalls | MEDIUM | Native module on Alpine unverified in this repo until Dockerfile exists |

### Ready for Planning
Research complete. Open questions resolved above. Planner can now create PLAN.md files.
