# Architecture Research

**Domain:** TypeScript calendar sync bridge
**Researched:** 2026-09-11
**Confidence:** HIGH

## Component Model

```
┌─────────────────────────────────────────────────────────┐
│  er-calendar-bridge (one Docker container per member)   │
├─────────────────────────────────────────────────────────┤
│  Scheduler ──► SyncOrchestrator (single loop)           │
│       │              │                                  │
│       │    ┌─────────┼─────────┬──────────┐           │
│       │    ▼         ▼         ▼          ▼           │
│       │  CalDAV   Classifier  Washer   Notifier       │
│       │  Reader                                      │
│       │    │         │         │          │           │
│       │    └────┬────┘         │          │           │
│       │         ▼              ▼          ▼           │
│       │    EventStore     Outbound     SMTP           │
│       │    (SQLite)       Writers                     │
│       │                   ├─ GoogleWriter               │
│       │                   └─ GraphWriter              │
└─────────────────────────────────────────────────────────┘
```

## Module Boundaries (`src/`)

| Module | Responsibility | Depends on |
|--------|----------------|------------|
| `caldav/` | Fetch calendars/objects, ETag tracking | tsdav |
| `ical/` | Parse VEVENT, extract CATEGORIES/UID/times | @pipobscure/ical |
| `classify/` | Map CATEGORIES → `Public \| Internal \| Sensitive` | pure TS |
| `wash/` | Build outbound busy-block or full event | classify types |
| `writers/google/` | Create/update/delete via Calendar API | googleapis |
| `writers/graph/` | Create/update/delete via Graph | graph client |
| `store/` | UID map, sync tokens, notification dedup | better-sqlite3 |
| `notify/` | SMTP withhold alerts | nodemailer |
| `secrets/` | Load credentials (env / sops / vault adapter) | zod |
| `sync/` | Orchestration loop, error handling | all above |

## Data Flow

1. **Poll** mailbox.org via CalDAV (ETag / sync-token delta)
2. **Parse** each changed VEVENT → typed `SourceEvent`
3. **Classify** → `PropagationDecision` (full / busy / drop)
4. **Wash** if not full → `OutboundEvent` with only allowed fields
5. **Lookup** source UID in SQLite → Google eventId, Graph eventId
6. **Write** create/update/delete to each enabled target
7. **Notify** owner if withheld/downgraded (deduped in store)
8. **Persist** mapping + last-sync metadata

## Suggested Build Order

| Order | Component | Rationale |
|-------|-----------|-----------|
| 1 | `ical/` + `classify/` + `wash/` | Pure functions; testable without network |
| 2 | `store/` | UID map needed before any writer |
| 3 | `caldav/` | Read path; spike mailbox.org quirks |
| 4 | `writers/google/` | Pilot likely Google-first |
| 5 | `sync/` loop | Wire read → classify → write |
| 6 | `writers/graph/` | Second target; reuse patterns |
| 7 | `notify/` | After withhold path proven |
| 8 | Docker + secrets | Deployment hardening |

## TypeScript Patterns

- **Domain types first** — `SourceEvent`, `OutboundEvent`, `Tier`, `PropagationDecision` in `src/types/`
- **No `any`** — parse iCal into typed structures before business logic
- **Writer interface** — `CalendarWriter { upsert(e), delete(uid) }` implemented by Google/Graph
- **Fail-closed classifier** — `default: 'internal'`; only `'public'` when `ER-PUBLIC` present
- **Idempotent upsert** — always key on source UID, never on title/time alone

## Deployment

- Multi-stage Dockerfile: `node:24-alpine` build → slim runtime
- Compose: `bridge-operator` service (pilot), later `bridge-{member}` per person
- One SQLite file per container volume
- No shared state between members
