import type {
  OutboundEvent,
  ProcessedSourceEvent,
  SourceEvent,
} from '../../src/domain/types/index.js';
import type { FixtureExpected } from './load-fixture.js';
import { getCategories } from './parse-ics.js';

const DATE_FIELDS = ['start', 'end', 'recurrenceId'] as const;

function normalizeWashedDates(
  washed: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...washed };
  for (const field of DATE_FIELDS) {
    const value = out[field];
    if (typeof value === 'string') {
      out[field] = new Date(value);
    }
  }
  return out;
}

export function assertBusyOutbound(outbound: OutboundEvent): void {
  if (outbound.summary !== 'Busy') {
    throw new Error(`Expected summary 'Busy', got ${outbound.summary}`);
  }
  for (const key of ['categories', 'description', 'location'] as const) {
    if (Object.prototype.hasOwnProperty.call(outbound, key)) {
      throw new Error(`Busy outbound must not include ${key}`);
    }
  }
}

function outboundMatchesExpected(
  outbound: OutboundEvent,
  expectedWashed: Record<string, unknown>,
): void {
  const normalized = normalizeWashedDates(expectedWashed);
  for (const [key, expectedValue] of Object.entries(normalized)) {
    const actual = (outbound as unknown as Record<string, unknown>)[key];
    if (expectedValue instanceof Date && actual instanceof Date) {
      if (actual.getTime() !== expectedValue.getTime()) {
        throw new Error(
          `${key} mismatch: expected ${expectedValue.toISOString()}, got ${actual.toISOString()}`,
        );
      }
      continue;
    }
    if (actual !== expectedValue) {
      throw new Error(`${key} mismatch: expected ${expectedValue}, got ${actual}`);
    }
  }
  for (const key of Object.keys(outbound)) {
    if (!(key in normalized)) {
      throw new Error(`Unexpected key on outbound: ${key}`);
    }
  }
}

export function assertProcessed(
  result: ProcessedSourceEvent,
  expected: FixtureExpected,
): void {
  if (result.tier !== expected.tier) {
    throw new Error(`Tier mismatch: expected ${expected.tier}, got ${result.tier}`);
  }
  if (result.propagation !== expected.propagation) {
    throw new Error(
      `Propagation mismatch: expected ${expected.propagation}, got ${result.propagation}`,
    );
  }

  if (expected.propagation === 'drop') {
    if (result.outbound !== null) {
      throw new Error('Expected null outbound for drop propagation');
    }
    return;
  }

  if (expected.propagation === 'full' && expected.washed === null) {
    if (result.outbound === null) {
      throw new Error('Expected non-null outbound for full propagation');
    }
    if (!result.outbound.uid) {
      throw new Error('Full outbound missing uid');
    }
    if (
      expected.categories.length > 0 &&
      (!result.outbound.categories ||
        result.outbound.categories.length === 0)
    ) {
      throw new Error('Full outbound missing categories');
    }
    return;
  }

  if (expected.washed !== null) {
    if (result.outbound === null) {
      throw new Error('Expected washed outbound but got null');
    }
    assertBusyOutbound(result.outbound);
    outboundMatchesExpected(result.outbound, expected.washed);
  }
}

export function assertTier(event: SourceEvent, expected: FixtureExpected): void {
  if (event.uid !== expected.uid) {
    throw new Error(
      `UID mismatch: expected ${expected.uid}, got ${event.uid}`,
    );
  }

  const categories = getCategories(event);
  for (const cat of expected.categories) {
    if (!categories.includes(cat)) {
      throw new Error(
        `Missing category ${cat}: got [${categories.join(', ')}]`,
      );
    }
  }
}
