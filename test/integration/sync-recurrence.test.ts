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

describe('sync cycle recurrence fixtures', () => {
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

  it('modified-instance: writer upsert uses recurrence mapping key (SYNC-07)', async () => {
    const { ics, expected } = await loadFixture('recurrence', 'modified-instance');

    const caldav: CalDavReader = {
      poll: vi.fn().mockResolvedValueOnce({
        changed: [{ href: '/standup.ics', data: ics }],
        deleted: [],
      }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-instance' }),
      cancel: vi.fn(),
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

    expect(writer.upsertOutbound).toHaveBeenCalledOnce();
    const call = vi.mocked(writer.upsertOutbound).mock.calls[0]?.[0];
    expect(call?.mappingKey.uid).toBe(expected.uid);
    expect(call?.outbound.recurrenceId).toBeInstanceOf(Date);
    expect(call?.outbound.summary).toBe('Busy');
  });

  it('deleted-instance: master busy series upserts from fixture delta (SYNC-07)', async () => {
    const { ics, expected } = await loadFixture('recurrence', 'deleted-instance');

    const caldav: CalDavReader = {
      poll: vi.fn().mockResolvedValueOnce({
        changed: [{ href: '/retro.ics', data: ics }],
        deleted: [],
      }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-series' }),
      cancel: vi.fn(),
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

    expect(writer.upsertOutbound).toHaveBeenCalledOnce();
    const call = vi.mocked(writer.upsertOutbound).mock.calls[0]?.[0];
    expect(call?.mappingKey.uid).toBe(expected.uid);
    expect(call?.outbound.summary).toBe('Busy');
    expect(call?.outbound.isRecurring).toBe(true);
  });

  it('weekly-series: processes recurrence fixture through mocked caldav', async () => {
    const { ics, expected } = await loadFixture('recurrence', 'weekly-series');

    const caldav: CalDavReader = {
      poll: vi.fn().mockResolvedValueOnce({
        changed: [{ href: '/weekly.ics', data: ics }],
        deleted: [],
      }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-weekly' }),
      cancel: vi.fn(),
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

    expect(writer.upsertOutbound).toHaveBeenCalledOnce();
    expect(
      vi.mocked(writer.upsertOutbound).mock.calls[0]?.[0]?.mappingKey.uid,
    ).toBe(expected.uid);
  });
});
