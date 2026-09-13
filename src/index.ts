import { fileURLToPath } from 'node:url';

export const VERSION = '0.0.0';

export function main(): void {
  console.log(`er-calendar-bridge v${VERSION} — scaffold only`);
}

// Allow `tsx src/index.ts` without CLI framework
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
