# Trivia Master

A full-stack, single-player Jeopardy-style trivia web application. Users sign in, create games, play through three rounds (Jeopardy, Double Jeopardy, and Final Jeopardy), and track their scores and history.

## What the app does

- **Authentication:** Sign up and sign in via Supabase Auth. All game actions are scoped to the signed-in user.
- **Gameplay:** Create a game, start it to load the board, then select clues in any order. Each clue shows a question and dollar value. You reveal the answer and mark whether you were correct or wrong; the backend updates your score. Daily Doubles (one in the first round, two in the second) support wagering within defined bounds. If your score is positive after Double Jeopardy, you play Final Jeopardy: one clue, one wager (zero up to your full score), then correct/incorrect. The game ends when all clues are resolved or when you are ineligible for Final Jeopardy.
- **History and stats:** Completed games are listed; user profile and aggregate stats (games played, accuracy, best/worst score, streaks, etc.) are available from the API and shown in the UI where implemented.

Clue data is not fetched from an external API at runtime. Raw clue data is ingested from TSV files (in `backend/data/jeopardy_clue_dataset/raw`) into the database via npm scripts. That data comes from the [jeopardy_clue_dataset](https://github.com/jwolle1/jeopardy_clue_dataset) repository (Jeopardy! clues 1984–2025). You must run ingestion before games can be created.

## Why this project exists

Trivia Master was built as a portfolio project to demonstrate a full-stack, backend-authoritative design: clear API and schema contracts, business rules enforced in one place (the backend), and a thin frontend that reflects server state. Goals included a deployable app on AWS, automated CI/CD, and documentation that would make the system understandable to other engineers or in technical interviews.

## Key features

- Supabase Auth (email/password); JWT verification and user scoping on the backend
- Create game, start game, fetch board and game state via REST API
- Three-round structure with canonical Jeopardy dollar values and Daily Double placement (1 in round 1, 2 in round 2)
- Daily Double and Final Jeopardy wagering with server-side validation
- Self-adjudicated answers (player marks correct/incorrect; no typed-answer grading)
- Score and game state persisted in Postgres; user stats updated on clue resolution and game completion
- Clue ingestion from TSV datasets (Final Jeopardy and Jeopardy/Double Jeopardy) with deduplication and validation
- Optional Docker Compose for local development; production deploy on AWS (ECS for backend, S3 + CloudFront for frontend)

## Tech stack

| Layer   | Technologies |
|---------|--------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase client for Auth |
| Backend  | NestJS, TypeScript, Prisma |
| Data     | PostgreSQL (Supabase), Prisma ORM; clue data from ingested TSV files |

Supabase provides both the database (hosted Postgres) and authentication. There is no database container in Docker; the app expects a Supabase project.

## Architecture (high level)

- **Frontend:** Thin client. No business logic; all game state comes from the backend API. The UI displays API responses and sends actions (e.g. answer clue, submit wager). No optimistic updates.
- **Backend:** Owns game rules, state transitions, wager validation, and scoring. Protects routes with a Supabase JWT guard; uses the token to identify the user and enforce access to only that user’s games.
- **Data flow:** Browser talks to the backend API and to Supabase for auth. Backend talks to Supabase Postgres (via Prisma) and verifies Supabase JWTs. Clue data is loaded into the DB by ingestion scripts, not by a live third-party API.
- **Local:** `docker compose up` runs backend and frontend only; both use the same root `.env` for Supabase and URLs. Frontend at port 3000, backend at 3001.
- **Production:** Backend runs in AWS ECS (Fargate); frontend is a Next.js static export served from S3 behind CloudFront. CloudFront routes `/api*` to the backend; see `docs/deploy.md` for details. CI/CD: GitHub Actions on push to `main` (backend: test, build image, push to ECR, ECS deploy; frontend: build, sync to S3, CloudFront invalidation).

## Local setup

**Prerequisites:** Node.js 20 (or the version required by the repo), Docker (optional), and a Supabase project (for Postgres and Auth).

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd trivia_master
   ```

2. **Environment**

   - Copy `.env.example` to `.env` in the repo root.
   - Fill in Supabase values: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` (backend); `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend). For local runs without Docker, set `NEXT_PUBLIC_API_URL=http://localhost:3001` (or the URL of your backend).

3. **Database**

   - In `backend/`: run `npx prisma migrate deploy` (or `npx prisma migrate dev` if developing).
   - Ingest clues so games can start:
     - `npm run ingest:final-jeopardy`
     - `npm run ingest:jeopardy` (required for Jeopardy and Double Jeopardy rounds)

4. **Run the app**

   **Option A – Docker**

   From the repo root:

   ```bash
   docker compose up
   ```

   Frontend: http://localhost:3000. Backend API: http://localhost:3001.

   **Option B – Without Docker**

   Terminal 1 (backend):

   ```bash
   cd backend && npm install && npm run start:dev
   ```

   Terminal 2 (frontend):

   ```bash
   cd frontend && npm install && npm run dev
   ```

   Open http://localhost:3000. Ensure `NEXT_PUBLIC_API_URL` points to the backend (e.g. http://localhost:3001).

Further backend details (scripts, tests, env vars) are in `backend/README.md`. Frontend setup and scripts are in `frontend/README.md`. Deployment and CI/CD are documented in `docs/deploy.md` and `docs/preflight_cicd.md`.

## Acknowledgments

Raw clue data is sourced from [jwolle1/jeopardy_clue_dataset](https://github.com/jwolle1/jeopardy_clue_dataset) (Jeopardy! clues 1984–2025). It was instrumental to this project.

## License

See the LICENSE file in the repository.
