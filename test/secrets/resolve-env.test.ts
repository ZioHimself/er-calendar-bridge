import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { createComposeFileSecretProvider } from '../../src/secrets/file-provider.js';
import {
  COMPOSE_SECRET_TO_ENV,
  resolvePilotEnv,
} from '../../src/secrets/resolve-env.js';

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

function writeComposeSecrets(
  mountDir: string,
  secrets: Record<string, string>,
): void {
  for (const [name, value] of Object.entries(secrets)) {
    writeFileSync(join(mountDir, name), value, 'utf8');
  }
}

describe('COMPOSE_SECRET_TO_ENV', () => {
  it('maps compose secret filenames to pilot env keys', () => {
    expect(COMPOSE_SECRET_TO_ENV).toEqual({
      mailbox_app_password: 'MAILBOX_APP_PASSWORD',
      google_client_id: 'GOOGLE_CLIENT_ID',
      google_client_secret: 'GOOGLE_CLIENT_SECRET',
      google_refresh_token: 'GOOGLE_REFRESH_TOKEN',
      smtp_password: 'SMTP_PASSWORD',
    });
  });
});

describe('resolvePilotEnv', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fills GOOGLE_REFRESH_TOKEN from file when env lacks it', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'er-bridge-resolve-env-'));
    writeComposeSecrets(tempDir, {
      google_refresh_token: 'token-from-compose-file',
    });
    const base = minimalEnv({ GOOGLE_REFRESH_TOKEN: undefined });
    const provider = createComposeFileSecretProvider(tempDir);
    const merged = resolvePilotEnv(base, provider);
    expect(merged.GOOGLE_REFRESH_TOKEN).toBe('token-from-compose-file');
  });

  it('prefers env over file when GOOGLE_REFRESH_TOKEN is already set', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'er-bridge-resolve-env-'));
    writeComposeSecrets(tempDir, {
      google_refresh_token: 'token-from-compose-file',
    });
    const base = minimalEnv({ GOOGLE_REFRESH_TOKEN: 'env-wins-token' });
    const provider = createComposeFileSecretProvider(tempDir);
    const merged = resolvePilotEnv(base, provider);
    expect(merged.GOOGLE_REFRESH_TOKEN).toBe('env-wins-token');
  });

  it('maps member-prefixed compose secret files into env keys', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'er-bridge-resolve-env-'));
    writeComposeSecrets(tempDir, {
      serhiy_google_refresh_token: 'prefixed-refresh-token',
      serhiy_mailbox_app_password: 'mailbox-pw',
      serhiy_google_client_id: 'gid-from-file',
      serhiy_google_client_secret: 'gsecret-from-file',
    });
    const base = minimalEnv({
      MAILBOX_APP_PASSWORD: undefined,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      GOOGLE_REFRESH_TOKEN: undefined,
    });
    const provider = createComposeFileSecretProvider(tempDir);
    const merged = resolvePilotEnv(base, provider);
    expect(merged.GOOGLE_REFRESH_TOKEN).toBe('prefixed-refresh-token');
    expect(merged.MAILBOX_APP_PASSWORD).toBe('mailbox-pw');
  });

  it('maps all compose secret files into env keys', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'er-bridge-resolve-env-'));
    writeComposeSecrets(tempDir, {
      mailbox_app_password: 'mailbox-pw',
      google_client_id: 'gid-from-file',
      google_client_secret: 'gsecret-from-file',
      google_refresh_token: 'grefresh-from-file',
      smtp_password: 'smtp-pw',
    });
    const base = minimalEnv({
      MAILBOX_APP_PASSWORD: undefined,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      GOOGLE_REFRESH_TOKEN: undefined,
      SMTP_PASSWORD: undefined,
    });
    const provider = createComposeFileSecretProvider(tempDir);
    const merged = resolvePilotEnv(base, provider);
    expect(merged.MAILBOX_APP_PASSWORD).toBe('mailbox-pw');
    expect(merged.GOOGLE_CLIENT_ID).toBe('gid-from-file');
    expect(merged.GOOGLE_CLIENT_SECRET).toBe('gsecret-from-file');
    expect(merged.GOOGLE_REFRESH_TOKEN).toBe('grefresh-from-file');
    expect(merged.SMTP_PASSWORD).toBe('smtp-pw');
  });

  it('allows loadConfig to succeed when secrets come from files only', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'er-bridge-resolve-env-'));
    writeComposeSecrets(tempDir, {
      mailbox_app_password: 'mailbox-pw',
      google_client_id: 'gid-from-file',
      google_client_secret: 'gsecret-from-file',
      google_refresh_token: 'grefresh-from-file',
    });
    const base = minimalEnv({
      MAILBOX_APP_PASSWORD: undefined,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      GOOGLE_REFRESH_TOKEN: undefined,
    });
    const provider = createComposeFileSecretProvider(tempDir);
    const merged = resolvePilotEnv(base, provider);
    expect(() => loadConfig(merged)).not.toThrow();
    const config = loadConfig(merged);
    expect(config.googleRefreshToken).toBe('grefresh-from-file');
  });

  it('does not echo secret file contents in loadConfig validation errors', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'er-bridge-resolve-env-'));
    const fileSecret = 'super-secret-from-file-only';
    writeComposeSecrets(tempDir, {
      google_refresh_token: fileSecret,
      mailbox_app_password: 'mailbox-pw',
      google_client_id: 'gid',
      google_client_secret: 'gsec',
    });
    const base = minimalEnv({
      MAILBOX_CALENDAR_URL: undefined,
      MAILBOX_APP_PASSWORD: undefined,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      GOOGLE_REFRESH_TOKEN: undefined,
    });
    const provider = createComposeFileSecretProvider(tempDir);
    const merged = resolvePilotEnv(base, provider);
    try {
      loadConfig(merged);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain(fileSecret);
      expect(message).toMatch(/MAILBOX_CALENDAR_URL/i);
      return;
    }
    expect.fail('expected loadConfig to throw');
  });
});
