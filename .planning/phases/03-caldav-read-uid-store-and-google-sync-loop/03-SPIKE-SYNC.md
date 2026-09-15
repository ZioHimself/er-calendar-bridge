# mailbox.org CalDAV sync spike (Wave 0)

## Date

2026-09-15 (research synthesis — live operator run pending)

## Calendar URL

Per D-01: single `MAILBOX_CALENDAR_URL` (per-calendar collection under `https://dav.mailbox.org/caldav/<id>/`, not server root only). Operator should re-run `npm run spike:mailbox-sync` with read-only app password to confirm.

## sync-collection supported (Y/N)

**Likely N** for many mailbox.org accounts (MEDIUM confidence). Ecosystem evidence: Planify PR #2368 and DAVx⁵ docs report **403** or missing `sync-collection` on German-hosted stacks including mailbox.org; clients fall back to `calendar-query` + CTag/basic diff.

**Operator validation:** PROPFIND `DAV:supported-report-set` on the configured collection; confirm whether `sync-collection` is listed and whether REPORT returns 200 vs 403.

## HTTP codes

| Step | Expected without live run | Operator should record |
|------|---------------------------|-------------------------|
| PROPFIND supported-report-set | 200 | Actual status |
| REPORT sync-collection (if tried) | **403** (hypothesis) | 200 / 403 / 501 |
| Basic / CTag path | 200 | 200 |

## recommended `degraded_mode`

**`basic_sync`** — implement CalDAV reader with tsdav `smartCollectionSync` forced to method `basic` until live spike proves `webdav_sync`.

Rationale:

1. RESEARCH cites mailbox.org-class servers often rejecting RFC 6578 sync-collection.
2. tsdav `smartCollectionSync` already selects `basic` when `syncCollection` is absent from collection reports.
3. Persist `degraded_mode` in `sync_state` (plan 03-03) so 03-04 can branch without re-probing every cycle.

**Upgrade path:** If operator spike shows sync-collection advertised and sync-token updates on trial sync, switch recommendation to **`webdav_sync`** and store initial `sync_token`.

**Escalation:** If `basic_sync` tombstones are incomplete (D-05 gaps), use **`snapshot_diff`** (full `calendar-query` + local href set compare) while still honoring cancel-not-delete on Google (D-04).

## Tombstone discovery notes (D-05)

- **webdav_sync path:** RFC 6578 + tsdav map deleted members as **404** on member hrefs (HIGH confidence from tsdav/RFC).
- **basic_sync path:** Deletions inferred from CTag/object-list diff; verify whether removed UIDs surface as `deleted` objects in `smartCollectionSyncDetailed` on mailbox.org.
- **Operator:** Delete or move one test event on source, re-run spike, note whether `objects.deleted` increments and hrefs are present.

## Payload size observation (SYNC-13 horizon)

mailbox.org is documented (~community) to return roughly **~1 year** of events via CalDAV query; no client-side far-future filter in Phase 3 (D-20). Operator should log approximate `created + updated` object counts and whether responses feel full-fetch sized on first `basic` sync.

## Live spike command

```bash
cp .env.example .env   # fill MAILBOX_* including MAILBOX_CALENDAR_URL
npm run spike:mailbox-sync
```

Script is read-only (no tsdav write APIs). Passwords are never logged.
