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

export function classifySourceEvent(event: SourceEvent): Classification {
  const tokens = event.categories.map((c) => c.trim()).filter(Boolean);
  const norm = tokens.map(normalizeToken);

  if (norm.includes(ER.SENSITIVE)) {
    return { tier: 'sensitive', propagation: 'drop' };
  }
  if (tokens.length === 0) {
    return { tier: 'untagged', propagation: 'busy' };
  }

  const hasPublic = norm.includes(ER.PUBLIC);
  const hasInternal = norm.includes(ER.INTERNAL);
  const hasNonEr = tokens.some((_, i) => !isErToken(norm[i]!));

  if (hasPublic && !hasInternal && !hasNonEr) {
    return { tier: 'public', propagation: 'full' };
  }
  return { tier: 'internal', propagation: 'busy' };
}
