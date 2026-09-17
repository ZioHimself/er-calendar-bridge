import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DAVClient } from 'tsdav';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createCalDavReader } from '../../src/adapters/caldav/reader.js';
import { openMappingStore } from '../../src/store/mapping-store.js';
import { openSyncStateStore } from '../../src/store/sync-state-store.js';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/public',
);
const boardMeetingIcs = readFileSync(
  join(fixturesDir, 'board-meeting.ics'),
  'utf8',
);

const CALENDAR_URL = 'https://dav.mailbox.org/caldav/test-calendar/';

function memoryStores() {
  const mappingStore = openMappingStore(':memory:');
  const syncStateStore = openSyncStateStore(':memory:');
  return { mappingStore, syncStateStore };
}

describe('createCalDavReader', () => {
  let mappingStore: ReturnType<typeof openMappingStore>;
  let syncStateStore: ReturnType<typeof openSyncStateStore>;

  afterEach(() => {
    mappingStore?.close();
    syncStateStore?.close();
    vi.restoreAllMocks();
  });

  it('maps created/updated objects to changed[] with raw ICS and href snapshots', async () => {
    ({ mappingStore, syncStateStore } = memoryStores());

    const href = `${CALENDAR_URL}event-1.ics`;
    const smartCollectionSyncDetailed = vi.fn().mockResolvedValue({
      url: CALENDAR_URL,
      syncToken: 'token-after-1',
      ctag: 'ctag-1',
      objects: {
        created: [{ url: href, data: boardMeetingIcs, etag: 'etag-1' }],
        updated: [],
        deleted: [],
      },
    });

    const client = {
      smartCollectionSyncDetailed,
      fetchCalendarObjects: vi.fn(),
      calendarMultiGet: vi.fn(),
    } as unknown as DAVClient;

    const reader = createCalDavReader({
      client,
      calendarUrl: CALENDAR_URL,
      mappingStore,
      syncStateStore,
    });

    const delta = await reader.poll();

    expect(delta.changed).toHaveLength(1);
    expect(delta.changed[0]).toEqual({
      href,
      data: boardMeetingIcs,
      etag: 'etag-1',
    });
    expect(mappingStore.resolveUidByHref(href)).toBe('board-meeting-2026@er.example');
    expect(delta.deleted).toEqual([]);

    const state = syncStateStore.getSyncState(CALENDAR_URL);
    expect(state?.degradedMode).toBe('basic_sync');
    expect(state?.syncToken).toBe('token-after-1');
    expect(state?.ctag).toBe('ctag-1');

    expect(smartCollectionSyncDetailed).toHaveBeenCalledWith({
      collection: expect.objectContaining({
        url: CALENDAR_URL,
        fetchObjects: expect.any(Function),
        objectMultiGet: expect.any(Function),
      }),
      method: 'basic',
    });
  });

  it('resolves deleted hrefs to uid when href snapshot exists; omits unknown hrefs', async () => {
    ({ mappingStore, syncStateStore } = memoryStores());

    const knownHref = `${CALENDAR_URL}gone.ics`;
    const unknownHref = `${CALENDAR_URL}never-synced.ics`;
    mappingStore.upsertHrefSnapshot({
      href: knownHref,
      sourceUid: 'removed@er.example',
    });

    syncStateStore.updateSyncState({
      calendarUrl: CALENDAR_URL,
      degradedMode: 'basic_sync',
      syncToken: 'prev-token',
    });

    const smartCollectionSyncDetailed = vi.fn().mockResolvedValue({
      url: CALENDAR_URL,
      syncToken: 'token-2',
      objects: {
        created: [],
        updated: [],
        deleted: [{ url: knownHref }, { url: unknownHref }],
      },
    });

    const reader = createCalDavReader({
      client: {
        smartCollectionSyncDetailed,
        fetchCalendarObjects: vi.fn(),
        calendarMultiGet: vi.fn(),
      } as unknown as DAVClient,
      calendarUrl: CALENDAR_URL,
      mappingStore,
      syncStateStore,
    });

    const delta = await reader.poll();

    expect(delta.deleted).toEqual([
      { href: knownHref, uid: 'removed@er.example' },
    ]);
    expect(smartCollectionSyncDetailed).toHaveBeenCalledWith({
      collection: expect.objectContaining({
        url: CALENDAR_URL,
        syncToken: 'prev-token',
      }),
      method: 'basic',
    });
  });

  it('uses webdav method when degraded_mode is webdav_sync', async () => {
    ({ mappingStore, syncStateStore } = memoryStores());
    syncStateStore.updateSyncState({
      calendarUrl: CALENDAR_URL,
      degradedMode: 'webdav_sync',
      syncToken: 'sync-webdav',
    });

    const smartCollectionSyncDetailed = vi.fn().mockResolvedValue({
      url: CALENDAR_URL,
      syncToken: 'sync-webdav-next',
      objects: { created: [], updated: [], deleted: [] },
    });

    const reader = createCalDavReader({
      client: {
        smartCollectionSyncDetailed,
        fetchCalendarObjects: vi.fn(),
        calendarMultiGet: vi.fn(),
      } as unknown as DAVClient,
      calendarUrl: CALENDAR_URL,
      mappingStore,
      syncStateStore,
    });

    await reader.poll();

    expect(smartCollectionSyncDetailed).toHaveBeenCalledWith({
      collection: expect.objectContaining({ syncToken: 'sync-webdav' }),
      method: 'webdav',
    });
  });
});
