-- event_mappings: composite key (source_uid, recurrence_id).
-- Master rows use recurrence_id '' (empty string); instances use ISO UTC RECURRENCE-ID.

CREATE TABLE IF NOT EXISTS event_mappings (
  source_uid TEXT NOT NULL,
  recurrence_id TEXT NOT NULL DEFAULT '',
  bridge_uuid TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  google_recurring_event_id TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')),
  last_synced_at TEXT NOT NULL,
  last_source_etag TEXT NULL,
  caldav_href TEXT NULL,
  PRIMARY KEY (source_uid, recurrence_id)
);

CREATE TABLE IF NOT EXISTS sync_state (
  calendar_url TEXT PRIMARY KEY,
  sync_token TEXT NULL,
  ctag TEXT NULL,
  last_success_at TEXT NULL,
  last_error TEXT NULL,
  degraded_mode TEXT NULL
);

CREATE TABLE IF NOT EXISTS source_href_snapshot (
  href TEXT PRIMARY KEY,
  source_uid TEXT NOT NULL,
  etag TEXT NULL
);
