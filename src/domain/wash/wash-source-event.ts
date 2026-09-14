import type {
  OutboundEvent,
  PropagationDecision,
  SourceEvent,
} from '../types/index.js';

const BUSY_SUMMARY = 'Busy';

export function washSourceEvent(
  source: SourceEvent,
  propagation: PropagationDecision,
): OutboundEvent | null {
  if (propagation === 'drop') {
    return null;
  }
  if (propagation === 'full') {
    return { ...source };
  }

  const outbound: OutboundEvent = {
    uid: source.uid,
    start: source.start,
    summary: BUSY_SUMMARY,
  };

  if (source.end !== undefined) {
    outbound.end = source.end;
  }
  if (source.recurrenceId !== undefined) {
    outbound.recurrenceId = source.recurrenceId;
  }
  if (source.isRecurring) {
    outbound.isRecurring = true;
  }

  return outbound;
}
