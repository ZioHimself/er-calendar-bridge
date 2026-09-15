import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const WRITE_API_SYMBOLS = [
  'createCalendarObject',
  'updateCalendarObject',
  'deleteCalendarObject',
  'createObject',
  'deleteObject',
  'updateObject',
];

const indexPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/adapters/caldav/index.ts',
);

describe('caldav adapter export surface (SEC-01)', () => {
  it('exports only createCalDavClient and createCalDavReader', async () => {
    const mod = await import('../../src/adapters/caldav/index.js');
    expect(Object.keys(mod).sort()).toEqual([
      'createCalDavClient',
      'createCalDavReader',
    ]);
  });

  it('index source does not reference tsdav write APIs', () => {
    const src = readFileSync(indexPath, 'utf8');
    for (const sym of WRITE_API_SYMBOLS) {
      expect(src).not.toContain(sym);
    }
  });
});
