import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SecretProvider } from './types.js';

export function createComposeFileSecretProvider(
  mountDir = '/run/secrets',
): SecretProvider {
  return {
    get(name: string): string | undefined {
      try {
        const raw = readFileSync(join(mountDir, name), 'utf8');
        return raw.trim();
      } catch {
        return undefined;
      }
    },
  };
}
