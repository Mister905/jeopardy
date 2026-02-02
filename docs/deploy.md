# Deployment Runbook

This runbook covers prerequisites and steps to deploy the Jeopardy app to a new environment (e.g. AWS: S3 + CloudFront frontend, ECS Fargate backend, ALB, Supabase external).

**Target architecture:** Frontend: S3 + CloudFront (+ optional Route 53). Backend: ECS Fargate + ECR + ALB. Config/ops: SSM Parameter Store or Secrets Manager, CloudWatch Logs. Database: Supabase (external).

---

## 1. Prerequisites

- **Database:** Supabase project with Postgres and Auth enabled. **Production clues are already ingested and available** with the current Supabase configuration; no ingestion step is needed for deploy unless you are targeting a new database or need to refresh clue data.
- **Secrets:** Production values for `DATABASE_URL`, Supabase API keys, and (for frontend build) `NEXT_PUBLIC_*` variables. Load backend secrets via ECS task definition (e.g. from SSM Parameter Store or Secrets Manager); do not commit them.
- **CORS:** Backend `FRONTEND_URL` must match the frontend origin (e.g. CloudFront URL or custom domain). Set this in the backend environment for the deploy.

---

## 2. Backend: Database migrations

Apply the locked schema to the target database **before** running the backend or ingestion.

1. From the **backend** directory, set `DATABASE_URL` to the target Postgres connection string (e.g. Supabase connection string).
2. Run:
   ```bash
   npx prisma migrate deploy
   ```
3. **When to run:** For a new environment, run once. For existing environments, run as part of each release that includes schema changes (e.g. in a release job or manually before deploying the new backend). Do not run migrations at app startup unless you explicitly adopt that strategy (tradeoff: simpler deploy vs. risk of concurrent migrations).

---

## 3. Backend: Clue ingestion

**Current setup:** Production clues are already ingested and available with the current Supabase configuration. Skip ingestion for normal deploys.

Run ingestion only when:
- You are deploying to a **new** database (e.g. a new Supabase project) that has no clue data, or
- You want to **refresh or expand** clue data.

At least one full game’s worth of clue data must be present so users can play. When needed, run ingestion **after** migrations and **before** (or after) starting the backend.

### Option A: Jeopardy + Double Jeopardy

- **Script:** `npm run ingest:jeopardy` (from backend directory).
- **Behavior:** Parses TSV files under `backend/data/jeopardy_clue_dataset/` and writes parsed JSON, then ingests from `backend/data/jeopardy_clue_dataset/parsed/jeopardy-clues.json`.
- **Requires:** TSV data in the expected location; see backend data/parsing docs if you add new seasons.

### Option B: Final Jeopardy

- **Script:** `npm run ingest:final-jeopardy` (from backend directory).
- **Behavior:** Ingests from `backend/data/jeopardy_clue_dataset/parsed/final-jeopardy-clues.json`. If that file does not exist, run the parser first: `npm run parse:final-jeopardy` (and optionally `npm run verify:parsed-output`).
- **Requires:** Parsed file at the path above, or run the parse script with the correct raw data path.

### Notes

- Set `DATABASE_URL` (and any other env the app needs) when running these scripts.
- Run ingestion once per new environment, or when you want to refresh/expand clue data. Idempotent: duplicates are skipped.
- For a minimal deploy, ensure at least enough clues exist for one playable game (Jeopardy + Double Jeopardy + Final Jeopardy as per game rules).

---

## 4. Backend: Environment variables

Set these in the backend runtime (e.g. ECS task definition, from SSM/Secrets Manager):

| Variable           | Required | Description |
|--------------------|----------|-------------|
| `DATABASE_URL`     | Yes      | Postgres connection string (Supabase). |
| `SUPABASE_URL`     | Yes      | Supabase project URL (Auth). |
| `SUPABASE_ANON_KEY`| Yes      | Supabase anon key (Auth). |
| `SUPABASE_JWT_SECRET` | Yes   | Supabase JWT secret (Auth verification). |
| `PORT`             | No       | Port the app listens on (default `3000`). ECS/ALB must use the same port. |
| `FRONTEND_URL`     | Yes (prod) | Allowed CORS origin (e.g. CloudFront or custom domain). |

---

## 5. Backend: Health check

- **Path:** `GET /health`
- **Response:** `200` with body `{ "status": "ok" }`. No auth required.
- **Use:** Configure ALB target group health checks and ECS container health checks to use this path so tasks are marked healthy.

---

## 6. Frontend: Build-time environment variables

The frontend is built as a **static export** (Next.js `output: 'export'`). All `NEXT_PUBLIC_*` variables are inlined at **build** time. You must set production values when running the production build; they cannot be changed at runtime.

| Variable                         | Required | Description |
|----------------------------------|----------|-------------|
| `NEXT_PUBLIC_API_URL`            | Yes      | Backend base URL (e.g. `https://api.yourdomain.com`). Used for all API calls. |
| `NEXT_PUBLIC_SUPABASE_URL`       | Yes      | Supabase project URL (same as backend Supabase). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Yes      | Supabase anon key (same as backend). |

**Example (build from frontend directory):**

```bash
export NEXT_PUBLIC_API_URL=https://api.yourdomain.com
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
npm run build
```

The static output is in `frontend/out/`. Upload the contents of `out/` to S3 and serve via CloudFront. Configure CloudFront error pages (e.g. 404 → index.html) for SPA-style client-side routing if users hit deep links.

---

## 7. Deploy order (summary)

1. Apply migrations: `npx prisma migrate deploy` (backend, with `DATABASE_URL` set).
2. **If** the target database has no clue data: run clue ingestion (e.g. `npm run ingest:jeopardy`, `npm run ingest:final-jeopardy`). For the current Supabase config, clues are already ingested—skip this step.
3. Set backend env (including `FRONTEND_URL` for CORS).
4. Start backend (e.g. deploy to ECS; health check path: `GET /health`).
5. Set frontend build-time env (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
6. Build frontend: `npm run build` (in frontend directory).
7. Deploy frontend: upload `frontend/out/` to S3 and configure CloudFront.

---

## 8. Optional: Smoke check

After deploy, verify:

- Backend: `curl https://api.yourdomain.com/health` returns `{ "status": "ok" }`.
- Frontend: Open app, sign in (Supabase), create a game, start the game, open a clue. Confirms API URL, CORS, and Supabase auth.

---

## References

- **Env template:** `.env.example` at repo root (backend and frontend vars).
- **Backend production image:** `backend/Dockerfile.prod` (multi-stage build; run with `node dist/main`).
- **Feature 0020 (Minimum Deploy Readiness):** `docs/features/0020_PLAN.md`.
- **Feature 0021 (Deployment Alignment):** `docs/features/0021_PLAN.md`.
