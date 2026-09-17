import {
  createComposeFileSecretProvider,
  type ComposeFileSecretProvider,
} from './file-provider.js';
import type { SecretProvider } from './types.js';

function readSecretForBase(
  provider: SecretProvider,
  baseName: string,
): string | undefined {
  const compose = provider as ComposeFileSecretProvider;
  if (typeof compose.getForBaseName === 'function') {
    return compose.getForBaseName(baseName);
  }
  return provider.get(baseName);
}

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
  for (const [composeName, envKey] of Object.entries(COMPOSE_SECRET_TO_ENV)) {
    if (!isUnset(baseEnv[envKey])) {
      continue;
    }
    const fromFile = readSecretForBase(provider, composeName);
    if (fromFile !== undefined) {
      baseEnv[envKey] = fromFile;
    }
  }

  return baseEnv;
}
