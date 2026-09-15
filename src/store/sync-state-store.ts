import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export interface SyncStateRow {
  calendarUrl: string;
  syncToken?: string;
  ctag?: string;
  lastSuccessAt?: string;
  lastError?: string;
  degradedMode?: string;
}

export interface SyncStateStore {
  getSyncState(calendarUrl: string): SyncStateRow | undefined;
  updateSyncState(params: {
    calendarUrl: string;
    syncToken?: string | null;
    ctag?: string | null;
    lastSuccessAt?: string | null;
    lastError?: string | null;
    degradedMode?: string | null;
  }): void;
  recordSuccess(calendarUrl: string, isoTimestamp: string): void;
  close(): void;
}

const SCHEMA_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'schema.sql',
);

function loadSchema(db: Database.Database): void {
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
}

function rowFromDb(row: {
  calendar_url: string;
  sync_token: string | null;
  ctag: string | null;
  last_success_at: string | null;
  last_error: string | null;
  degraded_mode: string | null;
}): SyncStateRow {
  return {
    calendarUrl: row.calendar_url,
    syncToken: row.sync_token ?? undefined,
    ctag: row.ctag ?? undefined,
    lastSuccessAt: row.last_success_at ?? undefined,
    lastError: row.last_error ?? undefined,
    degradedMode: row.degraded_mode ?? undefined,
  };
}

export function openSyncStateStore(sqlitePath: string): SyncStateStore {
  if (sqlitePath !== ':memory:') {
    mkdirSync(dirname(sqlitePath), { recursive: true });
  }

  const db = new Database(sqlitePath);
  loadSchema(db);

  const selectState = db.prepare(`
    SELECT calendar_url, sync_token, ctag, last_success_at, last_error, degraded_mode
    FROM sync_state
    WHERE calendar_url = ?
  `);

  const upsertState = db.prepare(`
    INSERT INTO sync_state (
      calendar_url, sync_token, ctag, last_success_at, last_error, degraded_mode
    ) VALUES (
      @calendar_url, @sync_token, @ctag, @last_success_at, @last_error, @degraded_mode
    )
    ON CONFLICT(calendar_url) DO UPDATE SET
      sync_token = excluded.sync_token,
      ctag = excluded.ctag,
      last_success_at = excluded.last_success_at,
      last_error = excluded.last_error,
      degraded_mode = excluded.degraded_mode
  `);

  const updateTransaction = db.transaction(
    (params: {
      calendarUrl: string;
      syncToken?: string | null;
      ctag?: string | null;
      lastSuccessAt?: string | null;
      lastError?: string | null;
      degradedMode?: string | null;
    }) => {
      const existing = selectState.get(params.calendarUrl) as
        | {
            sync_token: string | null;
            ctag: string | null;
            last_success_at: string | null;
            last_error: string | null;
            degraded_mode: string | null;
          }
        | undefined;

      const pick = <T>(next: T | null | undefined, prev: T | null | undefined) =>
        next !== undefined ? next : (prev ?? null);

      upsertState.run({
        calendar_url: params.calendarUrl,
        sync_token: pick(params.syncToken, existing?.sync_token ?? null),
        ctag: pick(params.ctag, existing?.ctag ?? null),
        last_success_at: pick(
          params.lastSuccessAt,
          existing?.last_success_at ?? null,
        ),
        last_error: pick(params.lastError, existing?.last_error ?? null),
        degraded_mode: pick(params.degradedMode, existing?.degraded_mode ?? null),
      });
    },
  );

  return {
    getSyncState(calendarUrl) {
      const row = selectState.get(calendarUrl);
      if (!row) {
        return undefined;
      }
      return rowFromDb(row as Parameters<typeof rowFromDb>[0]);
    },

    updateSyncState(params) {
      updateTransaction(params);
    },

    recordSuccess(calendarUrl, isoTimestamp) {
      updateTransaction({
        calendarUrl,
        lastSuccessAt: isoTimestamp,
        lastError: null,
      });
    },

    close() {
      db.close();
    },
  };
}
