# ============================================================
# 1. Dependencies
# ============================================================
FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts ./scripts

RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && for i in 1 2 3 4 5 6; do \
         echo "npm ci tentative $i..." \
         && npm ci \
         && exit 0; \
         echo "Échec npm ci, nouvelle tentative dans 20s..." \
         && sleep 20; \
       done \
    && exit 1


# ============================================================
# 2. Build
# ============================================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN npm run build


# ============================================================
# 3. Production
# ============================================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/instrumentation.js ./instrumentation.js
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/src/proxy.js ./src/proxy.js

COPY --from=builder /app/scripts ./scripts

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3001

CMD ["node", "scripts/start-with-logs.mjs"]
