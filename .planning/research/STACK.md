# Stack Research

**Domain:** CalDAV-read / Google+Graph-write calendar sync bridge
**Language constraint:** TypeScript only
**Researched:** 2026-09-11
**Confidence:** HIGH (core SDKs), MEDIUM (mailbox.org CalDAV sync-collection — verify in spike)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 24 LTS | Runtime | Active LTS ("Krypton"); native fetch; all stack deps support ≥ 22 |
| TypeScript | 5.x (strict) | Language | End-to-end types across iCal ↔ REST translation |
| tsdav | 2.3.x | CalDAV read | Native TS, maintained, Basic auth for mailbox.org app passwords |
| googleapis | latest | Google Calendar write | Official client; `calendar_v3` types built-in |
| @microsoft/microsoft-graph-client | 3.0.x | Graph write | Official client; pairs with `@microsoft/microsoft-graph-types` |
| node-ical | 0.27.x | iCal parse (via adapter) | Battle-tested RFC 5545 parser; strict `SourceEvent` mapping in `src/adapters/ical/` |
| better-sqlite3 | ≥ 12.1.0 | UID mapping store | Per-container SQLite; Node 24 prebuilds from 12.1.0+ |
| zod | latest | Config validation | Typed env/secrets at container startup |
| nodemailer | latest | Withhold notifications | SMTP for owner nudge + IT audit |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @martinhipp/rrule | latest | Recurrence expansion | Series/exception reconciliation tests |
| google-auth-library | latest | Google OAuth | Refresh tokens, calendar scope only |
| @azure/identity | latest | Graph auth | `ClientSecretCredential` or device-code for pilot |
| pino | latest | Structured logging | Per-sync-cycle observability |
| vitest | latest | Tests | Same runner as european-resolve |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tsx | Dev runner | `tsx src/index.ts` without compile step |
| tsc | Build | `tsc -p tsconfig.json` → `dist/` for Docker |
| eslint + typescript-eslint | Lint | Strict TS rules |
| docker compose | Local pilot | One service per member |

## Installation

```bash
npm install tsdav googleapis @microsoft/microsoft-graph-client \
  @microsoft/microsoft-graph-types google-auth-library @azure/identity \
  node-ical @martinhipp/rrule better-sqlite3 zod nodemailer pino

npm install -D typescript tsx vitest @types/node @types/better-sqlite3 \
  @types/nodemailer eslint typescript-eslint
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| tsdav | ts-caldav | If tsdav lacks mailbox.org `sync-collection`; spike first |
| node-ical + adapter | @pipobscure/ical | node-ical chosen for adoption/maturity; type safety via `SourceEvent` adapter layer |
| googleapis | @googleapis/calendar | Smaller install if only Calendar API needed |
| better-sqlite3 | JSON file | JSON risks corruption on crash; SQLite gives atomic writes |
| Custom orchestrator | Hosted sync bridge | Third party holds credentials — rejected per security posture |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Python (caldav, icalendar, etc.) | Weak static typing on nested iCal structures | TypeScript strict + node-ical adapter |
| Hosted sync bridges (Cronofy, etc.) | Fourth party with credential + calendar access | Self-hosted Docker bridge |
| Hand-rolled RRULE parser | Recurrence bugs are subtle and costly | @martinhipp/rrule + fixture tests |
| Shared secrets file across members | Violates per-member isolation | Docker secrets per service |
| Full googleapis monolith import | Larger bundle if tree-shaking fails | `@googleapis/calendar` if size matters |

## Stack Patterns by Variant

**Pilot (laptop, one member):**
- Single Compose service
- Secrets via `.env` excluded from git + sops/age file
- SQLite volume bind-mounted for UID map persistence

**Production (org server):**
- Same image, N Compose services
- Secrets from Vault/OpenBao adapter
- Health endpoint: last sync time + withhold count

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Node 24 | better-sqlite3 ≥ 12.1.0 | Prebuilt binaries available; fallback to node-gyp in Docker |
| Node 24 | googleapis, google-auth-library, @azure/identity | All require Node ≥ 22 |
| tsdav 2.x | Node ≥ 18 | Uses native fetch |
| googleapis | google-auth-library | OAuth2Client for refresh |
| @microsoft/microsoft-graph-client 3.x | @azure/identity | `TokenCredentialAuthenticationProvider` |
| vitest 5.x | Node ^22.12 \|\| ^24 \|\| ≥26 | Explicit Node 24 support |

## Open Spike Items

1. **mailbox.org CalDAV sync** — confirm `sync-collection` / ETag change detection via tsdav or raw REPORT
2. **Graph recurrence** — map `calendar_v3.Schema$Event` recurrence ↔ `microsoft-graph-types` Event series
3. **App-password scope** — verify calendar-only scoping at generation (architecture Appendix B)
