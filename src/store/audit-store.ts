/**
 * Withhold notify state and append-only audit log (SYNC-16, OPS-03).
 * Master events use recurrence_id '' (empty string) — same rule as event_mappings (D-06).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export type NotifyStatus = 'sent' | 'skipped' | 'failed' | 'disabled';

export interface WithholdNotifyStateRow {
  sourceUid: string;
  recurrenceId?: string;
  bridgeUuid: string;
  lastPropagation: string;
  episode: number;
}

export interface WithholdAuditRow {
  id: number;
  recordedAt: string;
  sourceUid: string;
  recurrenceId?: string;
  tier: string;
  propagation: string;
  notifyStatus: NotifyStatus;
  dedupKey: string;
  error?: string;
}

export interface AuditStore {
  getNotifyState(params: {
    uid: string;
    recurrenceId?: Date | string;
  }): WithholdNotifyStateRow | undefined;
  upsertNotifyState(params: {
    uid: string;
    recurrenceId?: Date | string;
    bridgeUuid: string;
    lastPropagation: string;
    episode: number;
  }): void;
  appendAuditRow(params: {
    uid: string;
    recurrenceId?: Date | string;
    tier: string;
    propagation: string;
    notifyStatus: NotifyStatus;
    dedupKey: string;
    error?: string;
  }): void;
  listAuditSince(sinceIso: string): WithholdAuditRow[];
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

function notifyStateFromDb(row: {
  source_uid: string;
  recurrence_id: string;
  bridge_uuid: string;
  last_propagation: string;
  episode: number;
}): WithholdNotifyStateRow {
  return {
    sourceUid: row.source_uid,
    recurrenceId: row.recurrence_id === '' ? undefined : row.recurrence_id,
    bridgeUuid: row.bridge_uuid,
    lastPropagation: row.last_propagation,
    episode: row.episode,
  };
}

function auditRowFromDb(row: {
  id: number;
  recorded_at: string;
  source_uid: string;
  recurrence_id: string;
  tier: string;
  propagation: string;
  notify_status: NotifyStatus;
  dedup_key: string;
  error: string | null;
}): WithholdAuditRow {
  return {
    id: row.id,
    recordedAt: row.recorded_at,
    sourceUid: row.source_uid,
    recurrenceId: row.recurrence_id === '' ? undefined : row.recurrence_id,
    tier: row.tier,
    propagation: row.propagation,
    notifyStatus: row.notify_status,
    dedupKey: row.dedup_key,
    error: row.error ?? undefined,
  };
}

export function openAuditStore(sqlitePath: string): AuditStore {
  if (sqlitePath !== ':memory:') {
    mkdirSync(dirname(sqlitePath), { recursive: true });
  }

  const db = new Database(sqlitePath);
  loadSchema(db);

  const selectNotifyState = db.prepare(`
    SELECT source_uid, recurrence_id, bridge_uuid, last_propagation, episode
    FROM withhold_notify_state
    WHERE source_uid = ? AND recurrence_id = ?
  `);

  const upsertNotifyStateStmt = db.prepare(`
    INSERT INTO withhold_notify_state (
      source_uid, recurrence_id, bridge_uuid, last_propagation, episode, updated_at
    ) VALUES (
      @source_uid, @recurrence_id, @bridge_uuid, @last_propagation, @episode, @updated_at
    )
    ON CONFLICT(source_uid, recurrence_id) DO UPDATE SET
      bridge_uuid = excluded.bridge_uuid,
      last_propagation = excluded.last_propagation,
      episode = excluded.episode,
      updated_at = excluded.updated_at
  `);

  const insertAuditRow = db.prepare(`
    INSERT INTO withhold_audit (
      recorded_at, source_uid, recurrence_id, tier, propagation,
      notify_status, dedup_key, error
    ) VALUES (
      @recorded_at, @source_uid, @recurrence_id, @tier, @propagation,
      @notify_status, @dedup_key, @error
    )
  `);

  const listAuditSinceStmt = db.prepare(`
    SELECT id, recorded_at, source_uid, recurrence_id, tier, propagation,
           notify_status, dedup_key, error
    FROM withhold_audit
    WHERE recorded_at >= ?
    ORDER BY recorded_at ASC, id ASC
  `);

  return {
    getNotifyState({ uid, recurrenceId }) {
      const recurrenceKey = normalizeRecurrenceKey(recurrenceId);
      const row = selectNotifyState.get(uid, recurrenceKey);
      if (!row) {
        return undefined;
      }
      return notifyStateFromDb(row as Parameters<typeof notifyStateFromDb>[0]);
    },

    upsertNotifyState(params) {
      const recurrenceKey = normalizeRecurrenceKey(params.recurrenceId);
      upsertNotifyStateStmt.run({
        source_uid: params.uid,
        recurrence_id: recurrenceKey,
        bridge_uuid: params.bridgeUuid,
        last_propagation: params.lastPropagation,
        episode: params.episode,
        updated_at: new Date().toISOString(),
      });
    },

    appendAuditRow(params) {
      const recurrenceKey = normalizeRecurrenceKey(params.recurrenceId);
      insertAuditRow.run({
        recorded_at: new Date().toISOString(),
        source_uid: params.uid,
        recurrence_id: recurrenceKey,
        tier: params.tier,
        propagation: params.propagation,
        notify_status: params.notifyStatus,
        dedup_key: params.dedupKey,
        error: params.error ?? null,
      });
    },

    listAuditSince(sinceIso) {
      const rows = listAuditSinceStmt.all(sinceIso) as Parameters<
        typeof auditRowFromDb
      >[0][];
      return rows.map(auditRowFromDb);
    },

    close() {
      db.close();
    },
  };
}
