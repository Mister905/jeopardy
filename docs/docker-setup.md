# Docker Setup (Feature 0019)

One-command setup for backend and frontend. Supabase (Postgres + Auth) remains external; no database container.

## Prerequisites

- Docker and Docker Compose
- A Supabase project (for `DATABASE_URL` and auth env vars)

## Quick Start

1. **Create `.env` from the template** (at project root):

   ```bash
   cp .env.example .env
   ```

2. **Fill in Supabase values** in `.env`:
   - **DATABASE_URL** — Supabase Dashboard → Project Settings → Database → Connection string (URI). Use the pooler connection string (port 6543) if available.
   - **SUPABASE_URL** — Project Settings → API → Project URL.
   - **SUPABASE_ANON_KEY** — Project Settings → API → anon public.
   - **SUPABASE_JWT_SECRET** — Project Settings → API → JWT Secret.
   - **NEXT_PUBLIC_SUPABASE_URL** — Same as SUPABASE_URL.
   - **NEXT_PUBLIC_SUPABASE_ANON_KEY** — Same as SUPABASE_ANON_KEY.

3. **Start the stack**:

   ```bash
   docker compose up
   ```

4. **Open the app**: [http://localhost:3000](http://localhost:3000). Backend API: [http://localhost:3001](http://localhost:3001).

## Ports

| Service  | Host port | Purpose                    |
|----------|-----------|----------------------------|
| Frontend | 3000      | Next.js dev server         |
| Backend  | 3001      | NestJS API (browser calls this) |

`NEXT_PUBLIC_API_URL` and `FRONTEND_URL` are set in `docker-compose.yml` so the browser can reach the backend and CORS works.

## Development Workflow

- **Edit code on the host** — Backend and frontend directories are mounted into the containers. Changes to source files are picked up by the dev servers (Nest watch mode, Next.js hot reload with polling).
- **Logs** — Stream logs for debugging:
  - `docker compose logs -f backend`
  - `docker compose logs -f frontend`
- **Rebuild after dependency changes** — If you change `package.json` or `package-lock.json`, rebuild:
  - `docker compose build backend` or `docker compose build frontend`
  - Then `docker compose up` (or restart the service).

## Environment Variables

See `.env.example` for the full list. Required for Docker:

- **Backend:** `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`. `PORT` and `FRONTEND_URL` are set by compose.
- **Frontend:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `NEXT_PUBLIC_API_URL` and `WATCHPACK_POLLING` are set by compose.

Do not commit `.env`; it is gitignored.
