import { describe, it, expect } from 'vitest';
import { computeWithholdTransition } from '../../src/sync/withhold-transition.js';

const BRIDGE_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('computeWithholdTransition', () => {
  it('undefined → busy: records, notifies, episode 1, dedup key (D-01 busy)', () => {
    const result = computeWithholdTransition({
      previousPropagation: undefined,
      currentPropagation: 'busy',
      episode: 0,
      bridgeUuid: BRIDGE_UUID,
    });
    expect(result).toEqual({
      shouldRecord: true,
      shouldAttemptNotify: true,
      nextEpisode: 1,
      nextPropagation: 'busy',
      dedupKey: `${BRIDGE_UUID}:busy:1`,
    });
  });

  it('undefined → drop: records, notifies, episode 1, dedup key (D-01 drop)', () => {
    const result = computeWithholdTransition({
      previousPropagation: undefined,
      currentPropagation: 'drop',
      episode: 0,
      bridgeUuid: BRIDGE_UUID,
    });
    expect(result).toEqual({
      shouldRecord: true,
      shouldAttemptNotify: true,
      nextEpisode: 1,
      nextPropagation: 'drop',
      dedupKey: `${BRIDGE_UUID}:drop:1`,
    });
  });

  it('busy → busy: no record or notify, dedup null (D-02, D-14)', () => {
    const result = computeWithholdTransition({
      previousPropagation: 'busy',
      currentPropagation: 'busy',
      episode: 2,
      bridgeUuid: BRIDGE_UUID,
    });
    expect(result).toEqual({
      shouldRecord: false,
      shouldAttemptNotify: false,
      nextEpisode: 2,
      nextPropagation: 'busy',
      dedupKey: null,
    });
  });

  it('drop → drop: no record or notify across polls (D-02, D-14)', () => {
    const result = computeWithholdTransition({
      previousPropagation: 'drop',
      currentPropagation: 'drop',
      episode: 1,
      bridgeUuid: BRIDGE_UUID,
    });
    expect(result).toEqual({
      shouldRecord: false,
      shouldAttemptNotify: false,
      nextEpisode: 1,
      nextPropagation: 'drop',
      dedupKey: null,
    });
  });

  it('busy → drop: new transition, same episode, drop dedup key', () => {
    const result = computeWithholdTransition({
      previousPropagation: 'busy',
      currentPropagation: 'drop',
      episode: 1,
      bridgeUuid: BRIDGE_UUID,
    });
    expect(result).toEqual({
      shouldRecord: true,
      shouldAttemptNotify: true,
      nextEpisode: 1,
      nextPropagation: 'drop',
      dedupKey: `${BRIDGE_UUID}:drop:1`,
    });
  });

  it('full → busy: increments episode and new dedup key (D-03)', () => {
    const result = computeWithholdTransition({
      previousPropagation: 'full',
      currentPropagation: 'busy',
      episode: 1,
      bridgeUuid: BRIDGE_UUID,
    });
    expect(result).toEqual({
      shouldRecord: true,
      shouldAttemptNotify: true,
      nextEpisode: 2,
      nextPropagation: 'busy',
      dedupKey: `${BRIDGE_UUID}:busy:2`,
    });
  });

  it('full → busy → full → busy: second busy episode and distinct dedup keys (D-03)', () => {
    const first = computeWithholdTransition({
      previousPropagation: 'full',
      currentPropagation: 'busy',
      episode: 0,
      bridgeUuid: BRIDGE_UUID,
    });
    expect(first.dedupKey).toBe(`${BRIDGE_UUID}:busy:1`);

    const backToFull = computeWithholdTransition({
      previousPropagation: 'busy',
      currentPropagation: 'full',
      episode: first.nextEpisode,
      bridgeUuid: BRIDGE_UUID,
    });
    expect(backToFull.shouldRecord).toBe(false);
    expect(backToFull.nextEpisode).toBe(1);

    const secondBusy = computeWithholdTransition({
      previousPropagation: 'full',
      currentPropagation: 'busy',
      episode: backToFull.nextEpisode,
      bridgeUuid: BRIDGE_UUID,
    });
    expect(secondBusy).toEqual({
      shouldRecord: true,
      shouldAttemptNotify: true,
      nextEpisode: 2,
      nextPropagation: 'busy',
      dedupKey: `${BRIDGE_UUID}:busy:2`,
    });
    expect(secondBusy.dedupKey).not.toBe(first.dedupKey);
  });

  it('full propagation: no record, notify, or dedup key', () => {
    const result = computeWithholdTransition({
      previousPropagation: 'busy',
      currentPropagation: 'full',
      episode: 3,
      bridgeUuid: BRIDGE_UUID,
    });
    expect(result).toEqual({
      shouldRecord: false,
      shouldAttemptNotify: false,
      nextEpisode: 3,
      nextPropagation: 'full',
      dedupKey: null,
    });
  });
});
