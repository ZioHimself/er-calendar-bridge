# Project Research Summary

**Project:** ER Calendar Bridge
**Domain:** TypeScript calendar sync service (CalDAV read → Google write; Graph deferred to v1.1)
**Researched:** 2026-09-11
**Confidence:** HIGH

## Executive Summary

Build a **thin TypeScript orchestrator** around maintained protocol clients — not a hosted third-party bridge. The hard core is three-protocol translation with a fail-closed classification layer; recurrence reconciliation is the highest-risk area and needs fixture-driven tests before multi-member rollout.

Python is excluded: strict TypeScript gives compile-time safety across iCal parsing, classification enums, and REST payload construction — the exact surfaces where silent data leaks happen.

## Key Findings

### Recommended Stack

- **Node 24 LTS + TypeScript strict** — runtime and language
- **tsdav** — CalDAV read (verify sync-collection on mailbox.org in spike)
- **node-ical** (via `src/adapters/ical/`) — parse VEVENT → `SourceEvent`
- **googleapis** — v1.0 write target; **@microsoft/microsoft-graph-client** — v1.1
- **better-sqlite3** — per-container UID mapping
- **zod + pino + nodemailer** — config, observability, withhold notifications

### Expected Features

**Must have (v1.0):** one-way sync to Google, tier classification, washing, idempotency, recurrence, read-only source, per-member isolation, pilot mode, withhold notifications, offboarding.

**v1.1:** Microsoft Graph write path mirroring Google.

**Defer:** Vault runtime, Prometheus, multi-member automation (post-pilot).

**Never build:** two-way sync, write-back tags, shared calendar, K8s, Python stack.

### Architecture Approach

Single-process container per member. Pure-function pipeline: **read → parse → classify → wash → map → write → notify**. Domain types and writer interface keep Google/Graph adapters swappable.

**Build order:** classify/wash (pure) → store → caldav → google writer → sync loop → notify → docker → graph (v1.1).

### Critical Pitfalls

1. Recurrence exceptions — fixture tests mandatory
2. Untagged full disclosure — fail-closed classifier + no passthrough
3. Restart duplicates — SQLite UID map
4. PII in busy-blocks — field whitelist only
5. tsdav sync semantics — spike mailbox.org before assuming efficiency

## Roadmap Implications

Aligned with `.planning/ROADMAP.md` (updated 2026-09-13):

| Phase | Focus | Milestone |
|-------|-------|-----------|
| 1 — Scaffold | TypeScript, vitest, iCal fixtures | — |
| 01.1 — CI | GitHub Actions test/lint/typecheck | — |
| 2 — Domain | classify, wash (pure TS) | — |
| 3 — Google sync | UID store, Google writer, sync loop | — |
| 4 — Notify | SMTP withhold alerts, audit log | — |
| 5 — Docker | Compose pilot deployment | **v1.0 complete** |
| 6 — Graph | Microsoft writer, dual UID mapping | v1.1 |

## Language Decision

**TypeScript only.** Aligns with european-resolve tooling, enforces typed boundaries on security-critical washing logic, and avoids Python's weak static guarantees on nested calendar structures.
