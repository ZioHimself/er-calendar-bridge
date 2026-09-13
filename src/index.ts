export const VERSION = '0.0.0';

export function main(): void {
  console.log(`er-calendar-bridge v${VERSION} — scaffold only`);
}

// Allow `tsx src/index.ts` without CLI framework
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
