import { describe, it, expect } from 'vitest';
import type { SourceEvent } from '../../src/domain/types/index.js';
import { washSourceEvent } from '../../src/domain/wash/index.js';

function richSource(overrides: Partial<SourceEvent> = {}): SourceEvent {
  return {
    uid: 'event@er.example',
    categories: ['ER-INTERNAL'],
    summary: 'Team sync',
    description: 'Secret agenda',
    location: 'Room 42',
    start: new Date('2026-09-16T08:00:00.000Z'),
    end: new Date('2026-09-16T08:30:00.000Z'),
    isRecurring: false,
    ...overrides,
  };
}

describe('washSourceEvent', () => {
  it('drop propagation → null regardless of rich source fields', () => {
    expect(washSourceEvent(richSource(), 'drop')).toBeNull();
  });

  describe('passthrough', () => {
    it('full propagation copies summary, description, location, categories', () => {
      const source = richSource();
      const outbound = washSourceEvent(source, 'full');
      expect(outbound).not.toBeNull();
      expect(outbound!.summary).toBe(source.summary);
      expect(outbound!.description).toBe(source.description);
      expect(outbound!.location).toBe(source.location);
      expect(outbound!.categories).toEqual(source.categories);
      expect(outbound!.uid).toBe(source.uid);
      expect(outbound!.start).toEqual(source.start);
      expect(outbound!.end).toEqual(source.end);
    });
  });

  describe('forbidden', () => {
    it('busy propagation uses summary Busy and whitelist fields only', () => {
      const source = richSource();
      const outbound = washSourceEvent(source, 'busy');
      expect(outbound).not.toBeNull();
      expect(outbound!.summary).toBe('Busy');
      expect(outbound!.uid).toBe(source.uid);
      expect(outbound!.start).toEqual(source.start);
      expect(outbound!.end).toEqual(source.end);
      expect('categories' in outbound!).toBe(false);
      expect('description' in outbound!).toBe(false);
      expect('location' in outbound!).toBe(false);
    });

    it('busy preserves isRecurring when source is recurring', () => {
      const outbound = washSourceEvent(
        richSource({ isRecurring: true }),
        'busy',
      );
      expect(outbound!.isRecurring).toBe(true);
    });

    it('busy preserves recurrenceId when present on source', () => {
      const recurrenceId = new Date('2026-09-15T07:00:00.000Z');
      const outbound = washSourceEvent(
        richSource({ recurrenceId, isRecurring: false }),
        'busy',
      );
      expect(outbound!.recurrenceId).toEqual(recurrenceId);
    });

    it('forced busy on public-looking source still strips PII', () => {
      const source = richSource({ categories: ['ER-PUBLIC'] });
      const outbound = washSourceEvent(source, 'busy');
      expect(outbound!.summary).toBe('Busy');
      expect('categories' in outbound!).toBe(false);
    });
  });
});
