import type { MappingStore } from '../../store/mapping-store.js';
import type { SyncStateStore } from '../../store/sync-state-store.js';
import type { CalDavReader, Logger, SyncDelta } from '../../sync/types.js';

/** Wave 0 spike default until live mailbox.org confirms webdav_sync (03-SPIKE-SYNC.md). */
const DEFAULT_DEGRADED_MODE = 'basic_sync';

export interface CalDavObjectRef {
  url: string;
  data?: unknown;
  etag?: string;
}

export interface CalDavSyncClient {
  smartCollectionSyncDetailed<T extends { url: string; syncToken?: string; ctag?: string }>(
    param: {
      collection: T;
      method?: 'basic' | 'webdav';
    },
  ): Promise<{
    syncToken?: string;
    ctag?: string;
    objects: {
      created: CalDavObjectRef[];
      updated: CalDavObjectRef[];
      deleted: CalDavObjectRef[];
    };
  }>;
}

function syncMethodForDegradedMode(mode: string): 'basic' | 'webdav' {
  return mode === 'webdav_sync' ? 'webdav' : 'basic';
}

function icsPayload(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (data === undefined || data === null) {
    return '';
  }
  return String(data);
}

/** Minimal UID extraction — orchestrator owns full ICS parsing (03-06). */
export function extractUidFromIcs(ics: string): string | undefined {
  const match = ics.match(/^UID(?:;[^:]*)?:(.+)$/m);
  return match?.[1]?.trim();
}

export function createCalDavReader(deps: {
  client: CalDavSyncClient;
  calendarUrl: string;
  syncStateStore: SyncStateStore;
  mappingStore: MappingStore;
  log?: Logger;
}): CalDavReader {
  return {
    async poll(): Promise<SyncDelta> {
      const prior = deps.syncStateStore.getSyncState(deps.calendarUrl);
      const degradedMode = prior?.degradedMode ?? DEFAULT_DEGRADED_MODE;

      if (!prior?.degradedMode) {
        deps.syncStateStore.updateSyncState({
          calendarUrl: deps.calendarUrl,
          degradedMode,
        });
      }

      if (degradedMode !== 'webdav_sync') {
        deps.log?.info({ degradedMode }, 'CalDAV poll using degraded sync mode');
      }

      const collection = {
        url: deps.calendarUrl,
        syncToken: prior?.syncToken,
        ctag: prior?.ctag,
        objects: [] as CalDavObjectRef[],
      };

      const result = await deps.client.smartCollectionSyncDetailed({
        collection,
        method: syncMethodForDegradedMode(degradedMode),
      });

      const changed: SyncDelta['changed'] = [];
      for (const obj of [...result.objects.created, ...result.objects.updated]) {
        const data = icsPayload(obj.data);
        if (!obj.url) {
          continue;
        }
        changed.push({
          href: obj.url,
          data,
          etag: obj.etag,
        });

        const sourceUid = extractUidFromIcs(data);
        if (sourceUid) {
          deps.mappingStore.upsertHrefSnapshot({
            href: obj.url,
            sourceUid,
            etag: obj.etag,
          });
        }
      }

      const deleted: SyncDelta['deleted'] = [];
      for (const obj of result.objects.deleted) {
        if (!obj.url) {
          continue;
        }
        const uid = deps.mappingStore.resolveUidByHref(obj.url);
        if (uid) {
          deleted.push({ href: obj.url, uid });
        }
      }

      deps.syncStateStore.updateSyncState({
        calendarUrl: deps.calendarUrl,
        syncToken: result.syncToken ?? prior?.syncToken ?? null,
        ctag: result.ctag ?? prior?.ctag ?? null,
        degradedMode,
      });

      return { changed, deleted };
    },
  };
}
