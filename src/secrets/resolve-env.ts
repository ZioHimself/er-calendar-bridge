import { createComposeFileSecretProvider } from './file-provider.js';
import type { SecretProvider } from './types.js';

export const COMPOSE_SECRET_TO_ENV: Readonly<Record<string, string>> = {
  mailbox_app_password: 'MAILBOX_APP_PASSWORD',
  google_client_id: 'GOOGLE_CLIENT_ID',
  google_client_secret: 'GOOGLE_CLIENT_SECRET',
  google_refresh_token: 'GOOGLE_REFRESH_TOKEN',
  smtp_password: 'SMTP_PASSWORD',
};

function isUnset(value: string | undefined): boolean {
  return value === undefined || value === '';
}

export function resolvePilotEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  provider: SecretProvider = createComposeFileSecretProvider(),
): NodeJS.ProcessEnv {
  const merged: NodeJS.ProcessEnv = { ...baseEnv };

  for (const [composeName, envKey] of Object.entries(COMPOSE_SECRET_TO_ENV)) {
    if (!isUnset(merged[envKey])) {
      continue;
    }
    const fromFile = provider.get(composeName);
    if (fromFile !== undefined) {
      merged[envKey] = fromFile;
    }
  }

  return merged;
}
