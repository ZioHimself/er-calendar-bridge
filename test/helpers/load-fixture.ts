import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, '..', 'fixtures');

export interface FixtureExpected {
  uid: string;
  categories: string[];
  tier: 'public' | 'internal' | 'sensitive' | 'untagged';
  propagation: 'full' | 'busy' | 'drop';
  washed: Record<string, unknown> | null;
}

export async function loadFixture(
  tier: 'public' | 'internal' | 'sensitive' | 'untagged' | 'recurrence',
  name: string,
): Promise<{ ics: string; expected: FixtureExpected }> {
  const dir = join(FIXTURES_ROOT, tier);
  const ics = await readFile(join(dir, `${name}.ics`), 'utf8');
  const expected = JSON.parse(
    await readFile(join(dir, `${name}.expected.json`), 'utf8'),
  ) as FixtureExpected;
  return { ics, expected };
}
