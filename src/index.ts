import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { createCalDavClient, createCalDavReader } from './adapters/caldav/index.js';
import { loadConfig } from './config/env.js';
import { openMappingStore } from './store/mapping-store.js';
import { openSyncStateStore } from './store/sync-state-store.js';
import { runSyncCycle } from './sync/run-sync-cycle.js';
import { createGoogleAuthClient } from './writers/google/auth.js';
import { createGoogleCalendarWriter } from './writers/google/calendar-writer.js';

export const VERSION = '0.0.0';

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
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }

  const log = createLogger(config.logLevel);
  const subcommand = argv[0];
  const watch = argv.includes('--watch');

  if (subcommand !== 'sync') {
    console.log(`er-calendar-bridge v${VERSION}`);
    console.log('Usage: er-calendar-bridge sync [--watch]');
    return subcommand === undefined ? 0 : 1;
  }

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
