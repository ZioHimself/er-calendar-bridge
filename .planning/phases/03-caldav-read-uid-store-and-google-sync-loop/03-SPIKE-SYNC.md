# mailbox.org CalDAV sync spike (Wave 0)

## Date

_(pending operator run — fill after `npm run spike:mailbox-sync`)_

## Calendar URL

_(redacted path only — per-calendar collection URL, not server root)_

## sync-collection supported (Y/N)

_(pending)_

## HTTP codes

_(pending — note 403 on sync-collection vs 200)_

## recommended `degraded_mode`

Choose one for plan 03-04 implementer:

- `webdav_sync` — RFC 6578 sync-token deltas via tsdav `smartCollectionSync` method `webdav`
- `basic_sync` — CTag / object-list diff via tsdav `smartCollectionSync` method `basic`
- `snapshot_diff` — full calendar-query fetch + local snapshot compare (fallback if basic insufficient for tombstones)

_(pending operator observation)_

## Tombstone discovery notes (D-05)

_(Do removed events appear as 404 hrefs in sync-collection? Any gaps requiring snapshot_diff?)_

## Payload size observation (SYNC-13 horizon)

_(Approximate object count / response size at ~1y horizon if observable)_
