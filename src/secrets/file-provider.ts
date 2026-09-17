import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SecretProvider } from './types.js';

export type ComposeFileSecretProvider = SecretProvider & {
  /** Resolve unprefixed base name or member-prefixed mount (e.g. serhiy_mailbox_app_password). */
  getForBaseName: (baseName: string) => string | undefined;
};

function readSecretFile(mountDir: string, name: string): string | undefined {
  try {
    const raw = readFileSync(join(mountDir, name), 'utf8');
    return raw.trim();
  } catch {
    return undefined;
  }
}

export function createComposeFileSecretProvider(
  mountDir = '/run/secrets',
): ComposeFileSecretProvider {
  return {
    get(name: string): string | undefined {
      return readSecretFile(mountDir, name);
    },
    getForBaseName(baseName: string): string | undefined {
      const direct = readSecretFile(mountDir, baseName);
      if (direct !== undefined) {
        return direct;
      }
      try {
        const suffix = `_${baseName}`;
        const prefixed = readdirSync(mountDir).find((entry) =>
          entry.endsWith(suffix),
        );
        if (prefixed) {
          return readSecretFile(mountDir, prefixed);
        }
      } catch {
        return undefined;
      }
      return undefined;
    },
  };
}
