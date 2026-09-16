import { afterEach, describe, expect, it, vi } from 'vitest';
import { openAuditStore } from '../../src/store/audit-store.js';

const ALLOWED_AUDIT_ROW_KEYS = new Set([
  'id',
  'recordedAt',
  'sourceUid',
  'recurrenceId',
  'tier',
  'propagation',
  'notifyStatus',
  'dedupKey',
  'error',
]);

function memoryStore() {
  return openAuditStore(':memory:');
}

describe('openAuditStore', () => {
  let store: ReturnType<typeof openAuditStore>;

  afterEach(() => {
    store?.close();
  });

  it('creates withhold_notify_state and withhold_audit via schema bootstrap', () => {
    store = memoryStore();
    store.upsertNotifyState({
      uid: 'schema-check@example',
      bridgeUuid: '11111111-1111-4111-8111-111111111111',
      lastPropagation: 'drop',
      episode: 1,
    });
    store.appendAuditRow({
      uid: 'schema-check@example',
      tier: 'sensitive',
      propagation: 'drop',
      notifyStatus: 'skipped',
      dedupKey: '11111111-1111-4111-8111-111111111111:drop:1',
    });

    expect(store.getNotifyState({ uid: 'schema-check@example' })).toBeDefined();
    expect(store.listAuditSince('1970-01-01T00:00:00.000Z')).toHaveLength(1);
  });

  it('upsertNotifyState stores bridge_uuid, last_propagation, and episode', () => {
    store = memoryStore();
    const bridgeUuid = '22222222-2222-4222-8222-222222222222';
    const instanceStart = new Date('2026-09-15T14:00:00.000Z');

    store.upsertNotifyState({
      uid: 'state@example',
      recurrenceId: instanceStart,
      bridgeUuid,
      lastPropagation: 'busy',
      episode: 2,
    });

    const row = store.getNotifyState({
      uid: 'state@example',
      recurrenceId: instanceStart,
    });
    expect(row).toEqual({
      sourceUid: 'state@example',
      recurrenceId: '2026-09-15T14:00:00.000Z',
      bridgeUuid,
      lastPropagation: 'busy',
      episode: 2,
    });
  });

  it('persists bridge_uuid for first-sight withhold without google_event_id mapping', () => {
    store = memoryStore();
    const bridgeUuid = '33333333-3333-4333-8333-333333333333';

    store.upsertNotifyState({
      uid: 'first-drop@example',
      bridgeUuid,
      lastPropagation: 'drop',
      episode: 1,
    });

    expect(store.getNotifyState({ uid: 'first-drop@example' })?.bridgeUuid).toBe(
      bridgeUuid,
    );
  });

  it('appendAuditRow accepts notify_status sent|skipped|failed|disabled', () => {
    store = memoryStore();
    const statuses = ['sent', 'skipped', 'failed', 'disabled'] as const;

    for (const notifyStatus of statuses) {
      store.appendAuditRow({
        uid: `status-${notifyStatus}@example`,
        tier: 'sensitive',
        propagation: 'drop',
        notifyStatus,
        dedupKey: `key:${notifyStatus}`,
      });
    }

    const rows = store.listAuditSince('1970-01-01T00:00:00.000Z');
    expect(rows.map((r) => r.notifyStatus).sort()).toEqual(
      [...statuses].sort(),
    );
  });

  it('listAuditSince returns rows with recorded_at >= since ordered ascending', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T10:00:00.000Z'));
    store = memoryStore();

    store.appendAuditRow({
      uid: 'a@example',
      tier: 'sensitive',
      propagation: 'drop',
      notifyStatus: 'sent',
      dedupKey: 'a:drop:1',
    });

    vi.setSystemTime(new Date('2026-09-16T10:01:00.000Z'));
    store.appendAuditRow({
      uid: 'b@example',
      tier: 'sensitive',
      propagation: 'drop',
      notifyStatus: 'sent',
      dedupKey: 'b:drop:1',
    });

    vi.setSystemTime(new Date('2026-09-16T10:02:00.000Z'));
    store.appendAuditRow({
      uid: 'c@example',
      tier: 'sensitive',
      propagation: 'drop',
      notifyStatus: 'sent',
      dedupKey: 'c:drop:1',
    });

    const filtered = store.listAuditSince('2026-09-16T10:00:30.000Z');
    expect(filtered.map((r) => r.sourceUid)).toEqual([
      'b@example',
      'c@example',
    ]);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]!.recordedAt <= filtered[1]!.recordedAt).toBe(true);

    vi.useRealTimers();
  });

  it('audit rows expose only D-16 fields (no title or summary)', () => {
    store = memoryStore();
    store.appendAuditRow({
      uid: 'pii-free@example',
      tier: 'sensitive',
      propagation: 'drop',
      notifyStatus: 'sent',
      dedupKey: 'pii-free:drop:1',
      error: 'smtp timeout',
    });

    const rows = store.listAuditSince('1970-01-01T00:00:00.000Z');
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    for (const key of Object.keys(row)) {
      expect(ALLOWED_AUDIT_ROW_KEYS.has(key)).toBe(true);
    }
    expect(row).not.toHaveProperty('title');
    expect(row).not.toHaveProperty('summary');
  });

  it('getNotifyState returns undefined for unknown uid', () => {
    store = memoryStore();
    expect(store.getNotifyState({ uid: 'missing@example' })).toBeUndefined();
  });

  it('master event uses empty recurrence_id matching mapping-store convention', () => {
    store = memoryStore();
    store.upsertNotifyState({
      uid: 'master@example',
      bridgeUuid: '44444444-4444-4444-8444-444444444444',
      lastPropagation: 'full',
      episode: 1,
    });

    const master = store.getNotifyState({ uid: 'master@example' });
    expect(master?.recurrenceId).toBeUndefined();

    store.appendAuditRow({
      uid: 'master@example',
      tier: 'internal',
      propagation: 'busy',
      notifyStatus: 'sent',
      dedupKey: '44444444-4444-4444-8444-444444444444:busy:1',
    });

    const auditRows = store.listAuditSince('1970-01-01T00:00:00.000Z');
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!.recurrenceId).toBeUndefined();
  });
});
