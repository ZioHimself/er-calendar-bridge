import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import type { WithholdNotifyParams } from '../../src/notify/types.js';

function minimalEnv(
  overrides: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  const base: Record<string, string> = {
    MAILBOX_CALDAV_URL: 'https://dav.mailbox.org',
    MAILBOX_CALENDAR_URL: 'https://dav.mailbox.org/caldav/pilot/',
    MAILBOX_USERNAME: 'operator@example.org',
    MAILBOX_APP_PASSWORD: 'app-password-secret',
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_REFRESH_TOKEN: 'refresh-token-secret',
    GOOGLE_CALENDAR_ID: 'primary@group.calendar.google.com',
  };

  const merged = { ...base, ...overrides };
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}

describe('loadConfig', () => {
  it('parses required pilot env with readonly calendar fields', () => {
    const config = loadConfig(minimalEnv());
    expect(config.mailserverUrl).toBe('https://dav.mailbox.org');
    expect(config.calendarUrl).toBe('https://dav.mailbox.org/caldav/pilot/');
    expect(config.googleCalendarId).toBe('primary@group.calendar.google.com');
  });

  it('fails closed when MAILBOX_CALENDAR_URL is missing', () => {
    expect(() =>
      loadConfig(minimalEnv({ MAILBOX_CALENDAR_URL: undefined })),
    ).toThrow(/MAILBOX_CALENDAR_URL/i);
  });

  it('fails closed when GOOGLE_CALENDAR_ID is missing', () => {
    expect(() =>
      loadConfig(minimalEnv({ GOOGLE_CALENDAR_ID: undefined })),
    ).toThrow(/GOOGLE_CALENDAR_ID/i);
  });

  it('defaults SYNC_INTERVAL_SECONDS to 300 when unset', () => {
    const config = loadConfig(minimalEnv());
    expect(config.syncIntervalSeconds).toBe(300);
  });

  it('defaults sqlite path to ./data/bridge.db when SQLITE_PATH and DATA_DIR unset', () => {
    const config = loadConfig(
      minimalEnv({ SQLITE_PATH: undefined, DATA_DIR: undefined }),
    );
    expect(config.sqlitePath).toBe('./data/bridge.db');
  });

  it('rejects unknown env keys (SEC-04 strict schema)', () => {
    expect(() =>
      loadConfig(minimalEnv({ UNKNOWN_PILOT_KEY: 'nope' })),
    ).toThrow(/UNKNOWN_PILOT_KEY/i);
  });

  it('rejects unknown SMTP-related env keys (SEC-04)', () => {
    expect(() =>
      loadConfig(minimalEnv({ SMTP_EXTRA: 'nope' })),
    ).toThrow(/SMTP_EXTRA/i);
  });

  it('succeeds without SMTP_HOST when NOTIFY_OWNER_EMAIL unset (D-05)', () => {
    expect(() =>
      loadConfig(
        minimalEnv({
          NOTIFY_OWNER_EMAIL: undefined,
          SMTP_HOST: undefined,
        }),
      ),
    ).not.toThrow();
    const config = loadConfig(
      minimalEnv({
        NOTIFY_OWNER_EMAIL: undefined,
        SMTP_HOST: undefined,
      }),
    );
    expect(config.smtpHost).toBeUndefined();
    expect(config.notifyOwnerEmail).toBeUndefined();
  });

  it('requires SMTP_HOST when NOTIFY_OWNER_EMAIL is set (D-05)', () => {
    expect(() =>
      loadConfig(
        minimalEnv({
          NOTIFY_OWNER_EMAIL: 'owner@example.org',
          SMTP_PORT: '587',
          SMTP_FROM: 'noreply@example.org',
          SMTP_HOST: undefined,
        }),
      ),
    ).toThrow(/SMTP_HOST/i);
  });

  it('rejects invalid NOTIFY_OWNER_EMAIL format', () => {
    expect(() =>
      loadConfig(
        minimalEnv({
          NOTIFY_OWNER_EMAIL: 'not-an-email',
        }),
      ),
    ).toThrow(/NOTIFY_OWNER_EMAIL/i);
  });

  it('accepts optional TAG_GUIDANCE_URL as empty string or valid URL (D-12)', () => {
    const empty = loadConfig(
      minimalEnv({ TAG_GUIDANCE_URL: '' }),
    );
    expect(empty.tagGuidanceUrl).toBeUndefined();

    const withUrl = loadConfig(
      minimalEnv({
        TAG_GUIDANCE_URL: 'https://docs.example.org/tag-guidance',
      }),
    );
    expect(withUrl.tagGuidanceUrl).toBe(
      'https://docs.example.org/tag-guidance',
    );
  });

  it('does not echo SMTP_PASSWORD in validation errors', () => {
    const secret = 'smtp-password-secret-value';
    try {
      loadConfig(
        minimalEnv({
          NOTIFY_OWNER_EMAIL: 'owner@example.org',
          SMTP_PASSWORD: secret,
          SMTP_PORT: '587',
          SMTP_FROM: 'noreply@example.org',
          SMTP_HOST: undefined,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(secret);
      expect(message).toMatch(/SMTP_HOST/i);
      return;
    }
    expect.fail('expected loadConfig to throw');
  });

  it('tolerates unrelated keys present in process.env', () => {
    const pilot = minimalEnv();
    const snapshot = { ...process.env };
    Object.assign(process.env, pilot);
    process.env.PATH = snapshot.PATH ?? '/usr/bin';
    process.env.COMMAND_MODE = 'unix2003';
    try {
      expect(() => loadConfig()).not.toThrow();
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in snapshot)) {
          delete process.env[key];
        }
      }
      Object.assign(process.env, snapshot);
    }
  });

  it('does not echo secrets in error messages', () => {
    try {
      loadConfig(minimalEnv({ MAILBOX_CALENDAR_URL: undefined }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain('app-password-secret');
      expect(message).not.toContain('refresh-token-secret');
      return;
    }
    expect.fail('expected loadConfig to throw');
  });
});

describe('WithholdNotifier port', () => {
  it('exports params without event summary or location (D-09)', () => {
    const params: WithholdNotifyParams = {
      tier: 'internal',
      propagation: 'busy',
      dedupKey: 'bridge-uuid:busy:1',
    };
    expect(params.dedupKey).toBe('bridge-uuid:busy:1');
    expect('summary' in params).toBe(false);
    expect('title' in params).toBe(false);
    expect('location' in params).toBe(false);
  });
});
