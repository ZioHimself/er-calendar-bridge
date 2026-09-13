import { describe, it, expect } from 'vitest';
import { loadFixture } from './helpers/load-fixture.js';
import { parseIcs, getCategories } from './helpers/parse-ics.js';
import { assertTier } from './helpers/assert-sidecar.js';

const TIER_FIXTURES = [
  { tier: 'public' as const, name: 'board-meeting' },
  { tier: 'internal' as const, name: 'team-sync' },
  { tier: 'sensitive' as const, name: 'hr-review' },
  { tier: 'untagged' as const, name: 'unclassified' },
];

describe('fixture harness smoke', () => {
  for (const { tier, name } of TIER_FIXTURES) {
    it(`parses ${tier}/${name} and matches sidecar`, async () => {
      const { ics, expected } = await loadFixture(tier, name);
      const event = parseIcs(ics);

      expect(event.uid).toBe(expected.uid);

      if (tier === 'untagged') {
        expect(getCategories(event)).toEqual([]);
      } else {
        const categories = getCategories(event);
        expect(categories.length).toBeGreaterThan(0);
        for (const cat of expected.categories) {
          expect(categories).toContain(cat);
        }
        assertTier(event, expected);
      }
    });
  }

  it('parses recurrence fixtures without error', async () => {
    const recurrenceFixtures = [
      'weekly-series',
      'modified-instance',
      'deleted-instance',
    ];

    for (const name of recurrenceFixtures) {
      const { ics } = await loadFixture('recurrence', name);
      const event = parseIcs(ics);
      expect(event.uid).toBeTruthy();
    }
  });
});
