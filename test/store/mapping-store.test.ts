import { describe, it, expect, afterEach } from 'vitest';
import { openMappingStore } from '../../src/store/mapping-store.js';

function memoryStore() {
  return openMappingStore(':memory:');
}

describe('openMappingStore', () => {
  let store: ReturnType<typeof openMappingStore>;

  afterEach(() => {
    store?.close();
  });

  it('upserts master then lookup returns google_event_id and bridge_uuid', () => {
    store = memoryStore();
    store.upsertMapping({
      uid: 'uid-master@example',
      googleEventId: 'google-1',
      status: 'active',
    });

    const row = store.getMapping({ uid: 'uid-master@example' });
    expect(row).toBeDefined();
    expect(row?.googleEventId).toBe('google-1');
    expect(row?.bridgeUuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(row?.recurrenceId).toBeUndefined();
  });

  it('second upsert same uid+recurrenceId updates google_event_id without duplicate row', () => {
    store = memoryStore();
    store.upsertMapping({
      uid: 'same@example',
      googleEventId: 'google-a',
      status: 'active',
    });
    const first = store.getMapping({ uid: 'same@example' });
    const bridgeUuid = first?.bridgeUuid;

    store.upsertMapping({
      uid: 'same@example',
      googleEventId: 'google-b',
      status: 'active',
    });

    const second = store.getMapping({ uid: 'same@example' });
    expect(second?.googleEventId).toBe('google-b');
    expect(second?.bridgeUuid).toBe(bridgeUuid);
  });

  it('master and exception with same uid but different recurrenceId are distinct rows', () => {
    store = memoryStore();
    const instanceStart = new Date('2026-09-15T14:00:00.000Z');

    store.upsertMapping({
      uid: 'recur@example',
      googleEventId: 'google-master',
      status: 'active',
    });
    store.upsertMapping({
      uid: 'recur@example',
      recurrenceId: instanceStart,
      googleEventId: 'google-instance',
      status: 'active',
    });

    expect(store.getMapping({ uid: 'recur@example' })?.googleEventId).toBe(
      'google-master',
    );
    expect(
      store.getMapping({ uid: 'recur@example', recurrenceId: instanceStart })
        ?.googleEventId,
    ).toBe('google-instance');
  });

  it('markCancelled sets status cancelled but row still exists', () => {
    store = memoryStore();
    store.upsertMapping({
      uid: 'cancel@example',
      googleEventId: 'google-x',
      status: 'active',
    });

    store.markCancelled({ uid: 'cancel@example' });

    const row = store.getMapping({ uid: 'cancel@example' });
    expect(row).toBeDefined();
    expect(row?.status).toBe('cancelled');
    expect(row?.googleEventId).toBe('google-x');
  });

  it('stores recurrenceId as normalized ISO UTC string when Date provided', () => {
    store = memoryStore();
    const recurrenceId = new Date('2026-09-15T14:30:00.000Z');

    store.upsertMapping({
      uid: 'iso@example',
      recurrenceId,
      googleEventId: 'google-inst',
      status: 'active',
    });

    const row = store.getMapping({ uid: 'iso@example', recurrenceId });
    expect(row?.recurrenceId).toBe('2026-09-15T14:30:00.000Z');
  });

  it('upsertHrefSnapshot then resolveUidByHref returns uid for tombstone routing', () => {
    store = memoryStore();
    const href =
      'https://dav.mailbox.org/caldav/user/calendars/personal/event.ics';

    store.upsertHrefSnapshot({
      href,
      sourceUid: 'href-uid@example',
      etag: '"abc123"',
    });

    expect(store.resolveUidByHref(href)).toBe('href-uid@example');
    expect(store.resolveUidByHref('https://other/unknown.ics')).toBeUndefined();
  });

  it('listHrefSnapshots and deleteHrefSnapshot maintain basic-sync object cache', () => {
    store = memoryStore();
    const href = 'https://dav.mailbox.org/caldav/user/event.ics';

    store.upsertHrefSnapshot({
      href,
      sourceUid: 'uid@example',
      etag: 'etag-1',
    });

    expect(store.listHrefSnapshots()).toEqual([{ href, etag: 'etag-1' }]);

    store.deleteHrefSnapshot(href);

    expect(store.listHrefSnapshots()).toEqual([]);
    expect(store.resolveUidByHref(href)).toBeUndefined();
  });
});
