# Project Research Summary

**Project:** ER Calendar Bridge
**Domain:** TypeScript calendar sync service (CalDAV read → Google/Graph write)
**Researched:** 2026-09-11
**Confidence:** HIGH

## Executive Summary

Build a **thin TypeScript orchestrator** around maintained protocol clients — not a hosted third-party bridge. The hard core is three-protocol translation with a fail-closed classification layer; recurrence reconciliation is the highest-risk area and needs fixture-driven tests before multi-member rollout.

Python is excluded: strict TypeScript gives compile-time safety across iCal parsing, classification enums, and REST payload construction — the exact surfaces where silent data leaks happen.

## Key Findings

### Recommended Stack

- **Node 24 LTS + TypeScript strict** — runtime and language
- **tsdav** — CalDAV read (verify sync-collection on mailbox.org in spike)
- **@pipobscure/ical** — parse VEVENT / CATEGORIES
- **googleapis + @microsoft/microsoft-graph-client** — write targets
- **better-sqlite3** — per-container UID mapping
- **zod + pino + nodemailer** — config, observability, withhold notifications

### Expected Features

**Must have:** one-way sync, tier classification, washing, idempotency, recurrence, read-only source, per-member isolation, pilot mode, offboarding.

**Defer:** Vault runtime, Prometheus, multi-member automation (post-pilot).

**Never build:** two-way sync, write-back tags, shared calendar, K8s, Python stack.

### Architecture Approach

Single-process container per member. Pure-function pipeline: **read → parse → classify → wash → map → write → notify**. Domain types and writer interface keep Google/Graph adapters swappable.

**Build order:** classify/wash (pure) → store → caldav → google writer → sync loop → graph → notify → docker.

### Critical Pitfalls

1. Recurrence exceptions — fixture tests mandatory
2. Untagged full disclosure — fail-closed classifier + no passthrough
3. Restart duplicates — SQLite UID map
4. PII in busy-blocks — field whitelist only
5. tsdav sync semantics — spike mailbox.org before assuming efficiency

## Roadmap Implications

| Phase theme | Focus |
|-------------|-------|
| 0 — Spike | mailbox.org CalDAV read + tier classification unit tests |
| 1 — Core pipeline | classify, wash, ical parse (pure TS, vitest) |
| 2 — Google pilot | UID store, Google writer, sync loop, operator calendar |
| 3 — Graph + notify | Microsoft writer, SMTP withhold, Docker Compose |
| 4 — Production hardening | Vault adapter, multi-member, offboarding tooling |

## Language Decision

**TypeScript only.** Aligns with european-resolve tooling, enforces typed boundaries on security-critical washing logic, and avoids Python's weak static guarantees on nested calendar structures.
