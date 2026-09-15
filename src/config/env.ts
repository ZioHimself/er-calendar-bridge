import { join } from 'node:path';
import { z } from 'zod';

const ENV_KEYS = [
  'MAILBOX_CALDAV_URL',
  'MAILBOX_CALENDAR_URL',
  'MAILBOX_USERNAME',
  'MAILBOX_APP_PASSWORD',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_CALENDAR_ID',
  'SQLITE_PATH',
  'DATA_DIR',
  'SYNC_INTERVAL_SECONDS',
  'LOG_LEVEL',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const SECRET_ENV_KEYS = new Set<EnvKey>([
  'MAILBOX_APP_PASSWORD',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
]);

const envSchema = z.strictObject({
  MAILBOX_CALDAV_URL: z.string().min(1),
  MAILBOX_CALENDAR_URL: z.string().min(1),
  MAILBOX_USERNAME: z.string().min(1),
  MAILBOX_APP_PASSWORD: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REFRESH_TOKEN: z.string().min(1),
  GOOGLE_CALENDAR_ID: z.string().min(1),
  SQLITE_PATH: z.string().min(1).optional(),
  DATA_DIR: z.string().min(1).optional(),
  SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().optional(),
  LOG_LEVEL: z.string().min(1).optional(),
});

export type AppConfig = Readonly<{
  mailserverUrl: string;
  calendarUrl: string;
  mailboxUsername: string;
  mailboxAppPassword: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  googleCalendarId: string;
  sqlitePath: string;
  syncIntervalSeconds: number;
  logLevel: string;
}>;

function pickPilotEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const picked: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    const value = env[key];
    if (value !== undefined) {
      picked[key] = value;
    }
  }
  return picked;
}

function assertNoUnknownEnvKeys(env: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(env)) {
    if (env[key] === undefined) {
      continue;
    }
    if (!(ENV_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Invalid environment configuration: Unrecognized key: "${key}"`);
    }
  }
}

function formatValidationError(error: z.ZodError): string {
  const lines: string[] = [];
  for (const issue of error.issues) {
    const field =
      issue.path.length > 0 ? String(issue.path[0]) : 'environment';
    if (issue.code === 'unrecognized_keys') {
      const keys = 'keys' in issue ? issue.keys : [];
      for (const key of keys) {
        lines.push(`${String(key)}: Unrecognized key`);
      }
      continue;
    }
    if (SECRET_ENV_KEYS.has(field as EnvKey)) {
      lines.push(`${field}: Invalid value`);
    } else {
      lines.push(`${field}: ${issue.message}`);
    }
  }
  return `Invalid environment configuration:\n${lines.join('\n')}`;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // SEC-04: reject typos in explicit env fixtures/tests; real process.env carries OS keys.
  if (env !== process.env) {
    assertNoUnknownEnvKeys(env);
  }
  const picked = pickPilotEnv(env);
  const parsed = envSchema.safeParse(picked);

  if (!parsed.success) {
    throw new Error(formatValidationError(parsed.error));
  }

  const data = parsed.data;
  const sqlitePath =
    data.SQLITE_PATH ??
    (data.DATA_DIR ? join(data.DATA_DIR, 'bridge.db') : './data/bridge.db');

  return {
    mailserverUrl: data.MAILBOX_CALDAV_URL,
    calendarUrl: data.MAILBOX_CALENDAR_URL,
    mailboxUsername: data.MAILBOX_USERNAME,
    mailboxAppPassword: data.MAILBOX_APP_PASSWORD,
    googleClientId: data.GOOGLE_CLIENT_ID,
    googleClientSecret: data.GOOGLE_CLIENT_SECRET,
    googleRefreshToken: data.GOOGLE_REFRESH_TOKEN,
    googleCalendarId: data.GOOGLE_CALENDAR_ID,
    sqlitePath,
    syncIntervalSeconds: data.SYNC_INTERVAL_SECONDS ?? 300,
    logLevel: data.LOG_LEVEL ?? 'info',
  };
}
