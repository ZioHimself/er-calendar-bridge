import { classifySourceEvent } from './classify/classify-source-event.js';
import type { ProcessedSourceEvent, SourceEvent } from './types/index.js';
import { washSourceEvent } from './wash/wash-source-event.js';

export function processSourceEvent(source: SourceEvent): ProcessedSourceEvent {
  const { tier, propagation } = classifySourceEvent(source);
  const outbound = washSourceEvent(source, propagation);
  return { tier, propagation, outbound };
}
