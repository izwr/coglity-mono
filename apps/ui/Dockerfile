FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/ui/package.json apps/ui/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/ui/node_modules ./apps/ui/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared packages/shared
COPY apps/ui apps/ui
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
RUN pnpm --filter @coglity/shared build 2>/dev/null || true
RUN pnpm --filter @coglity/ui build

FROM nginx:alpine AS runner
COPY --from=build /app/apps/ui/dist /usr/share/nginx/html
COPY apps/ui/nginx.conf /etc/nginx/templates/default.conf.template
ENV BACKEND_URL=http://backend:3001
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
