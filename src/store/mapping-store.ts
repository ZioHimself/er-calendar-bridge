/**
 * SQLite event_mappings use (source_uid, recurrence_id) as the primary key.
 * Master events store recurrence_id as '' (empty string) because SQLite treats
 * NULL as distinct in UNIQUE/PK constraints (D-06).
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export type MappingStatus = 'active' | 'cancelled';

export interface EventMappingRow {
  sourceUid: string;
  recurrenceId?: string;
  bridgeUuid: string;
  googleEventId: string;
  googleRecurringEventId?: string;
  status: MappingStatus;
  lastSyncedAt: string;
  lastSourceEtag?: string;
  caldavHref?: string;
}

export interface MappingStore {
  getMapping(params: {
    uid: string;
    recurrenceId?: Date | string;
  }): EventMappingRow | undefined;
  upsertMapping(params: {
    uid: string;
    recurrenceId?: Date | string;
    googleEventId: string;
    googleRecurringEventId?: string;
    bridgeUuid?: string;
    status: MappingStatus;
    lastSourceEtag?: string;
    caldavHref?: string;
  }): void;
  markCancelled(params: { uid: string; recurrenceId?: Date | string }): void;
  upsertHrefSnapshot(params: {
    href: string;
    sourceUid: string;
    etag?: string;
  }): void;
  resolveUidByHref(href: string): string | undefined;
  listHrefSnapshots(): Array<{ href: string; etag?: string }>;
  deleteHrefSnapshot(href: string): void;
  close(): void;
}

const SCHEMA_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'schema.sql',
);

function loadSchema(db: Database.Database): void {
  const ddl = readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(ddl);
}

function normalizeRecurrenceKey(recurrenceId?: Date | string): string {
  if (recurrenceId === undefined) {
    return '';
  }
  if (recurrenceId instanceof Date) {
    return recurrenceId.toISOString();
  }
  return recurrenceId;
}

function rowFromDb(row: {
  source_uid: string;
  recurrence_id: string;
  bridge_uuid: string;
  google_event_id: string;
  google_recurring_event_id: string | null;
  status: MappingStatus;
  last_synced_at: string;
  last_source_etag: string | null;
  caldav_href: string | null;
}): EventMappingRow {
  return {
    sourceUid: row.source_uid,
    recurrenceId: row.recurrence_id === '' ? undefined : row.recurrence_id,
    bridgeUuid: row.bridge_uuid,
    googleEventId: row.google_event_id,
    googleRecurringEventId: row.google_recurring_event_id ?? undefined,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
    lastSourceEtag: row.last_source_etag ?? undefined,
    caldavHref: row.caldav_href ?? undefined,
  };
}

export function openMappingStore(sqlitePath: string): MappingStore {
  if (sqlitePath !== ':memory:') {
    mkdirSync(dirname(sqlitePath), { recursive: true });
  }

  const db = new Database(sqlitePath);
  loadSchema(db);

  const selectMapping = db.prepare(`
    SELECT source_uid, recurrence_id, bridge_uuid, google_event_id,
           google_recurring_event_id, status, last_synced_at,
           last_source_etag, caldav_href
    FROM event_mappings
    WHERE source_uid = ? AND recurrence_id = ?
  `);

  const upsertStmt = db.prepare(`
    INSERT INTO event_mappings (
      source_uid, recurrence_id, bridge_uuid, google_event_id,
      google_recurring_event_id, status, last_synced_at,
      last_source_etag, caldav_href
    ) VALUES (
      @source_uid, @recurrence_id, @bridge_uuid, @google_event_id,
      @google_recurring_event_id, @status, @last_synced_at,
      @last_source_etag, @caldav_href
    )
    ON CONFLICT(source_uid, recurrence_id) DO UPDATE SET
      google_event_id = excluded.google_event_id,
      google_recurring_event_id = excluded.google_recurring_event_id,
      status = excluded.status,
      last_synced_at = excluded.last_synced_at,
      last_source_etag = excluded.last_source_etag,
      caldav_href = COALESCE(excluded.caldav_href, event_mappings.caldav_href),
      bridge_uuid = event_mappings.bridge_uuid
  `);

  const markCancelledStmt = db.prepare(`
    UPDATE event_mappings
    SET status = 'cancelled', last_synced_at = @last_synced_at
    WHERE source_uid = @source_uid AND recurrence_id = @recurrence_id
  `);

  const upsertHrefStmt = db.prepare(`
    INSERT INTO source_href_snapshot (href, source_uid, etag)
    VALUES (@href, @source_uid, @etag)
    ON CONFLICT(href) DO UPDATE SET
      source_uid = excluded.source_uid,
      etag = excluded.etag
  `);

  const resolveHrefStmt = db.prepare(`
    SELECT source_uid FROM source_href_snapshot WHERE href = ?
  `);

  const listHrefSnapshotsStmt = db.prepare(`
    SELECT href, etag FROM source_href_snapshot
  `);

  const deleteHrefStmt = db.prepare(`
    DELETE FROM source_href_snapshot WHERE href = ?
  `);

  const upsertTransaction = db.transaction(
    (params: {
      uid: string;
      recurrenceId?: Date | string;
      googleEventId: string;
      googleRecurringEventId?: string;
      bridgeUuid?: string;
      status: MappingStatus;
      lastSourceEtag?: string;
      caldavHref?: string;
    }) => {
      const recurrenceKey = normalizeRecurrenceKey(params.recurrenceId);
      const existing = selectMapping.get(params.uid, recurrenceKey) as
        | {
            bridge_uuid: string;
          }
        | undefined;

      const bridgeUuid = params.bridgeUuid ?? existing?.bridge_uuid ?? randomUUID();
      const lastSyncedAt = new Date().toISOString();

      upsertStmt.run({
        source_uid: params.uid,
        recurrence_id: recurrenceKey,
        bridge_uuid: bridgeUuid,
        google_event_id: params.googleEventId,
        google_recurring_event_id: params.googleRecurringEventId ?? null,
        status: params.status,
        last_synced_at: lastSyncedAt,
        last_source_etag: params.lastSourceEtag ?? null,
        caldav_href: params.caldavHref ?? null,
      });
    },
  );

  return {
    getMapping({ uid, recurrenceId }) {
      const recurrenceKey = normalizeRecurrenceKey(recurrenceId);
      const row = selectMapping.get(uid, recurrenceKey);
      if (!row) {
        return undefined;
      }
      return rowFromDb(row as Parameters<typeof rowFromDb>[0]);
    },

    upsertMapping(params) {
      upsertTransaction(params);
    },

    markCancelled({ uid, recurrenceId }) {
      const recurrenceKey = normalizeRecurrenceKey(recurrenceId);
      markCancelledStmt.run({
        source_uid: uid,
        recurrence_id: recurrenceKey,
        last_synced_at: new Date().toISOString(),
      });
    },

    upsertHrefSnapshot({ href, sourceUid, etag }) {
      upsertHrefStmt.run({
        href,
        source_uid: sourceUid,
        etag: etag ?? null,
      });
    },

    resolveUidByHref(href) {
      const row = resolveHrefStmt.get(href) as { source_uid: string } | undefined;
      return row?.source_uid;
    },

    listHrefSnapshots() {
      const rows = listHrefSnapshotsStmt.all() as Array<{
        href: string;
        etag: string | null;
      }>;
      return rows.map((row) => ({
        href: row.href,
        etag: row.etag ?? undefined,
      }));
    },

    deleteHrefSnapshot(href) {
      deleteHrefStmt.run(href);
    },

    close() {
      db.close();
    },
  };
}
