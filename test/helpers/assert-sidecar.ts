import type { SourceEvent } from '../../src/domain/types/index.js';
import type { FixtureExpected } from './load-fixture.js';
import { getCategories } from './parse-ics.js';

export function assertTier(event: SourceEvent, expected: FixtureExpected): void {
  if (event.uid !== expected.uid) {
    throw new Error(
      `UID mismatch: expected ${expected.uid}, got ${event.uid}`,
    );
  }

  const categories = getCategories(event);
  for (const cat of expected.categories) {
    if (!categories.includes(cat)) {
      throw new Error(
        `Missing category ${cat}: got [${categories.join(', ')}]`,
      );
    }
  }

  // TODO: full washed-field comparison in Phase 2
}
