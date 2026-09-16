# Phase 5: Docker packaging and local pilot deployment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `05-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 05-docker-packaging-and-local-pilot-deployment
**Title:** GSD Discuss Docker 5
**Areas discussed:** Secrets, Google OAuth, Compose layout, Runtime, Host migration, Offboarding, CI/GHCR, Docker base image

---

## Secrets delivery

| Option | Description | Selected |
|--------|-------------|----------|
| `.env` + `env_file` | Simplest laptop pilot | |
| Compose `secrets:` | Files under `./secrets/`, not in git | ✓ |
| sops+age | Encrypted files decrypted on host | |
| Per-tenant bundle | One env file per member | |
| Per-secret files | One file per key under `secrets/operator/` | ✓ |

**User's choice:** Compose secrets; **per-secret** files under `secrets/operator/` (copy folder for new member). All sensitive values as secrets. Thin accessor wrapper for future Vault. Single compose with copy-paste service example.

---

## Google OAuth in container

| Option | Description | Selected |
|--------|-------------|----------|
| Refresh token in secret file | Mounted read-only | ✓ |
| Token on DATA_DIR volume | Writable persistence | |
| Host CLI re-auth | Outside container | ✓ |
| Separate secret files for client id/secret | Same pattern as other secrets | ✓ |
| Service account / delegation | Server trust model | Rejected for v1 (personal accounts) |

**Notes:** User asked about scopes for “trusted device” renewal — clarified Calendar scopes don't add device trust; offline refresh token + active sync + host re-auth when revoked. Locked personal-account refresh-token path only.

---

## Compose layout

| Option | Description | Selected |
|--------|-------------|----------|
| Bind mount `./data/operator` | Host-visible SQLite | ✓ |
| Single `compose.yaml` | Commented blocks to copy | ✓ |
| Default bridge network | No inbound ports | ✓ |
| GHCR image via env | `IMAGE` in `.env` | ✓ |

---

## Runtime / entrypoint

| Option | Description | Selected |
|--------|-------------|----------|
| `sync --watch` + interval from env | Continuous sync | ✓ |
| `unless-stopped` | Auto-restart | ✓ |
| JSON stdout | Structured logs | ✓ |
| Non-root container user | Hardening | ✓ |

---

## Host migration

| Option | Description | Selected |
|--------|-------------|----------|
| No hardcoded paths in image | OPS-02 portability | ✓ |
| File secrets only in Phase 5 | Vault later | ✓ |
| Copy refresh token secret on migrate | | ✓ |
| Server `.env` for non-secrets | | ✓ |

---

## Offboarding (SYNC-18)

| Option | Description | Selected |
|--------|-------------|----------|
| Runbook only | Revoke, compose down, manual Google cleanup | ✓ |
| No automated Google mass-delete | Safety | ✓ |

**Claude's discretion:** Optional manual `bridge.db` copy before deleting data directory.

---

## CI / GHCR

| Option | Description | Selected |
|--------|-------------|----------|
| Build + push on `main` | Semver tag (CI-driven) | ✓ |
| Public GHCR package | | ✓ |
| Stable `IMAGE` in `.env.example` | | ✓ |
| Required on each trunk commit | No PR workflow | ✓ |

---

## Docker base image

| Option | Description | Selected |
|--------|-------------|----------|
| `node:24-alpine` multi-stage | Matches CI Node 24 | ✓ |

---

## Claude's Discretion

- Env var naming for secrets mapping, sync interval, semver tagging source, CI job ordering, runbook outline.

## Deferred Ideas

- Workspace service-account delegation; Vault backend; bulk Google delete CLI; Phase 6 Graph in Docker.
