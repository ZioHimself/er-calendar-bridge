export type WithholdPropagation = 'full' | 'busy' | 'drop';

export function computeWithholdTransition(params: {
  previousPropagation: WithholdPropagation | undefined;
  currentPropagation: WithholdPropagation;
  episode: number;
  bridgeUuid: string;
}): {
  shouldRecord: boolean;
  shouldAttemptNotify: boolean;
  nextEpisode: number;
  nextPropagation: WithholdPropagation;
  dedupKey: string | null;
} {
  const { previousPropagation, currentPropagation, episode, bridgeUuid } =
    params;

  if (currentPropagation === 'full') {
    return {
      shouldRecord: false,
      shouldAttemptNotify: false,
      nextEpisode: episode,
      nextPropagation: 'full',
      dedupKey: null,
    };
  }

  if (previousPropagation === currentPropagation) {
    return {
      shouldRecord: false,
      shouldAttemptNotify: false,
      nextEpisode: episode,
      nextPropagation: currentPropagation,
      dedupKey: null,
    };
  }

  let nextEpisode = episode;
  if (previousPropagation === 'full') {
    nextEpisode = episode + 1;
  } else if (previousPropagation === undefined) {
    nextEpisode = 1;
  }

  const dedupKey = `${bridgeUuid}:${currentPropagation}:${nextEpisode}`;
  return {
    shouldRecord: true,
    shouldAttemptNotify: true,
    nextEpisode,
    nextPropagation: currentPropagation,
    dedupKey,
  };
}
