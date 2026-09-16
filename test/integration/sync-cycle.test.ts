import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WithholdNotifier } from '../../src/notify/types.js';
import { runSyncCycle } from '../../src/sync/run-sync-cycle.js';
import { openAuditStore } from '../../src/store/audit-store.js';
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

function sharedSqlitePath(): { sqlitePath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'er-bridge-sync-'));
  const sqlitePath = join(dir, 'bridge.db');
  return {
    sqlitePath,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function createMockWithholdNotifier(
  impl?: ReturnType<typeof vi.fn<WithholdNotifier['notifyWithhold']>>,
): WithholdNotifier & {
  notifyWithhold: ReturnType<typeof vi.fn<WithholdNotifier['notifyWithhold']>>;
} {
  const notifyWithhold =
    impl ??
    vi.fn<WithholdNotifier['notifyWithhold']>().mockResolvedValue({
      status: 'sent',
    });
  return { notifyWithhold };
}

function buildDeps(overrides: {
  caldav: CalDavReader;
  writer: CalendarWriter;
  now?: () => Date;
  notifyEnabled?: boolean;
  withholdNotifier?: WithholdNotifier;
}): {
  deps: SyncCycleDeps;
  mappingStore: ReturnType<typeof openMappingStore>;
  syncStateStore: ReturnType<typeof openSyncStateStore>;
  auditStore: ReturnType<typeof openAuditStore>;
  cleanup: () => void;
} {
  const { sqlitePath, cleanup } = sharedSqlitePath();
  const mappingStore = openMappingStore(sqlitePath);
  const syncStateStore = openSyncStateStore(sqlitePath);
  const auditStore = openAuditStore(sqlitePath);
  const withholdNotifier =
    overrides.withholdNotifier ?? createMockWithholdNotifier();

  const deps: SyncCycleDeps = {
    caldav: overrides.caldav,
    writer: overrides.writer,
    mappingStore,
    syncStateStore,
    auditStore,
    withholdNotifier,
    notifyEnabled: overrides.notifyEnabled ?? true,
    calendarUrl: CALENDAR_URL,
    log: silentLogger,
    now: overrides.now,
  };
  return { deps, mappingStore, syncStateStore, auditStore, cleanup };
}

describe('sync cycle acceptance', () => {
  let mappingStore: ReturnType<typeof openMappingStore>;
  let syncStateStore: ReturnType<typeof openSyncStateStore>;
  let auditStore: ReturnType<typeof openAuditStore>;
  let cleanupStores: () => void;

  beforeEach(() => {
    const { sqlitePath, cleanup } = sharedSqlitePath();
    cleanupStores = cleanup;
    mappingStore = openMappingStore(sqlitePath);
    syncStateStore = openSyncStateStore(sqlitePath);
    auditStore = openAuditStore(sqlitePath);
  });

  afterEach(() => {
    mappingStore.close();
    syncStateStore.close();
    auditStore.close();
    cleanupStores();
  });

  function baseWithholdDeps(
    caldav: CalDavReader,
    writer: CalendarWriter,
    withholdNotifier: WithholdNotifier = createMockWithholdNotifier(),
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

    const deps = baseWithholdDeps(caldav, writer);

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

    const deps = baseWithholdDeps(caldav, writer);

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

    const deps = baseWithholdDeps(caldav, writer);

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

    const deps = baseWithholdDeps(caldav, writer);

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

    const deps = baseWithholdDeps(caldav, writer);

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

    const { deps, syncStateStore: stateStore, cleanup } = buildDeps({
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
    cleanup();
  });
});

describe('sync cycle withhold', () => {
  it('withhold: internal first cycle notifies once; second unchanged busy does not (D-02, D-14)', async () => {
    const { ics } = await loadFixture('internal', 'team-sync');

    const caldav: CalDavReader = {
      poll: vi
        .fn()
        .mockResolvedValueOnce({
          changed: [{ href: '/team-sync.ics', data: ics }],
          deleted: [],
        })
        .mockResolvedValueOnce({
          changed: [{ href: '/team-sync.ics', data: ics }],
          deleted: [],
        }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-internal' }),
      cancel: vi.fn(),
    };

    const { deps, cleanup } = buildDeps({ caldav, writer });

    await runSyncCycle(deps);
    await runSyncCycle(deps);

    const notifyWithhold = (
      deps.withholdNotifier as ReturnType<typeof createMockWithholdNotifier>
    ).notifyWithhold;
    expect(notifyWithhold).toHaveBeenCalledTimes(1);
    expect(notifyWithhold.mock.calls[0]?.[0].propagation).toBe('busy');

    deps.auditStore.close();
    deps.mappingStore.close();
    deps.syncStateStore.close();
    cleanup();
  });

  it('withhold: tier-only busy change does not re-notify (D-02)', async () => {
    const { ics } = await loadFixture('internal', 'team-sync');
    const icsRenamed = ics.replace(
      'SUMMARY:Weekly team sync',
      'SUMMARY:Weekly team sync (renamed)',
    );
    const withholdNotifier = createMockWithholdNotifier();

    const caldav: CalDavReader = {
      poll: vi
        .fn()
        .mockResolvedValueOnce({
          changed: [{ href: '/team-sync.ics', data: ics, etag: 'e1' }],
          deleted: [],
        })
        .mockResolvedValueOnce({
          changed: [{ href: '/team-sync.ics', data: icsRenamed, etag: 'e2' }],
          deleted: [],
        }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-internal' }),
      cancel: vi.fn(),
    };

    const { deps, cleanup } = buildDeps({ caldav, writer, withholdNotifier });

    await runSyncCycle(deps);
    await runSyncCycle(deps);

    expect(withholdNotifier.notifyWithhold).toHaveBeenCalledTimes(1);

    deps.auditStore.close();
    deps.mappingStore.close();
    deps.syncStateStore.close();
    cleanup();
  });

  it('withhold: sensitive drop first sight notifies and audits drop dedup key (D-01)', async () => {
    const { ics, expected } = await loadFixture('sensitive', 'hr-review');
    const withholdNotifier = createMockWithholdNotifier();

    const caldav: CalDavReader = {
      poll: vi.fn().mockResolvedValueOnce({
        changed: [{ href: '/hr.ics', data: ics }],
        deleted: [],
      }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn(),
      cancel: vi.fn(),
    };

    const { deps, auditStore, cleanup } = buildDeps({
      caldav,
      writer,
      withholdNotifier,
    });

    await runSyncCycle(deps);

    expect(withholdNotifier.notifyWithhold).toHaveBeenCalledTimes(1);
    expect(withholdNotifier.notifyWithhold.mock.calls[0]?.[0].propagation).toBe('drop');

    const rows = auditStore.listAuditSince('1970-01-01T00:00:00.000Z');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.dedupKey).toContain(':drop:');
    expect(rows[0]?.sourceUid).toBe(expected.uid);
    expect(auditStore.getNotifyState({ uid: expected.uid })?.bridgeUuid).toBeTruthy();

    auditStore.close();
    deps.mappingStore.close();
    deps.syncStateStore.close();
    cleanup();
  });

  it('withhold: public then internal notifies once; repeated internal does not (D-01 busy)', async () => {
    const { ics: publicIcs } = await loadFixture('public', 'board-meeting');
    const busyIcs = publicIcs.replace(
      'CATEGORIES:ER-PUBLIC',
      'CATEGORIES:ER-INTERNAL',
    );
    const withholdNotifier = createMockWithholdNotifier();

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
        })
        .mockResolvedValueOnce({
          changed: [{ href: '/tier.ics', data: busyIcs }],
          deleted: [],
        }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-tier' }),
      cancel: vi.fn(),
    };

    const { deps, cleanup } = buildDeps({ caldav, writer, withholdNotifier });

    await runSyncCycle(deps);
    await runSyncCycle(deps);
    await runSyncCycle(deps);

    expect(withholdNotifier.notifyWithhold).toHaveBeenCalledTimes(1);
    expect(withholdNotifier.notifyWithhold.mock.calls[0]?.[0].propagation).toBe('busy');

    deps.auditStore.close();
    deps.mappingStore.close();
    deps.syncStateStore.close();
    cleanup();
  });

  it('withhold: public → internal → public → internal notifies twice (D-03)', async () => {
    const { ics: publicIcs } = await loadFixture('public', 'board-meeting');
    const busyIcs = publicIcs.replace(
      'CATEGORIES:ER-PUBLIC',
      'CATEGORIES:ER-INTERNAL',
    );
    const withholdNotifier = createMockWithholdNotifier();

    const caldav: CalDavReader = {
      poll: vi
        .fn()
        .mockResolvedValueOnce({
          changed: [{ href: '/ep.ics', data: publicIcs }],
          deleted: [],
        })
        .mockResolvedValueOnce({
          changed: [{ href: '/ep.ics', data: busyIcs }],
          deleted: [],
        })
        .mockResolvedValueOnce({
          changed: [{ href: '/ep.ics', data: publicIcs }],
          deleted: [],
        })
        .mockResolvedValueOnce({
          changed: [{ href: '/ep.ics', data: busyIcs }],
          deleted: [],
        }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-ep' }),
      cancel: vi.fn(),
    };

    const { deps, cleanup } = buildDeps({ caldav, writer, withholdNotifier });

    await runSyncCycle(deps);
    await runSyncCycle(deps);
    await runSyncCycle(deps);
    await runSyncCycle(deps);

    expect(withholdNotifier.notifyWithhold).toHaveBeenCalledTimes(2);

    deps.auditStore.close();
    deps.mappingStore.close();
    deps.syncStateStore.close();
    cleanup();
  });

  it('withhold: deleted tombstone does not call notifier (D-04)', async () => {
    const uid = 'team-sync-2026@er.example';
    const withholdNotifier = createMockWithholdNotifier();

    const { deps, mappingStore, cleanup } = buildDeps({
      caldav: {
        poll: vi.fn().mockResolvedValueOnce({
          changed: [],
          deleted: [{ href: '/gone.ics', uid }],
        }),
      },
      writer: {
        upsertOutbound: vi.fn(),
        cancel: vi.fn().mockResolvedValue(undefined),
      },
      withholdNotifier,
    });

    mappingStore.upsertMapping({
      uid,
      googleEventId: 'g-delete-me',
      status: 'active',
    });

    await runSyncCycle(deps);

    expect(withholdNotifier.notifyWithhold).not.toHaveBeenCalled();

    deps.auditStore.close();
    mappingStore.close();
    deps.syncStateStore.close();
    cleanup();
  });

  it('withhold: notify disabled records audit disabled without SMTP (D-05, D-16)', async () => {
    const { ics } = await loadFixture('internal', 'team-sync');
    const withholdNotifier = createMockWithholdNotifier();

    const caldav: CalDavReader = {
      poll: vi.fn().mockResolvedValueOnce({
        changed: [{ href: '/team-sync.ics', data: ics }],
        deleted: [],
      }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-internal' }),
      cancel: vi.fn(),
    };

    const { deps, auditStore, cleanup } = buildDeps({
      caldav,
      writer,
      withholdNotifier,
      notifyEnabled: false,
    });

    await runSyncCycle(deps);

    expect(withholdNotifier.notifyWithhold).not.toHaveBeenCalled();
    const rows = auditStore.listAuditSince('1970-01-01T00:00:00.000Z');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.notifyStatus).toBe('disabled');

    auditStore.close();
    deps.mappingStore.close();
    deps.syncStateStore.close();
    cleanup();
  });

  it('withhold: notifier rejection does not increment cycle errors (D-08)', async () => {
    const { ics } = await loadFixture('internal', 'team-sync');
    const withholdNotifier = createMockWithholdNotifier(
      vi.fn<WithholdNotifier['notifyWithhold']>().mockRejectedValue(
        new Error('smtp down'),
      ),
    );

    const caldav: CalDavReader = {
      poll: vi.fn().mockResolvedValueOnce({
        changed: [{ href: '/team-sync.ics', data: ics }],
        deleted: [],
      }),
    };
    const writer: CalendarWriter = {
      upsertOutbound: vi.fn().mockResolvedValue({ googleEventId: 'g-internal' }),
      cancel: vi.fn(),
    };

    const { deps, auditStore, cleanup } = buildDeps({
      caldav,
      writer,
      withholdNotifier,
    });

    const result = await runSyncCycle(deps);

    expect(result.errors).toBe(0);
    expect(result.lastSuccessAt).toBeDefined();
    const rows = auditStore.listAuditSince('1970-01-01T00:00:00.000Z');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.notifyStatus).toBe('failed');

    auditStore.close();
    deps.mappingStore.close();
    deps.syncStateStore.close();
    cleanup();
  });
});
