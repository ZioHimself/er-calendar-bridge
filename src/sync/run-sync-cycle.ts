import { randomUUID } from 'node:crypto';
import { parseIcsToSourceEvents } from '../adapters/ical/index.js';
import { processSourceEvent } from '../domain/process-source-event.js';
import type { ProcessedSourceEvent, SourceEvent } from '../domain/types/index.js';
import type { NotifyStatus } from '../store/audit-store.js';
import {
  computeWithholdTransition,
  type WithholdPropagation,
} from './withhold-transition.js';
import type { SyncCycleDeps, SyncCycleResult } from './types.js';

function isRecurringInstance(source: SourceEvent): boolean {
  return source.recurrenceId !== undefined;
}

function propagationFromState(
  lastPropagation: string | undefined,
): WithholdPropagation | undefined {
  if (
    lastPropagation === 'full' ||
    lastPropagation === 'busy' ||
    lastPropagation === 'drop'
  ) {
    return lastPropagation;
  }
  return undefined;
}

async function handleWithholdSideEffects(
  deps: SyncCycleDeps,
  source: SourceEvent,
  processed: ProcessedSourceEvent,
  bridgeUuid: string,
): Promise<void> {
  const state = deps.auditStore.getNotifyState({
    uid: source.uid,
    recurrenceId: source.recurrenceId,
  });

  const transition = computeWithholdTransition({
    previousPropagation: propagationFromState(state?.lastPropagation),
    currentPropagation: processed.propagation,
    episode: state?.episode ?? 0,
    bridgeUuid,
  });

  if (!transition.shouldRecord) {
    if (processed.propagation === 'full') {
      deps.auditStore.upsertNotifyState({
        uid: source.uid,
        recurrenceId: source.recurrenceId,
        bridgeUuid,
        lastPropagation: 'full',
        episode: transition.nextEpisode,
      });
    }
    return;
  }

  let notifyStatus: NotifyStatus;
  let errorMessage: string | undefined;

  if (!deps.notifyEnabled) {
    notifyStatus = 'disabled';
  } else {
    try {
      const notifyResult = await deps.withholdNotifier.notifyWithhold({
        tier: processed.tier,
        propagation: processed.propagation,
        dedupKey: transition.dedupKey!,
      });
      notifyStatus = notifyResult.status === 'sent' ? 'sent' : 'failed';
    } catch (err) {
      deps.log.error(
        { uid: source.uid, recurrenceId: source.recurrenceId, err },
        'withhold notify failed',
      );
      notifyStatus = 'failed';
      errorMessage = err instanceof Error ? err.message : String(err);
    }
  }

  deps.auditStore.appendAuditRow({
    uid: source.uid,
    recurrenceId: source.recurrenceId,
    tier: processed.tier,
    propagation: processed.propagation,
    notifyStatus,
    dedupKey: transition.dedupKey!,
    error: errorMessage,
  });

  deps.auditStore.upsertNotifyState({
    uid: source.uid,
    recurrenceId: source.recurrenceId,
    bridgeUuid,
    lastPropagation: transition.nextPropagation,
    episode: transition.nextEpisode,
  });
}

