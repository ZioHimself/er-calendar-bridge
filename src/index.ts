import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { z } from 'zod';
import { createCalDavClient, createCalDavReader } from './adapters/caldav/index.js';
import { loadConfig, type AppConfig } from './config/env.js';
import { resolvePilotEnv } from './secrets/resolve-env.js';
import { createWithholdNotifier } from './notify/withhold-notifier.js';
import { openAuditStore, type WithholdAuditRow } from './store/audit-store.js';
import { openMappingStore } from './store/mapping-store.js';
import { openSyncStateStore } from './store/sync-state-store.js';
import { runSyncCycle } from './sync/run-sync-cycle.js';
import { createGoogleAuthClient } from './writers/google/auth.js';
import { createGoogleCalendarWriter } from './writers/google/calendar-writer.js';

export const VERSION = '0.1.5';

const AUDIT_LIST_DEFAULT_SINCE = '1970-01-01T00:00:00.000Z';

const iso8601SinceSchema = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  { message: 'expected ISO-8601 timestamp' },
);

export function printUsage(): void {
  console.log(`er-calendar-bridge v${VERSION}`);
  console.log('Usage:');
  console.log('  er-calendar-bridge sync [--watch]');
  console.log('  er-calendar-bridge audit list [--since ISO-8601]');
}

function parseAuditListSince(listArgv: string[]): { since: string } | { error: string } {
  const sinceFlagIndex = listArgv.indexOf('--since');
  if (sinceFlagIndex === -1) {
    return { since: AUDIT_LIST_DEFAULT_SINCE };
  }

  const raw = listArgv[sinceFlagIndex + 1];
  if (raw === undefined || raw.startsWith('--')) {
    return { error: 'Missing value for --since (expected ISO-8601 timestamp)' };
  }

  const parsed = iso8601SinceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: `Invalid --since value: ${parsed.error.issues[0]?.message ?? 'expected ISO-8601 timestamp'}`,
    };
  }

  return { since: new Date(raw).toISOString() };
}

function formatAuditListRow(row: WithholdAuditRow): string {
  return [
    row.sourceUid,
    row.recurrenceId ?? '',
    row.tier,
    row.propagation,
    row.notifyStatus,
    row.dedupKey,
    row.recordedAt,
  ].join('\t');
}

export function runAuditList(config: AppConfig, listArgv: string[]): number {
  const sinceResult = parseAuditListSince(listArgv);
  if ('error' in sinceResult) {
    console.error(sinceResult.error);
    return 1;
  }

  const auditStore = openAuditStore(config.sqlitePath);
  try {
    const rows = auditStore.listAuditSince(sinceResult.since);
    console.log(
      'uid\trecurrence_id\ttier\tpropagation\tnotify_status\tdedup_key\trecorded_at',
    );
    for (const row of rows) {
      console.log(formatAuditListRow(row));
    }
    return 0;
  } finally {
    auditStore.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createLogger(logLevel: string): pino.Logger {
  return pino({
    level: logLevel,
    redact: {
      paths: [
        'MAILBOX_APP_PASSWORD',
        'GOOGLE_REFRESH_TOKEN',
        'GOOGLE_CLIENT_SECRET',
        'mailboxAppPassword',
        'googleRefreshToken',
        'googleClientSecret',
        'SMTP_PASSWORD',
        'smtpPassword',
        'password',
        'refresh_token',
        'client_secret',
      ],
      remove: true,
    },
  });
}

async function runOneSyncCycle(log: pino.Logger): Promise<void> {
  const config = loadConfig();
  const mappingStore = openMappingStore(config.sqlitePath);
  const syncStateStore = openSyncStateStore(config.sqlitePath);
  const auditStore = openAuditStore(config.sqlitePath);
  const notifyEnabled =
    config.notifyOwnerEmail !== undefined && config.notifyOwnerEmail.length > 0;
  const withholdNotifier = createWithholdNotifier(config);

  try {
    const caldavClient = await createCalDavClient(config);
    const caldav = createCalDavReader({
      client: caldavClient,
      calendarUrl: config.calendarUrl,
      syncStateStore,
      mappingStore,
      log,
    });

    const auth = createGoogleAuthClient(config);
    const writer = createGoogleCalendarWriter({
      auth,
      calendarId: config.googleCalendarId,
    });

    const result = await runSyncCycle({
      caldav,
      writer,
      mappingStore,
      syncStateStore,
      auditStore,
      withholdNotifier,
      notifyEnabled,
      calendarUrl: config.calendarUrl,
      log,
    });

    const state = syncStateStore.getSyncState(config.calendarUrl);
    log.info(
      {
        created: result.created,
        updated: result.updated,
        cancelled: result.cancelled,
        dropped: result.dropped,
        errors: result.errors,
        lastSuccessAt: state?.lastSuccessAt ?? result.lastSuccessAt?.toISOString(),
      },
      'sync cycle finished',
    );
  } finally {
    mappingStore.close();
    syncStateStore.close();
    auditStore.close();
  }
}

export async function main(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const subcommand = argv[0];

  if (subcommand === undefined) {
    printUsage();
    return 0;
  }

  let config;
  try {
    config = loadConfig(resolvePilotEnv(env));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }

  const log = createLogger(config.logLevel);

  if (subcommand === 'audit') {
    if (argv[1] !== 'list') {
      printUsage();
      return 1;
    }
    return runAuditList(config, argv.slice(2));
  }

  if (subcommand !== 'sync') {
    printUsage();
    return 1;
  }

  const watch = argv.includes('--watch');

  if (!watch) {
    try {
      await runOneSyncCycle(log);
      return 0;
    } catch (err) {
      log.error({ err }, 'sync cycle failed');
      return 1;
    }
  }

  const intervalMs = config.syncIntervalSeconds * 1000;
  log.info(
    { syncIntervalSeconds: config.syncIntervalSeconds },
    'watch mode: running sync on interval',
  );

  for (;;) {
    try {
      await runOneSyncCycle(log);
    } catch (err) {
      log.error({ err }, 'sync cycle failed in watch mode');
    }
    await sleep(intervalMs);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  void main().then((code) => {
    process.exitCode = code;
  });
}
