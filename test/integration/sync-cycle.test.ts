import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSyncCycle } from '../../src/sync/run-sync-cycle.js';
import { loadFixture } from '../helpers/load-fixture.js';
import { openMappingStore } from '../../src/store/mapping-store.js';
import { openSyncStateStore } from '../../src/store/sync-state-store.js';
import type {
  CalDavReader,
  CalendarWriter,
  Logger,
  SyncCycleDeps,
} from '../../src/sync/types.js';

const CALENDAR_URL = 'https://mailbox.example/calendars/pilot/';

const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function buildDeps(overrides: {
  caldav: CalDavReader;
  writer: CalendarWriter;
  now?: () => Date;
}): { deps: SyncCycleDeps; mappingStore: ReturnType<typeof openMappingStore>; syncStateStore: ReturnType<typeof openSyncStateStore> } {
  const mappingStore = openMappingStore(':memory:');
  const syncStateStore = openSyncStateStore(':memory:');
  const deps: SyncCycleDeps = {
    caldav: overrides.caldav,
    writer: overrides.writer,
    mappingStore,
    syncStateStore,
    calendarUrl: CALENDAR_URL,
    log: silentLogger,
    now: overrides.now,
  };
  return { deps, mappingStore, syncStateStore };
}

describe('sync cycle acceptance', () => {
  let mappingStore: ReturnType<typeof openMappingStore>;
  let syncStateStore: ReturnType<typeof openSyncStateStore>;

  beforeEach(() => {
    mappingStore = openMappingStore(':memory:');
    syncStateStore = openSyncStateStore(':memory:');
  });

  afterEach(() => {
    mappingStore.close();
    syncStateStore.close();
  });

  it('idempotent: empty second delta does not duplicate upserts (SYNC-11)', async () => {
    const { ics } = await loadFixture('internal', 'team-sync');
    const caldav: CalDavReader = {
      poll: vi
        .fn()
        .mockResolvedValueOnce({
          changed: [{ href: '/team-sync.ics', data: ics }],
          deleted: [],
        })
        .mockResolvedValueOnce({ changed: [], deleted: [] }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-team' }),
      cancel: vi.fn().mockResolvedValue(undefined),
    };

    const deps: SyncCycleDeps = {
      caldav,
      writer,
      mappingStore,
      syncStateStore,
      calendarUrl: CALENDAR_URL,
      log: silentLogger,
    };

    await runSyncCycle(deps);
    await runSyncCycle(deps);

    expect(writer.upsertOutbound).toHaveBeenCalledTimes(1);
  });

  it('update propagation: changed ICS reuses existing google event id (SYNC-06)', async () => {
    const { ics } = await loadFixture('public', 'board-meeting');
    const icsUpdated = ics.replace(
      'SUMMARY:Board meeting Q3',
      'SUMMARY:Board meeting Q3 (rescheduled)',
    );

    const caldav: CalDavReader = {
      poll: vi
        .fn()
        .mockResolvedValueOnce({
          changed: [{ href: '/board.ics', data: ics, etag: 'e1' }],
          deleted: [],
        })
        .mockResolvedValueOnce({
          changed: [{ href: '/board.ics', data: icsUpdated, etag: 'e2' }],
          deleted: [],
        }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-board' }),
      cancel: vi.fn().mockResolvedValue(undefined),
    };

    const deps: SyncCycleDeps = {
      caldav,
      writer,
      mappingStore,
      syncStateStore,
      calendarUrl: CALENDAR_URL,
      log: silentLogger,
    };

    await runSyncCycle(deps);
    await runSyncCycle(deps);

    expect(writer.upsertOutbound).toHaveBeenCalledTimes(2);
    const second = vi.mocked(writer.upsertOutbound).mock.calls[1]?.[0];
    expect(second?.existingGoogleEventId).toBe('g-board');
  });

  it('tier public then busy updates same google event in place (D-10)', async () => {
    const { ics: publicIcs } = await loadFixture('public', 'board-meeting');
    const busyIcs = publicIcs.replace(
      'CATEGORIES:ER-PUBLIC',
      'CATEGORIES:ER-INTERNAL',
    );

    const caldav: CalDavReader = {
      poll: vi
        .fn()
        .mockResolvedValueOnce({
          changed: [{ href: '/tier.ics', data: publicIcs }],
          deleted: [],
        })
        .mockResolvedValueOnce({
          changed: [{ href: '/tier.ics', data: busyIcs }],
          deleted: [],
        }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-tier' }),
      cancel: vi.fn().mockResolvedValue(undefined),
    };

    const deps: SyncCycleDeps = {
      caldav,
      writer,
      mappingStore,
      syncStateStore,
      calendarUrl: CALENDAR_URL,
      log: silentLogger,
    };

    await runSyncCycle(deps);
    await runSyncCycle(deps);

    expect(writer.cancel).not.toHaveBeenCalled();
    expect(writer.upsertOutbound).toHaveBeenCalledTimes(2);
    const second = vi.mocked(writer.upsertOutbound).mock.calls[1]?.[0];
    expect(second?.existingGoogleEventId).toBe('g-tier');
    expect(second?.outbound.summary).toBe('Busy');
  });

  it('drop propagation cancels existing mapping (SYNC-05)', async () => {
    const { ics, expected } = await loadFixture('sensitive', 'hr-review');
    mappingStore.upsertMapping({
      uid: expected.uid,
      googleEventId: 'g-sensitive-old',
      status: 'active',
    });

    const caldav: CalDavReader = {
      poll: vi.fn().mockResolvedValueOnce({
        changed: [{ href: '/hr.ics', data: ics }],
        deleted: [],
      }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-new' }),
      cancel: vi.fn().mockResolvedValue(undefined),
    };

    const deps: SyncCycleDeps = {
      caldav,
      writer,
      mappingStore,
      syncStateStore,
      calendarUrl: CALENDAR_URL,
      log: silentLogger,
    };

    const result = await runSyncCycle(deps);

    expect(writer.upsertOutbound).not.toHaveBeenCalled();
    expect(writer.cancel).toHaveBeenCalledWith({
      googleEventId: 'g-sensitive-old',
      isRecurringInstance: false,
    });
    expect(result.dropped).toBeGreaterThanOrEqual(1);
    expect(result.cancelled).toBeGreaterThanOrEqual(1);
    expect(mappingStore.getMapping({ uid: expected.uid })?.status).toBe(
      'cancelled',
    );
  });

  it('deleted delta cancels mapped google event (SYNC-12)', async () => {
    const uid = 'team-sync-2026@er.example';
    mappingStore.upsertMapping({
      uid,
      googleEventId: 'g-delete-me',
      status: 'active',
    });

    const caldav: CalDavReader = {
      poll: vi.fn().mockResolvedValueOnce({
        changed: [],
        deleted: [{ href: '/gone.ics', uid }],
      }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn(),
      cancel: vi.fn().mockResolvedValue(undefined),
    };

    const deps: SyncCycleDeps = {
      caldav,
      writer,
      mappingStore,
      syncStateStore,
      calendarUrl: CALENDAR_URL,
      log: silentLogger,
    };

    const result = await runSyncCycle(deps);

    expect(writer.cancel).toHaveBeenCalledWith({
      googleEventId: 'g-delete-me',
      isRecurringInstance: false,
    });
    expect(result.cancelled).toBe(1);
    expect(mappingStore.getMapping({ uid })?.status).toBe('cancelled');
  });

  it('status: persists last_success_at and returns cycle counts (OPS-03)', async () => {
    const { ics } = await loadFixture('internal', 'team-sync');
    const fixedNow = new Date('2026-09-15T14:30:00.000Z');

    const caldav: CalDavReader = {
      poll: vi.fn().mockResolvedValueOnce({
        changed: [{ href: '/t.ics', data: ics }],
        deleted: [],
      }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g1' }),
      cancel: vi.fn(),
    };

    const { deps, syncStateStore: stateStore } = buildDeps({
      caldav,
      writer,
      now: () => fixedNow,
    });

    const result = await runSyncCycle(deps);

    expect(result.created).toBeGreaterThanOrEqual(1);
    expect(result.errors).toBe(0);
    expect(result.lastSuccessAt).toEqual(fixedNow);
    expect(stateStore.getSyncState(CALENDAR_URL)?.lastSuccessAt).toBe(
      fixedNow.toISOString(),
    );

    stateStore.close();
  });
});
