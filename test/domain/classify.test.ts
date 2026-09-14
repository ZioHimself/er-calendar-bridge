import { describe, it, expect } from 'vitest';
import type { SourceEvent } from '../../src/domain/types/index.js';
import { classifySourceEvent } from '../../src/domain/classify/index.js';

function sourceEvent(
  categories: string[],
  overrides: Partial<SourceEvent> = {},
): SourceEvent {
  return {
    uid: 'test@er.example',
    categories,
    start: new Date('2026-09-01T10:00:00.000Z'),
    isRecurring: false,
    ...overrides,
  };
}

describe('classifySourceEvent', () => {
  it('ER-SENSITIVE only → sensitive tier and drop propagation', () => {
    const result = classifySourceEvent(sourceEvent(['ER-SENSITIVE']));
    expect(result).toEqual({ tier: 'sensitive', propagation: 'drop' });
  });

  it('empty categories → untagged tier and busy propagation', () => {
    const result = classifySourceEvent(sourceEvent([]));
    expect(result).toEqual({ tier: 'untagged', propagation: 'busy' });
  });

  it('ER-PUBLIC only → public tier and full propagation', () => {
    const result = classifySourceEvent(sourceEvent(['ER-PUBLIC']));
    expect(result).toEqual({ tier: 'public', propagation: 'full' });
  });

  it('ER-INTERNAL only → internal tier and busy propagation', () => {
    const result = classifySourceEvent(sourceEvent(['ER-INTERNAL']));
    expect(result).toEqual({ tier: 'internal', propagation: 'busy' });
  });

  it('ER-PUBLIC + ER-INTERNAL → internal tier and busy (strictest wins)', () => {
    const result = classifySourceEvent(
      sourceEvent(['ER-PUBLIC', 'ER-INTERNAL']),
    );
    expect(result).toEqual({ tier: 'internal', propagation: 'busy' });
  });

  it('ER-PUBLIC + non-ER category → internal tier and busy', () => {
    const result = classifySourceEvent(
      sourceEvent(['ER-PUBLIC', 'CONFERENCE']),
    );
    expect(result).toEqual({ tier: 'internal', propagation: 'busy' });
  });

  it('unknown-only categories → internal tier and busy', () => {
    const result = classifySourceEvent(sourceEvent(['WORK']));
    expect(result).toEqual({ tier: 'internal', propagation: 'busy' });
  });

  it('case-insensitive ER-PUBLIC → full public path', () => {
    const result = classifySourceEvent(sourceEvent(['er-public']));
    expect(result).toEqual({ tier: 'public', propagation: 'full' });
  });

  it('trimmed ER-PUBLIC token → full public path', () => {
    const result = classifySourceEvent(sourceEvent([' ER-PUBLIC ']));
    expect(result).toEqual({ tier: 'public', propagation: 'full' });
  });
});
