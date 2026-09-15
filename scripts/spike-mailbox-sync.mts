/**
 * Wave 0 mailbox.org CalDAV delta spike (read-only — SEC-01).
 * No create/update/delete calendar object APIs.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { DAVClient, type DAVCalendar } from 'tsdav';

const envSchema = z.object({
  MAILBOX_CALDAV_URL: z.string().url(),
  MAILBOX_CALENDAR_URL: z.string().url(),
  MAILBOX_USERNAME: z.string().min(1),
  MAILBOX_APP_PASSWORD: z.string().min(1),
});

function loadOptionalDotEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  try {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env optional when vars are exported in the shell
  }
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

function reportIncludesSyncCollection(reports: unknown): boolean {
  const text = JSON.stringify(reports ?? '').toLowerCase();
  return text.includes('sync-collection') || text.includes('synccollection');
}

async function main(): Promise<void> {
  loadOptionalDotEnv();
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Missing or invalid MAILBOX_* env:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  const { MAILBOX_CALDAV_URL, MAILBOX_CALENDAR_URL, MAILBOX_USERNAME, MAILBOX_APP_PASSWORD } =
    parsed.data;

  const statusLog: Array<{ step: string; status?: number; ok: boolean; detail?: string }> = [];

  const client = new DAVClient({
    serverUrl: MAILBOX_CALDAV_URL,
    credentials: {
      username: MAILBOX_USERNAME,
      password: MAILBOX_APP_PASSWORD,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      statusLog.push({
        step: typeof input === 'string' ? input : input.url,
        status: response.status,
        ok: response.ok,
      });
      return response;
    },
  });

  console.log('mailbox.org CalDAV spike (read-only)');
  console.log('  server:', MAILBOX_CALDAV_URL);
  console.log('  calendar:', redactUrl(MAILBOX_CALENDAR_URL));
  console.log('  username:', MAILBOX_USERNAME);

  try {
    await client.login({ loadCollections: false, loadObjects: false });
  } catch (err) {
    console.error('login failed (check credentials / URL):', err instanceof Error ? err.message : err);
    process.exit(2);
  }

  const collection: DAVCalendar = {
    url: MAILBOX_CALENDAR_URL,
    objects: [],
  };

  let supportedReports: string[] = [];
  try {
    supportedReports = await client.supportedReportSet({ collection });
    console.log('supported-report-set:', supportedReports);
  } catch (err) {
    console.warn('supportedReportSet failed:', err instanceof Error ? err.message : err);
  }

  const syncCollectionAdvertised =
    supportedReports.some((r) => r.toLowerCase().includes('sync-collection')) ||
    reportIncludesSyncCollection(collection.reports);

  console.log('sync-collection advertised:', syncCollectionAdvertised ? 'yes' : 'no');

  const syncTokenBefore = collection.syncToken ?? '(none)';
  let methodUsed: 'webdav' | 'basic' | 'unknown' = 'unknown';
  let created = 0;
  let updated = 0;
  let deleted = 0;
  let deletedHrefs: string[] = [];
  let syncTokenAfter = syncTokenBefore;

  try {
    const result = await client.smartCollectionSyncDetailed({
      collection,
      method: syncCollectionAdvertised ? 'webdav' : undefined,
    });
    syncTokenAfter = result.syncToken ?? syncTokenBefore;
    created = result.objects.created.length;
    updated = result.objects.updated.length;
    deleted = result.objects.deleted.length;
    deletedHrefs = result.objects.deleted.map((o) => o.url).filter(Boolean);
    methodUsed = syncCollectionAdvertised ? 'webdav' : 'basic';
  } catch (err) {
    console.warn('smartCollectionSync (webdav) failed, trying basic:', err instanceof Error ? err.message : err);
    try {
      const result = await client.smartCollectionSyncDetailed({
        collection,
        method: 'basic',
      });
      syncTokenAfter = result.syncToken ?? syncTokenBefore;
      created = result.objects.created.length;
      updated = result.objects.updated.length;
      deleted = result.objects.deleted.length;
      deletedHrefs = result.objects.deleted.map((o) => o.url).filter(Boolean);
      methodUsed = 'basic';
    } catch (basicErr) {
      console.error('smartCollectionSync failed:', basicErr instanceof Error ? basicErr.message : basicErr);
      process.exit(3);
    }
  }

  const httpStatuses = [...new Set(statusLog.map((e) => e.status).filter((s) => s !== undefined))];

  console.log('--- results ---');
  console.log('sync method used:', methodUsed);
  console.log('HTTP status codes seen:', httpStatuses.join(', ') || '(none captured)');
  console.log('sync-token before:', syncTokenBefore);
  console.log('sync-token after:', syncTokenAfter);
  console.log('sync-token changed:', syncTokenBefore !== syncTokenAfter ? 'yes' : 'no');
  console.log('objects created:', created);
  console.log('objects updated:', updated);
  console.log('objects deleted (404 tombstones):', deleted);

  if (deleted > 0) {
    console.log(
      'deleted href sample (first 3):',
      deletedHrefs.slice(0, 3).map((href) => redactUrl(href)),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(99);
});
