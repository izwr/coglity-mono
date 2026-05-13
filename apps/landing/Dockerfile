FROM oven/bun:1.3.13 AS base
WORKDIR /app

FROM base AS deps
COPY bun.lock package.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/billing/package.json apps/billing/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY apps/iac/package.json apps/iac/package.json
COPY apps/landing/package.json apps/landing/package.json
COPY apps/ui/package.json apps/ui/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/landing/node_modules ./apps/landing/node_modules
COPY apps/landing apps/landing
COPY bun.lock package.json turbo.json ./
RUN bun run --filter @coglity/landing build

FROM nginx:alpine AS runner
COPY --from=build /app/apps/landing/out /usr/share/nginx/html
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
