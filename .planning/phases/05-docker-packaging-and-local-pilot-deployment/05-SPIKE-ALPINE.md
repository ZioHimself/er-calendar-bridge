# Alpine + better-sqlite3 spike (Plan 05-01)

**Outcome:** PASS — `better-sqlite3@13.0.3` loads on `node:24-alpine` (linux-musl) after native compile during `npm ci`.

**Date:** 2026-09-16  
**Image:** `node:24-alpine`  
**Node:** 24.x (matches `package.json` engines)

## Commands executed

One-off container (lockfile-only install, no app source):

```sh
docker run --rm \
  -v "$(pwd)/package.json:/work/package.json:ro" \
  -v "$(pwd)/package-lock.json:/work/package-lock.json:ro" \
  -w /work node:24-alpine sh -c '
    apk add --no-cache python3 make g++
    npm ci --omit=dev
    node -e "require(\"better-sqlite3\"); console.log(\"better-sqlite3 load: OK\")"
  '
```

Observed: `better-sqlite3 load: OK` (exit 0). npm reported `better-sqlite3@13.0.3` running `node-gyp rebuild` during install.

## apk packages (build stage)

| Package | Purpose |
|---------|---------|
| `python3` | node-gyp |
| `make` | native build |
| `g++` | pulls toolchain for `node-gyp rebuild` on musl |

Equivalent Dockerfile line:

```dockerfile
RUN apk add --no-cache python3 make g++
```

## npm strategy

| Step | Result |
|------|--------|
| `npm ci --omit=dev` with build deps present | PASS — compiles and installs production `node_modules` |
| `npm run build` | Not required for this spike (no `src/` copied); Plan 05-02 should run `npm run build` after copying TypeScript sources in the build stage |
| `npm prune` after install | Not tested; if prune strips native artifacts, prefer copying full `node_modules` from build stage without prune |

## Recommended Dockerfile build stage (Plan 05-02)

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# Optional: npm ci --omit=dev && npm prune --omit=dev only if verified; default: copy node_modules from this stage
```

Runtime stage should copy at minimum:

- `dist/` from `npm run build`
- `node_modules/` from the build stage (includes compiled `better-sqlite3` binary for musl)
- `package.json` (for `node dist/...` entry if needed)

Do **not** run `apk add g++` in the final runtime image unless you install production deps there (prefer multi-stage copy).

## musl / glibc note

Host macOS dev uses darwin binaries; container must compile on Alpine. Lockfile-driven `npm ci` in the build stage is the source of truth for the linux-musl `.node` binding.
