import { describe, it, expect } from 'vitest';
import { loadConfig } from '../../src/config/env.js';

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
