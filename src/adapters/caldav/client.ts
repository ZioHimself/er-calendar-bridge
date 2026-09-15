/**
 * SEC-01: Read-only CalDAV adapter. This module must never call tsdav mutation APIs
 * (create/update/delete calendar objects or generic createObject/deleteObject).
 */
import { DAVClient } from 'tsdav';
import type { AppConfig } from '../../config/env.js';

function loginErrorMessage(err: unknown, appPassword: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes(appPassword)) {
    return raw.split(appPassword).join('[redacted]');
  }
  return raw;
}

export async function createCalDavClient(
  config: Pick<
    AppConfig,
    'mailserverUrl' | 'mailboxUsername' | 'mailboxAppPassword'
  >,
): Promise<DAVClient> {
  const client = new DAVClient({
    serverUrl: config.mailserverUrl,
    credentials: {
      username: config.mailboxUsername,
      password: config.mailboxAppPassword,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  try {
    await client.login({ loadCollections: false, loadObjects: false });
  } catch (err) {
    throw new Error(`CalDAV login failed: ${loginErrorMessage(err, config.mailboxAppPassword)}`, {
      cause: err,
    });
  }

  return client;
}
