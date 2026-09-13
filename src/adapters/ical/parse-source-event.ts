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

type ParsableVEvent = Pick<
  VEvent,
  | 'uid'
  | 'start'
  | 'categories'
  | 'summary'
  | 'description'
  | 'location'
  | 'end'
  | 'recurrenceid'
  | 'rrule'
>;

function veventToSourceEvent(vevent: ParsableVEvent): SourceEvent {
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

function collectRecurrenceOverrides(vevent: VEvent): ParsableVEvent[] {
  if (!vevent.recurrences) {
    return [];
  }

  const overrides: ParsableVEvent[] = [];
  const seen = new Set<string>();

  for (const recurrence of Object.values(vevent.recurrences)) {
    if (!recurrence || recurrence.type !== 'VEVENT' || !recurrence.recurrenceid) {
      continue;
    }
    const recurrenceId = recurrence.recurrenceid;
    if (!(recurrenceId instanceof Date)) {
      continue;
    }
    const key = recurrenceId.toISOString();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    overrides.push(recurrence as ParsableVEvent);
  }

  return overrides;
}

export function parseIcsToSourceEvents(ics: string): SourceEvent[] {
  const vevent = findFirstVEvent(ical.parseICS(ics));
  const events = [veventToSourceEvent(vevent)];

  for (const override of collectRecurrenceOverrides(vevent)) {
    events.push(veventToSourceEvent(override));
  }

  return events;
}

export function parseIcsToSourceEvent(ics: string): SourceEvent {
  const events = parseIcsToSourceEvents(ics);
  const override = events.find((event) => event.recurrenceId !== undefined);
  const primary = events[0];
  if (!primary) {
    throw new Error('No VEVENT found in fixture');
  }
  return override ?? primary;
}

export function getCategories(event: SourceEvent): string[] {
  return event.categories;
}
