import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createComposeFileSecretProvider } from '../../src/secrets/file-provider.js';

describe('createComposeFileSecretProvider', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns trimmed file contents for a compose secret name', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'er-bridge-secrets-'));
    writeFileSync(
      join(tempDir, 'google_refresh_token'),
      'refresh-from-file\n',
      'utf8',
    );
    const provider = createComposeFileSecretProvider(tempDir);
    expect(provider.get('google_refresh_token')).toBe('refresh-from-file');
  });

  it('returns undefined when the secret file is missing', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'er-bridge-secrets-'));
    const provider = createComposeFileSecretProvider(tempDir);
    expect(provider.get('google_refresh_token')).toBeUndefined();
  });
});
