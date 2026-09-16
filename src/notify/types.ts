import type { Tier } from '../domain/types/index.js';
import type { WithholdPropagation } from '../sync/withhold-transition.js';

export type WithholdNotifyParams = Readonly<{
  tier: Tier;
  propagation: WithholdPropagation;
  dedupKey: string;
}>;

export type WithholdNotifyResult = Readonly<{
  status: 'sent' | 'failed';
}>;

export interface WithholdNotifier {
  notifyWithhold(params: WithholdNotifyParams): Promise<WithholdNotifyResult>;
}
