# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Coglity is an AI-first QA/testing management application with CRUD for test suites, test cases, tags, and entity-tag relationships, plus AI-powered test case generation. Built as a TypeScript monorepo using pnpm workspaces and Turborepo.

## Monorepo Structure

- **apps/backend** — Express 5 API server (port 3001), PostgreSQL via Drizzle ORM, Azure Entra ID auth
- **apps/ui** — React 19 + Vite 6 frontend with React Router 7 (port 5173)
- **apps/landing** — React 19 + Vite 6 marketing landing page (port 3002), standalone static site
- **packages/shared** — Drizzle table definitions, Zod schemas (generated via drizzle-zod), shared types

## Commands

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps concurrently (Turbo)
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
- Entry: `src/index.ts` — Express app setup with session middleware (connect-pg-simple)
- DB client: `src/db.ts` — Drizzle + postgres-js driver
- Auth: `src/routes/auth.ts` — Azure Entra ID OAuth (login, callback)
- Routes (protected by `requireAuth` middleware):
  - `src/routes/testSuites.ts` — test suite CRUD
  - `src/routes/testCases.ts` — test case CRUD with tag relationships
  - `src/routes/tags.ts` — tag CRUD
  - `src/routes/ai.ts` — AI-powered test generation (multi-step workflow)
  - `src/routes/bugs.ts` — bug tracker CRUD with comments and tag relationships
  - `src/routes/users.ts` — list all users (for assignee dropdowns)
  - `src/routes/scheduledTestSuites.ts` — scheduled test suite CRUD + nested scheduled test case updates; DTO joins to test_suites/test_cases/bugs
- API endpoints: `/api/auth/*`, `/api/health`, `/api/test-suites`, `/api/test-cases`, `/api/tags`, `/api/ai`, `/api/bugs`, `/api/users`, `/api/scheduled-test-suites`
- Config: `drizzle.config.ts` points to shared package schema
- Default DB: `postgres://postgres:postgres@localhost:5432/coglity`
- Env vars: `DATABASE_URL`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`, `OPENAI_API_KEY` (all passed through Turbo globalPassThroughEnv)

### AI Test Generation (apps/backend/src/routes/ai.ts)
Multi-step workflow using OpenAI API (gpt-4.1-mini) with structured JSON outputs:
1. Create session with user story
2. Generate 3–5 clarifying follow-up questions
3. Submit Q&A answers
4. Generate test scenarios
5. Create detailed test cases from selected scenarios

### Frontend (apps/ui)
- Vite proxies `/api/*` to `http://localhost:3001`
- Auth: Azure Entra ID login with `<ProtectedRoute>` wrapper and auth context
- Services layer (`src/services/`) wraps Axios calls: `testSuiteService`, `testCaseService`, `tagService`, `aiService`, `bugService`, `userService`, `scheduledTestSuiteService`
- Pages: Dashboard, Login, TestSuites, TestCases, TestCaseDetail, Bugs, BugDetail, Tags, ScheduledTestSuites, ScheduledTestSuiteDetail, Reporting, Search, GenerateTestCases
- Shared UI components: `components/ui/Button.tsx` (variant/size), `components/ui/Select.tsx` (react-select wrapper with theme)
- Layout with sidebar in `src/components/`
- CSS variable theming with light/dark mode (`src/theme/theme.css`, toggled via `data-theme` attribute)
- Google Sans font

### Landing App (apps/landing)
- Standalone marketing site with animated pipeline hero visualization
- Features: theme toggle, navbar, hero, features grid, how-it-works section, CTA
- No backend integration

### Shared Package (packages/shared)
- `schema/testSuites.ts` — test_suites table
- `schema/testCases.ts` — test_cases table (title, preCondition, testSteps, data, expectedResults, status: draft/active)
- `schema/tags.ts` — tags table (name is unique)
- `schema/entityTags.ts` — polymorphic many-to-many join table (composite PK: entityId + tagId + entityType)
- `schema/users.ts` — users table (entraId, email, displayName, avatarUrl)
- `schema/bugs.ts` — bugs table (title, description, comments/attachments as JSONB, assignedTo, bugType, priority, severity, resolution, state, reproducibility enums)
- `schema/scheduledTestSuites.ts` — scheduled_test_suites table (testSuiteId, startDate, endDate, createdBy)
- `schema/scheduledTestCases.ts` — scheduled_test_cases table (scheduledTestSuiteId, testCaseId, assignedTo, actualResults, state enum, linkedBugIds JSONB)
- `schema/aiGenerationSessions.ts` — AI generation sessions (userStory, followUpQA, generatedScenarios, selectedScenarioIndices; status: gathering_info/scenarios_generated/test_cases_created)
- Entity types: `test_suite`, `test_case`, `scheduled_test_suite`, `bug`

## Conventions

- All primary keys are UUIDs with `gen_random_uuid()`
- DB column names use snake_case; timestamps are timezone-aware UTC
- API responses: 201 on create, 204 on delete, `{ error: ... }` for errors
- Backend validates with Zod `safeParse` before DB operations
- Package scope: `@coglity/*`
- No test framework is currently configured
