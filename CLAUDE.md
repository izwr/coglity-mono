# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Coglity is an AI first QA/testing management application with CRUD for test suites, tags, and entity-tag relationships. Built as a TypeScript monorepo using pnpm workspaces and Turborepo.

## Monorepo Structure

- **apps/backend** — Express 5 API server (port 3001), PostgreSQL via Drizzle ORM
- **apps/ui** — React 19 + Vite 6 frontend with React Router 7
- **packages/shared** — Drizzle table definitions, Zod schemas (generated via drizzle-zod), shared types

## Commands

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start backend + UI concurrently (Turbo)
pnpm build                # Build all packages
pnpm lint                 # Type-check all packages (tsc)

# Database (run from apps/backend)
pnpm db:push              # Push schema directly to database
pnpm db:generate          # Generate migration files
pnpm db:migrate           # Run migrations
pnpm db:studio            # Open Drizzle Studio
```

## Architecture

### Data Flow
Shared package defines the single source of truth for database schema (`packages/shared/src/schema/`). Drizzle table definitions produce both the DB schema and Zod validation schemas (via `drizzle-zod`). The backend imports these directly for queries and request validation. The UI uses its own Yup schemas for form validation.

### Backend (apps/backend)
- Entry: `src/index.ts` — Express app setup
- DB client: `src/db.ts` — Drizzle + postgres-js driver
- Routes: `src/routes/testSuites.ts`, `src/routes/tags.ts`
- Config: `drizzle.config.ts` points to shared package schema
- Default DB: `postgres://postgres:postgres@localhost:5432/coglity`
- Uses `DATABASE_URL` env var (passed through Turbo global env)

### Frontend (apps/ui)
- Vite proxies `/api/*` to `http://localhost:3001`
- Services layer (`src/services/`) wraps Axios calls
- Pages in `src/pages/`, layout with sidebar in `src/components/`
- CSS variable theming with light/dark mode (`src/theme/theme.css`, toggled via `data-theme` attribute)
- Google Sans font

### Shared Package (packages/shared)
- `schema/testSuites.ts` — test_suites table
- `schema/tags.ts` — tags table (name is unique)
- `schema/entityTags.ts` — polymorphic many-to-many join table (composite PK: entityId + tagId + entityType)
- Entity types: `test_suite`, `test_case`, `scheduled_test_suite`

## Conventions

- All primary keys are UUIDs with `gen_random_uuid()`
- DB column names use snake_case; timestamps are timezone-aware UTC
- API responses: 201 on create, 204 on delete, `{ error: ... }` for errors
- Backend validates with Zod `safeParse` before DB operations
- Package scope: `@coglity/*`
- No test framework is currently configured
