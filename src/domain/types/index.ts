export type Tier = 'public' | 'internal' | 'sensitive' | 'untagged';

export type PropagationDecision = 'full' | 'busy' | 'drop';

export interface SourceEvent {
  uid: string;
  categories: string[];
  summary?: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  recurrenceId?: Date;
  isRecurring: boolean;
}
