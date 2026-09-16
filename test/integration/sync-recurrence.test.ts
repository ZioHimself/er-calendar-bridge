import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runSyncCycle } from '../../src/sync/run-sync-cycle.js';
import { loadFixture } from '../helpers/load-fixture.js';
import { openAuditStore } from '../../src/store/audit-store.js';
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
  let auditStore: ReturnType<typeof openAuditStore>;

  beforeEach(() => {
    mappingStore = openMappingStore(':memory:');
    syncStateStore = openSyncStateStore(':memory:');
    auditStore = openAuditStore(':memory:');
  });

  afterEach(() => {
    mappingStore.close();
    syncStateStore.close();
    auditStore.close();
  });

  const withholdNotifier = {
    notifyWithhold: vi
      .fn<import('../../src/notify/types.js').WithholdNotifier['notifyWithhold']>()
      .mockResolvedValue({ status: 'sent' }),
  };

  function baseDeps(
    caldav: CalDavReader,
    writer: CalendarWriter,
  ): SyncCycleDeps {
    return {
      caldav,
      writer,
      mappingStore,
      syncStateStore,
      auditStore,
      withholdNotifier,
      notifyEnabled: true,
      calendarUrl: CALENDAR_URL,
      log: silentLogger,
    };
  }

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

    await runSyncCycle(baseDeps(caldav, writer));

    expect(vi.mocked(writer.upsertOutbound).mock.calls.length).toBeGreaterThanOrEqual(1);
    const instanceCall = vi
      .mocked(writer.upsertOutbound)
      .mock.calls.find((c) => c[0]?.outbound.recurrenceId !== undefined)?.[0];
    expect(instanceCall).toBeDefined();
    expect(instanceCall?.mappingKey.uid).toBe(expected.uid);
    expect(instanceCall?.outbound.recurrenceId).toBeInstanceOf(Date);
    expect(instanceCall?.outbound.summary).toBe('Busy');
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

    await runSyncCycle(baseDeps(caldav, writer));

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

    await runSyncCycle(baseDeps(caldav, writer));

    expect(writer.upsertOutbound).toHaveBeenCalledOnce();
    expect(
      vi.mocked(writer.upsertOutbound).mock.calls[0]?.[0]?.mappingKey.uid,
    ).toBe(expected.uid);
  });
});