async function handleOutboundEvent(
  deps: SyncCycleDeps,
  source: SourceEvent,
  href: string,
  etag: string | undefined,
  result: SyncCycleResult,
): Promise<void> {
  const processed = processSourceEvent(source);
  const mapping = deps.mappingStore.getMapping({
    uid: source.uid,
    recurrenceId: source.recurrenceId,
  });

  const notifyState = deps.auditStore.getNotifyState({
    uid: source.uid,
    recurrenceId: source.recurrenceId,
  });
  const bridgeUuid =
    mapping?.bridgeUuid ?? notifyState?.bridgeUuid ?? randomUUID();

  if (processed.propagation === 'drop') {
    result.dropped += 1;
    if (mapping?.status === 'active') {
      await deps.writer.cancel({
        googleEventId: mapping.googleEventId,
        isRecurringInstance: isRecurringInstance(source),
      });
      deps.mappingStore.markCancelled({
        uid: source.uid,
        recurrenceId: source.recurrenceId,
      });
      result.cancelled += 1;
    }
    await handleWithholdSideEffects(deps, source, processed, bridgeUuid);
    return;
  }

  if (!processed.outbound) {
    return;
  }

  const existingGoogleEventId =
    mapping?.status === 'active' ? mapping.googleEventId : undefined;

  const { googleEventId } = await deps.writer.upsertOutbound({
    mappingKey: {
      uid: source.uid,
      recurrenceId: source.recurrenceId?.toISOString(),
    },
    outbound: processed.outbound,
    existingGoogleEventId,
    bridgeUuid,
  });

  if (existingGoogleEventId) {
    result.updated += 1;
  } else {
    result.created += 1;
  }

  deps.mappingStore.upsertMapping({
    uid: source.uid,
    recurrenceId: source.recurrenceId,
    googleEventId,
    bridgeUuid,
    status: 'active',
    lastSourceEtag: etag,
    caldavHref: href,
  });

  await handleWithholdSideEffects(deps, source, processed, bridgeUuid);
}

async function handleDeletedTombstone(
  deps: SyncCycleDeps,
  params: { uid: string; recurrenceId?: string },
  result: SyncCycleResult,
): Promise<void> {
  const recurrenceId =
    params.recurrenceId !== undefined
      ? new Date(params.recurrenceId)
      : undefined;

  const mapping = deps.mappingStore.getMapping({
    uid: params.uid,
    recurrenceId,
  });

  if (mapping?.status !== 'active') {
    return;
  }

  await deps.writer.cancel({
    googleEventId: mapping.googleEventId,
    isRecurringInstance: recurrenceId !== undefined,
  });
  deps.mappingStore.markCancelled({
    uid: params.uid,
    recurrenceId,
  });
  result.cancelled += 1;
}

export async function runSyncCycle(deps: SyncCycleDeps): Promise<SyncCycleResult> {
  const now = deps.now ?? (() => new Date());
  const result: SyncCycleResult = {
    created: 0,
    updated: 0,
    cancelled: 0,
    dropped: 0,
    errors: 0,
  };

  const delta = await deps.caldav.poll();

  for (const item of delta.changed) {
    let sources: SourceEvent[];
    try {
      sources = parseIcsToSourceEvents(item.data);
    } catch (err) {
      deps.log.error({ href: item.href, err }, 'failed to parse changed ICS');
      result.errors += 1;
      continue;
    }

    for (const source of sources) {
      try {
        await handleOutboundEvent(deps, source, item.href, item.etag, result);
      } catch (err) {
        deps.log.error(
          { uid: source.uid, recurrenceId: source.recurrenceId, err },
          'sync event failed',
        );
        result.errors += 1;
      }
    }
  }

  for (const tombstone of delta.deleted) {
    if (!tombstone.uid) {
      continue;
    }
    try {
      await handleDeletedTombstone(
        deps,
        { uid: tombstone.uid, recurrenceId: tombstone.recurrenceId },
        result,
      );
    } catch (err) {
      deps.log.error(
        {
          uid: tombstone.uid,
          recurrenceId: tombstone.recurrenceId,
          href: tombstone.href,
          err,
        },
        'sync delete failed',
      );
      result.errors += 1;
    }
  }

  const isoTimestamp = now().toISOString();
  deps.syncStateStore.recordSuccess(deps.calendarUrl, isoTimestamp);
  result.lastSuccessAt = now();

  deps.log.info(
    {
      created: result.created,
      updated: result.updated,
      cancelled: result.cancelled,
      dropped: result.dropped,
      errors: result.errors,
      lastSuccessAt: isoTimestamp,
    },
    'sync cycle complete',
  );

  return result;
}
