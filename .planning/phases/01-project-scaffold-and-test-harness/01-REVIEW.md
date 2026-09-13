---
phase: 01-project-scaffold-and-test-harness
reviewed: 2026-09-13T20:56:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - package.json
  - tsconfig.json
  - vitest.config.ts
  - eslint.config.mjs
  - .gitignore
  - .env.example
  - src/index.ts
  - src/domain/types/index.ts
  - src/adapters/ical/parse-source-event.ts
  - src/adapters/ical/index.ts
  - test/helpers/load-fixture.ts
  - test/helpers/parse-ics.ts
  - test/helpers/assert-sidecar.ts
  - test/smoke.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-13T20:56:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 01 delivers a well-structured TypeScript ESM scaffold with correct three-layer boundaries (`domain` → `adapters` → tests), a single `node-ical` import site, and a passing fixture-driven smoke suite. Tooling configs are sound and the full gate (`npm test`, `typecheck`, `lint`, `build`) passes.

Three warnings were found in production source: the iCal adapter can emit `SourceEvent` objects that violate the declared type contract at runtime, recurrence overrides are not surfaced through `recurrenceId`, and the entry-point direct-run guard uses a fragile `import.meta.url` comparison. No critical security or data-loss issues were identified in the reviewed scope.

## Warnings

### WR-01: Adapter can return `SourceEvent` with undefined required fields

**File:** `src/adapters/ical/parse-source-event.ts:24-34`
**Issue:** `parseIcsToSourceEvent` assigns `vevent.uid` and `vevent.start` directly without validation. A VEVENT missing `UID` or `DTSTART` produces `{ uid: undefined, start: undefined }` at runtime, violating the `SourceEvent` interface (`uid: string`, `start: Date`). TypeScript does not catch this because `node-ical`'s `VEvent` types are permissive. Downstream Phase 2 classify/wash logic that assumes these fields are always present will fail unpredictably on malformed CalDAV payloads.
**Fix:**
```typescript
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
    // ...rest unchanged
  };
}
```

### WR-02: `recurrenceId` never populated for RECURRENCE-ID overrides

**File:** `src/adapters/ical/parse-source-event.ts:5-12,32`
**Issue:** `findFirstVEvent` returns only the master VEVENT. For `modified-instance.ics`, `node-ical` nests the RECURRENCE-ID override inside `vevent.recurrences` rather than as a separate top-level event. The adapter reads `vevent.recurrenceid` (always `undefined` on the master), so `SourceEvent.recurrenceId` is never set for override fixtures. The `modified-instance` fixture exists specifically to test recurrence exceptions (D-07), but the adapter silently discards override metadata. Phase 2/3 sync logic depending on `recurrenceId` will not distinguish overrides from series masters.
**Fix:** Expand the adapter (or add a `parseIcsToSourceEvents` plural API) to walk `vevent.recurrences` and emit one `SourceEvent` per override, mapping each nested event's `recurrenceid` to `SourceEvent.recurrenceId`. At minimum, document this limitation and add a Phase 2 task to surface overrides before sync work begins.

### WR-03: Fragile `import.meta.url` direct-run guard

**File:** `src/index.ts:8-10`
**Issue:** The main-module guard compares `import.meta.url` (absolute `file:///…` URL) to `` `file://${process.argv[1]}` ``. When `process.argv[1]` is a relative path (e.g. `dist/index.js` or `src/index.ts`), the comparison fails and `main()` is not invoked — the process exits silently with no output. This works today only when the runtime resolves `argv[1]` to an absolute path. The plan acceptance criteria require `node dist/index.js` and `npx tsx src/index.ts` to print the scaffold message.
**Fix:**
```typescript
import { fileURLToPath } from 'node:url';

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
```

## Info

### IN-01: Parse errors masked as missing VEVENT

**File:** `src/adapters/ical/parse-source-event.ts:11,23`
**Issue:** Invalid ICS input that `node-ical` cannot parse still surfaces as `Error('No VEVENT found in fixture')` because `findFirstVEvent` is the only error path. This makes debugging malformed fixtures harder but does not affect Phase 1 controlled test data.
**Fix:** Catch `ical.parseICS` failures separately and rethrow with a distinct message (e.g. `'ICS parse failed: …'`).

### IN-02: `package.json` uses caret ranges instead of exact pins

**File:** `package.json:17-26`
**Issue:** Plan 01-01 specifies exact version pins (e.g. `node-ical@0.27.2`), but `package.json` declares `^0.27.2` caret ranges. The committed `package-lock.json` mitigates drift for `npm ci`, but a fresh `npm install` without the lockfile could pull newer minor/patch versions.
**Fix:** Either pin exact versions in `package.json` to match the lockfile, or document that `npm ci` is the required install path (Phase 01.1 CI).

---

_Reviewed: 2026-09-13T20:56:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
