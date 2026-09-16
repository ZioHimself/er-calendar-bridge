FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
LABEL org.opencontainers.image.source=https://github.com/europeanresolve/er-calendar-bridge
WORKDIR /app
RUN chown -R node:node /app
USER node
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/index.js", "sync", "--watch"]
