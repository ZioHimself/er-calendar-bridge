import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../src/index.js';
import { openAuditStore } from '../../src/store/audit-store.js';

const FORBIDDEN_EVENT_TITLE = 'Ultra-Secret-Board-Meeting-Title-Must-Not-Leak';

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

describe('audit list CLI', () => {
  let tempDir: string;
  let sqlitePath: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let stdout: string;
  let stderr: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'er-bridge-audit-cli-'));
    sqlitePath = join(tempDir, 'bridge.db');
    stdout = '';
    stderr = '';
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdout += `${args.map(String).join(' ')}\n`;
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      stderr += `${args.map(String).join(' ')}\n`;
    });
  });

  afterEach(async () => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  function seedTwoAuditRows(): void {
    vi.useFakeTimers();
    const store = openAuditStore(sqlitePath);

    vi.setSystemTime(new Date('2026-09-16T10:00:00.000Z'));
    store.appendAuditRow({
      uid: 'older@example',
      tier: 'sensitive',
      propagation: 'drop',
      notifyStatus: 'sent',
      dedupKey: '11111111-1111-4111-8111-111111111111:drop:1',
    });

    vi.setSystemTime(new Date('2026-09-16T11:00:00.000Z'));
    store.appendAuditRow({
      uid: 'newer@example',
      tier: 'internal',
      propagation: 'busy',
      notifyStatus: 'disabled',
      dedupKey: '22222222-2222-4222-8222-222222222222:busy:1',
    });

    store.close();
    vi.useRealTimers();
  }

  it('prints all withhold audit rows without event titles (D-15, D-16)', async () => {
    seedTwoAuditRows();
    const code = await main(
      ['audit', 'list'],
      minimalEnv({ SQLITE_PATH: sqlitePath }),
    );

    expect(code).toBe(0);
    expect(stdout).toContain('older@example');
    expect(stdout).toContain('newer@example');
    expect(stdout).toContain('notify_status');
    expect(stdout).toContain('dedup_key');
    expect(stdout).toContain('sent');
    expect(stdout).toContain('disabled');
    expect(stdout).toContain('11111111-1111-4111-8111-111111111111:drop:1');
    expect(stdout).not.toContain(FORBIDDEN_EVENT_TITLE);
  });

  it('filters rows with --since ISO-8601 (D-15)', async () => {
    seedTwoAuditRows();
    const code = await main(
      ['audit', 'list', '--since', '2026-09-16T10:30:00.000Z'],
      minimalEnv({ SQLITE_PATH: sqlitePath }),
    );

    expect(code).toBe(0);
    expect(stdout).toContain('newer@example');
    expect(stdout).not.toContain('older@example');
  });

  it('rejects invalid --since with non-zero exit', async () => {
    seedTwoAuditRows();
    const code = await main(
      ['audit', 'list', '--since', 'not-a-timestamp'],
      minimalEnv({ SQLITE_PATH: sqlitePath }),
    );

    expect(code).toBe(1);
    expect(stderr.toLowerCase()).toMatch(/since|iso|invalid/);
  });
});
