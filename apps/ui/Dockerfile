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
COPY --from=deps /app/apps/ui/node_modules ./apps/ui/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared packages/shared
COPY apps/ui apps/ui
COPY bun.lock package.json turbo.json ./
RUN bun run --filter @coglity/shared build 2>/dev/null || true
RUN bun run --filter @coglity/ui build

FROM nginx:alpine AS runner
COPY --from=build /app/apps/ui/dist /usr/share/nginx/html
COPY apps/ui/nginx.conf /etc/nginx/templates/default.conf.template
ENV BACKEND_URL=http://backend:3001
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
