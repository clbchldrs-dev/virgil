# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Satisfies production auth check during `next build`; replace at runtime via compose.
ARG AUTH_SECRET=docker-build-placeholder-not-used-at-runtime
ENV AUTH_SECRET=${AUTH_SECRET}
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1

# Used by `metadataBase` and server code that reads NEXT_PUBLIC_APP_URL; set via docker-compose build args for LAN installs.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN pnpm run build:docker

# migrate.ts is not traced into standalone; copy these from pnpm's store for tsx at runtime.
RUN mkdir -p /app/.docker-migrate-deps && \
    DRIZZLE_DIR=$(ls -d /app/node_modules/.pnpm/drizzle-orm@0.34.*/node_modules/drizzle-orm 2>/dev/null | head -1) && \
    POSTGRES_DIR=$(ls -d /app/node_modules/.pnpm/postgres@3.4.*/node_modules/postgres 2>/dev/null | head -1) && \
    test -n "$DRIZZLE_DIR" && test -n "$POSTGRES_DIR" && \
    cp -r "$DRIZZLE_DIR" /app/.docker-migrate-deps/drizzle-orm && \
    cp -r "$POSTGRES_DIR" /app/.docker-migrate-deps/postgres

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat \
  && npm install -g tsx@4.19.1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

COPY --from=builder /app/.docker-migrate-deps/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/.docker-migrate-deps/postgres ./node_modules/postgres

COPY --from=builder /app/lib/db/migrate.ts ./lib/db/migrate.ts
COPY --from=builder /app/lib/db/migrations ./lib/db/migrations

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
