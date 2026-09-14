import { describe, it, expect } from 'vitest';
import { loadFixture } from '../helpers/load-fixture.js';
import { parseIcs } from '../helpers/parse-ics.js';
import { assertProcessed } from '../helpers/assert-sidecar.js';
import { processSourceEvent } from '../../src/domain/process-source-event.js';

const TIER_FIXTURES = [
  { tier: 'public' as const, name: 'board-meeting' },
  { tier: 'internal' as const, name: 'team-sync' },
  { tier: 'sensitive' as const, name: 'hr-review' },
  { tier: 'untagged' as const, name: 'unclassified' },
];

const RECURRENCE_FIXTURES = [
  'weekly-series',
  'modified-instance',
  'deleted-instance',
];

describe('parse → processSourceEvent pipeline', () => {
  for (const { tier, name } of TIER_FIXTURES) {
    it(`${tier}/${name} matches sidecar tier, propagation, and washed`, async () => {
      const { ics, expected } = await loadFixture(tier, name);
      const result = processSourceEvent(parseIcs(ics));
      assertProcessed(result, expected);

      if (tier === 'public') {
        expect(result.outbound?.summary).not.toBe('Busy');
        expect(result.outbound?.summary).toBeTruthy();
      }
      if (tier === 'sensitive') {
        expect(result.outbound).toBeNull();
        expect(result.propagation).toBe('drop');
      }
    });
  }

  for (const name of RECURRENCE_FIXTURES) {
    it(`recurrence/${name} matches full pipeline sidecar`, async () => {
      const { ics, expected } = await loadFixture('recurrence', name);
      const result = processSourceEvent(parseIcs(ics));
      assertProcessed(result, expected);
    });
  }
});
