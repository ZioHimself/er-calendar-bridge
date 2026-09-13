import ical from 'node-ical';
import type { CalendarResponse, VEvent } from 'node-ical';
import type { SourceEvent } from '../../domain/types/index.js';

function findFirstVEvent(data: CalendarResponse): VEvent {
  for (const item of Object.values(data)) {
    if (item && typeof item === 'object' && item.type === 'VEVENT') {
      return item;
    }
  }
  throw new Error('No VEVENT found in fixture');
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'val' in value) {
    return String((value as { val: unknown }).val);
  }
  return undefined;
}

export function parseIcsToSourceEvent(ics: string): SourceEvent {
  const vevent = findFirstVEvent(ical.parseICS(ics));

  if (!vevent.uid) {
    throw new Error('VEVENT missing required UID');
  }
  if (!vevent.start) {
    throw new Error('VEVENT missing required DTSTART');
  }

  return {
    uid: vevent.uid,
    categories: vevent.categories ?? [],
    summary: asString(vevent.summary),
    description: asString(vevent.description),
    location: asString(vevent.location),
    start: vevent.start,
    end: vevent.end,
    recurrenceId: vevent.recurrenceid,
    isRecurring: Boolean(vevent.rrule),
  };
}

export function getCategories(event: SourceEvent): string[] {
  return event.categories;
}
