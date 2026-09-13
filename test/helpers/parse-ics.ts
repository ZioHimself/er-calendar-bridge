import {
  parseIcsToSourceEvent,
  getCategories,
} from '../../src/adapters/ical/index.js';
import type { SourceEvent } from '../../src/domain/types/index.js';

export function parseIcs(ics: string): SourceEvent {
  return parseIcsToSourceEvent(ics);
}

export { getCategories };
