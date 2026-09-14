import type { Classification, SourceEvent } from '../types/index.js';

const ER = {
  PUBLIC: 'er-public',
  INTERNAL: 'er-internal',
  SENSITIVE: 'er-sensitive',
} as const;

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase();
}

function isErToken(norm: string): boolean {
  return norm === ER.PUBLIC || norm === ER.INTERNAL || norm === ER.SENSITIVE;
}

export function classifySourceEvent(_event: SourceEvent): Classification {
  throw new Error('not implemented');
}
