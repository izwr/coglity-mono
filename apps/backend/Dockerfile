FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY bun.lock package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared packages/shared
COPY apps/backend apps/backend
COPY bun.lock package.json turbo.json ./
RUN bun run --filter @coglity/shared build
RUN bun run --filter @coglity/backend build

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 app

COPY --from=build /app/apps/backend/src apps/backend/src
COPY --from=build /app/apps/backend/package.json apps/backend/package.json
COPY --from=build /app/apps/backend/node_modules apps/backend/node_modules
COPY --from=build /app/packages/shared/src packages/shared/src
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json

USER app
EXPOSE 3001
CMD ["bun", "run", "apps/backend/src/index.ts"]
