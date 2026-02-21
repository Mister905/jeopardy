# Trivia Master — Deep Technical Walkthrough

> **Purpose:** An engineering deep dive to internalize how this system works. Optimized for interview preparation and confident explanation without relying on AI.

---

## 1. High-Level Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (User)                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTPS
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFRONT (Single Entry Point)                           │
│  Path-based routing:                                                              │
│    /api*     → ALB (backend)                                                      │
│    /games/*  → S3 (rewrite to /games/new.html)                                    │
│    /*        → S3 (static frontend)                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
         │                                    │
         │                                    │
         ▼                                    ▼
┌──────────────────────┐            ┌──────────────────────┐
│   ALB (Backend)      │            │   S3 (Static Files)  │
│   Health: /api/health│            │   out/ from Next.js  │
└──────────────────────┘            └──────────────────────┘
         │
         ▼
┌──────────────────────┐            ┌──────────────────────┐
│   ECS Fargate        │            │   Supabase            │
│   NestJS Container   │◄──────────►│   Postgres + Auth     │
└──────────────────────┘            └──────────────────────┘
```

### Request Lifecycle (Full Trace)

```
Browser → fetch(NEXT_PUBLIC_API_URL + '/games', { headers: { Authorization: Bearer <JWT> } })
    → CloudFront (matches /api*)
    → ALB → ECS (NestJS)
    → AuthGuard extracts token, SupabaseService.verifyToken()
    → GameController.createGame()
    → GameService.createGame()
    → Prisma → Supabase Postgres
    → Response flows back
```

### Key File Paths

| Component | Path | Purpose |
|-----------|------|---------|
| **Frontend root** | `frontend/` | Next.js 14 App Router |
| **Backend root** | `backend/` | NestJS API |
| **Prisma schema** | `backend/prisma/schema.prisma` | DB models, migrations |
| **Auth guard** | `backend/src/auth/auth.guard.ts` | JWT verification on every protected route |
| **Game controller** | `backend/src/game/game.controller.ts` | All game API endpoints |
| **Game service** | `backend/src/game/game.service.ts` | Business logic, Prisma writes |
| **API client** | `frontend/src/lib/api/client.ts` | HTTP request wrapper with JWT headers |
| **Redux game slice** | `frontend/src/store/gameSlice.ts` | Game state, thunks |
| **CloudFront function** | `frontend/cloudfront-function-rewrite-uri.js` | SPA routing for /games/:id |

### Environment Variable Flow

| Variable | Where Set | Consumed By | Purpose |
|----------|-----------|-------------|---------|
| `DATABASE_URL` | SSM (prod), `.env` (dev) | Backend | Supabase Postgres connection |
| `SUPABASE_URL` | SSM / `.env` | Backend | Supabase project URL |
| `SUPABASE_ANON_KEY` | SSM / `.env` | Backend | Supabase client (fallback JWT verify) |
| `SUPABASE_JWT_SECRET` | SSM / `.env` | Backend | JWT signature verification (HS256) |
| `FRONTEND_URL` | SSM / `.env` | Backend | CORS allowed origins (comma-separated) |
| `NEXT_PUBLIC_API_URL` | GitHub secrets (prod), `.env` (dev) | Frontend (baked at build) | Base URL for API calls; **must include `/api`** (e.g. `https://domain.com/api`) |
| `NEXT_PUBLIC_SUPABASE_URL` | GitHub secrets / `.env` | Frontend | Supabase client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | GitHub secrets / `.env` | Frontend | Supabase client |

🔎 **Explanation:** `NEXT_PUBLIC_*` vars are embedded at build time. Changing them requires a new frontend build and redeploy. Backend env vars are read at container startup from SSM.

### Where Authentication Is Verified

- **File:** `backend/src/auth/auth.guard.ts` (lines 22–50)
- **Flow:** `AuthGuard` runs before every controller method on `@UseGuards(AuthGuard)` routes. It extracts `Authorization: Bearer <token>`, calls `SupabaseService.verifyToken(token)`, and attaches the user to `request[REQUEST_USER_KEY]`.
- **Bypass:** Routes decorated with `@Public()` skip the guard (e.g. `GET /api/health`).

### Where Authorization Is Enforced

- **File:** `backend/src/game/game.controller.ts` (lines 57–77)
- **Pattern:** `verifyGameOwnership(gameId, userId)` is called before mutating a game. It fetches the game via `GameService.getGameById(gameId, userId)`; if `game.userId !== userId`, it throws `UnauthorizedGameAccessException`.
- **Service layer:** `GameService.getGameById` (lines 221–256) returns `null` when `game.userId !== userId`, so the service never leaks another user's game.

---

## 2. Frontend Deep Dive

### A. Next.js App Router Structure

**Directory layout:** `frontend/src/app/`

```
app/
├── layout.tsx          # Root layout: Redux Provider, Header, Footer
├── globals.css
├── page.tsx            # / (home: game list, create game)
├── dashboard/
│   └── page.tsx        # /dashboard (user stats)
├── games/
│   └── page.tsx        # /games (redirects to /)
│   └── [id]/
│       ├── page.tsx    # /games/:id (server: generateStaticParams; client: GameDetailPageClient)
│       └── GameDetailPageClient.tsx
└── auth/
    ├── login/
    │   └── page.tsx    # /auth/login
    └── callback/
        └── page.tsx    # /auth/callback (Supabase redirect)
```

**Layouts vs Pages:**
- `layout.tsx` wraps all pages. It is a **client component** (`'use client'`) because it uses Redux `Provider`. Metadata cannot be exported from client layouts.
- Each `page.tsx` is a route segment. Most are client components for interactivity.

**Client vs Server components:**
- **Client:** `'use client'` at top. Used for: layout (Redux), pages (auth, game list, game detail), all game components.
- **Server:** No directive. This project uses almost no server components; the only server-rendered piece is `generateStaticParams` in `games/[id]/page.tsx` (lines 5–7), which runs at build time for static export.

**Why static export works:**
- `frontend/next.config.js` (lines 4–5): `output: 'export'` when `NODE_ENV === 'production'`.
- The app is login-gated; all data comes from the API. No server-side data fetching, no RSC payloads.
- Static export produces `out/` with pre-rendered HTML. S3 serves these files; CloudFront caches them.

**What Next.js features are NOT used:**
- **SSR:** No `getServerSideProps` or server components that fetch data per request.
- **RSC (React Server Components):** Effectively not used; everything is client-rendered after hydration.
- **Edge:** No Edge runtime or middleware that runs at the edge.
- **API routes:** No `app/api/`; all API calls go to the NestJS backend.
- **ISR / revalidation:** Not applicable with static export.

---

### B. Authentication Flow (Step-by-Step)

**1. User signs in**

- **File:** `frontend/src/app/auth/login/page.tsx` (lines 97–124)
- **Action:** `dispatch(signInUser({ email, password }))` or `signUpUser({ email, password, username })`
- **File:** `frontend/src/store/authSlice.ts` (lines 98–101)
- **Call:** `supabase.auth.signInWithPassword({ email, password })`

**2. Supabase client receives JWT**

- Supabase Auth returns a session with `access_token` (JWT) and `refresh_token`.
- The Supabase JS client stores the session in memory and optionally in `localStorage` (default).

**3. How JWT is stored**

- **File:** `frontend/src/lib/auth/supabase.ts` (line 20)
- `createClient(supabaseUrl, supabaseAnonKey)` uses default storage. Session is persisted in `localStorage` under a Supabase key.
- **File:** `frontend/src/lib/auth/hooks.ts` (lines 14–24): `supabase.auth.getSession()` reads the stored session.

**4. How token is attached to API requests**

- **File:** `frontend/src/lib/api/client.ts` (lines 22–36)
- `getAuthHeaders()` calls `supabase.auth.getSession()`, extracts `session?.access_token`, and sets `Authorization: Bearer ${token}`.
- Every `apiGet` and `apiPost` uses these headers.

**5. Where the backend verifies it**

- **File:** `backend/src/auth/auth.guard.ts` (lines 32–50)
- Extracts token from `Authorization` header (handles `Bearer` with multiple spaces).
- Calls `supabaseService.verifyToken(token)`.
- **File:** `backend/src/auth/supabase.service.ts` (lines 52–163)
- For HS256: verifies with `jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] })`.
- For RS256/ES256: fallback to `supabase.auth.getUser(token)` (network call).
- Extracts `sub` as `userId`, returns `{ userId, email }`.

---

### C. Game Lifecycle — Domain-First Walkthrough

> Focus on lifecycle, state transitions, and domain logic — not HTTP plumbing.

#### Executive Summary

- **Frontend:** Next.js static export SPA. Client-side routing, Redux for game state. All data from API; no SSR.
- **Backend:** NestJS on ECS Fargate. Single source of truth for game logic, scoring, and state transitions.
- **Supabase:** Postgres (Prisma) + Auth (JWT). Backend verifies tokens; frontend never touches DB.
- **Backend-authoritative:** All game rules, score calculation, and state transitions live in `GameService`. Frontend displays and triggers; backend decides.
- **JWT flow:** Supabase issues token on sign-in; frontend attaches `Authorization: Bearer` to every API call; `AuthGuard` verifies before controller runs.
- **Separation of Create vs Start:** `createGame()` creates a Game + FinalJeopardy clue only (PENDING). `startGame()` builds the 60-clue board, assigns Daily Doubles, and transitions to ACTIVE. This split allows "create then redirect" without blocking on heavy board generation.
- **State machine ownership:** Backend owns `Game.state` and `GameClue.state`. Frontend reads state and renders; it never mutates state locally.
- **One game in progress:** Backend enforces one active game per user; `createGame` throws if user has PENDING/ACTIVE/FINAL_PENDING/FINAL_ACTIVE.
- **Clue selection is frontend-only:** Selecting a clue is Redux state; no API call. Backend only sees Answer, Pass, or Wager.
- **Final Jeopardy:** Single clue per game, pre-assigned at create. Wager submitted in FINAL_PENDING; answer submitted in FINAL_ACTIVE.

---

#### Phase 1 – Game Bootstrap (PENDING)

**Domain concept:** A game is created when the user clicks "New Game." At this moment, we allocate a Game record and a Final Jeopardy clue. The board does not exist yet.

**When a Game entity is created:** User triggers from home page (`handleCreateGame`) or game-complete screen ("New Game" button). Backend creates a `Game` row with `state: PENDING`, `score: 0`.

**What fields are initialized:** `Game`: `id`, `userId`, `state: PENDING`, `score: 0`, `createdAt`, `updatedAt`. `FinalJeopardy`: `gameId`, `clueId` (randomly selected), `wager: 0` (placeholder until player submits).

**Why Final Jeopardy clue is assigned here:** Final Jeopardy is a single clue per game; it doesn't depend on the main board. Assigning it at create keeps the game entity complete and avoids a second round of clue selection later.

**Why the board is NOT generated here:** Board generation is expensive: 6 categories × 5 values × 2 rounds = 60 clues, plus Daily Double assignment logic. Doing it at create would block the user. Creating first allows immediate redirect to `/games/:id` with a "Start Game" button; the user can start when ready.

**Mapping:** Controller `game.controller.ts` (lines 112–143) → Service `game.service.ts` `createGame()` (lines 33–163) → Prisma: `game.findFirst`, `game.create`, `finalJeopardy.create`. Frontend `page.tsx` `handleCreateGame` (lines 47–75): `createGame(username)` → `window.location.href = /games/${newGame.id}?autoStart=true`.

---

#### Phase 2 – Board Initialization (ACTIVE)

**Domain concept:** User clicks "Start Game." The backend builds the full Jeopardy and Double Jeopardy boards, assigns Daily Doubles, and transitions to ACTIVE.

**When startGame() is triggered:** User clicks "Start Game" on the game detail page, or `?autoStart=true` causes the client to auto-dispatch after create.

**How categories are selected:** 6 unique categories for Jeopardy round, 6 for Double Jeopardy. Random selection from `Clue` table; retry up to 50 times if any category lacks clues for all values.

**How GameClue rows are created:** 30 Jeopardy clues (6 categories × 5 values: 200, 400, 600, 800, 1000), 30 Double Jeopardy clues (400, 800, 1200, 1600, 2000). Each `GameClue` links `gameId` + `clueId`; `state: UNANSWERED`; `isDailyDouble` set per game.

**How Daily Doubles are assigned:** Jeopardy: 1 DD in 3rd, 4th, or 5th position of a category. Double Jeopardy: 2 DDs in different categories, same position rules.

**State transition:** `PENDING` → `ACTIVE`

**Why this is separate from createGame():** Heavy work: 60 DB writes, category selection, retry logic. Keeping it separate from create keeps create fast and allows users to abandon before starting.

**Mapping:** Controller `game.controller.ts` (lines 200–226) → Service `game.service.ts` `startGame()` (lines 307–467). Prisma: 60 `gameClue.create`, 1 `game.update` (state → ACTIVE). Frontend autoStart: `GameDetailPageClient.tsx` (lines 101–114).

---

#### Phase 3 – Gameplay Loop

**Domain concept:** User selects clues, answers or passes. Backend is the only authority for score and clue state.

**Selecting a clue (frontend-only state):** Redux `selectedClue`; no API call. `selectClue` thunk looks up clue in board state.

**Answering a clue (backend mutation):** `answerClue(gameId, gameClueId, correct)` or `passClue(gameId, gameClueId)`. Backend computes `scoreDelta`, updates `GameClue` (state=RESOLVED, scoreDelta, answeredAt), updates `Game.score`.

**Score calculation:** Regular: `scoreDelta = correct ? clue.value : -clue.value`. Daily Double: `scoreDelta = correct ? wager : -wager`. Pass: `scoreDelta = 0`.

**GameClue state transitions:** Regular: UNANSWERED → RESOLVED (via answer or pass). Daily Double: UNANSWERED → ANSWERED (wager) → RESOLVED (answer).

**Round completion detection:** After each answer/pass, backend checks if all 60 GameClues are RESOLVED. If yes: `newScore > 0` → `FINAL_PENDING`; else → `ELIMINATED`.

**Mapping:** Controller `game.controller.ts` (lines 253–297) → Service `game.service.ts` `answerClue()` (lines 625–734). Prisma: `gameClue.update`, `game.update`, optional `game.update` (FINAL_PENDING | ELIMINATED).

---

#### Phase 4 – Final Jeopardy

**Domain concept:** After Double Jeopardy, if score > 0, user enters Final Jeopardy. Wager first, then answer.

**FINAL_PENDING:** User sees Final Jeopardy question; must submit wager (0 ≤ wager ≤ score).

**FINAL_ACTIVE:** User submits correct/incorrect.

**COMPLETED:** Backend updates final score, sets `state: COMPLETED`, updates user stats.

**Mapping:** Wager: `game.controller.ts` (lines 409–436) → `game.service.ts` (lines 854–891). Answer: `game.controller.ts` (lines 399–438) → `game.service.ts` (lines 900–951). Prisma: `finalJeopardy.update`, `game.update`. UserService: `updateUserStatsOnFinalJeopardyWager`, `updateUserStatsOnGameComplete`.

---

#### Explicit State Machine

```
PENDING
  │  Trigger: Frontend (Start Game button or autoStart)
  │  Implemented: game.controller.ts startGame() → game.service.ts startGame()
  │  DB writes: 60 GameClue inserts, 1 Game update (state: ACTIVE)
  ▼
ACTIVE
  │  Trigger: Backend (when last clue resolved and score > 0)
  │  Implemented: game.service.ts answerClue() / passClue() — round completion check
  │  DB writes: 1 Game update (state: FINAL_PENDING)
  │  (or score ≤ 0 → ELIMINATED)
  ▼
FINAL_PENDING
  │  Trigger: Frontend (submit wager)
  │  Implemented: submitFinalJeopardyWager()
  │  DB writes: FinalJeopardy update (wager), Game update (state: FINAL_ACTIVE)
  ▼
FINAL_ACTIVE
  │  Trigger: Frontend (submit answer)
  │  Implemented: answerFinalJeopardy()
  │  DB writes: FinalJeopardy update (correct, scoreDelta, answeredAt), Game update (score, state: COMPLETED)
  ▼
COMPLETED
```

**Terminal states:** `COMPLETED`, `ELIMINATED`, `PENDING` (abandoned before start)

---

#### Clean Mental Model Summary (Interview-Ready, ~2 minutes)

1. **Create:** User clicks "New Game." Backend creates a Game with `state: PENDING` and a single Final Jeopardy clue. No board yet. The split lets us redirect quickly.

2. **Start:** User clicks "Start Game." Backend builds the full board: 30 Jeopardy clues, 30 Double Jeopardy clues, assigns Daily Doubles per rules, and transitions to ACTIVE. This is the heavy work.

3. **Play:** User selects clues (frontend-only state), then answers or passes. Backend is the only authority: it computes score, updates GameClue, and optionally transitions to FINAL_PENDING or ELIMINATED when the last clue is resolved.

4. **Final Jeopardy:** If score > 0, user enters Final Jeopardy. Wager first (FINAL_PENDING → FINAL_ACTIVE), then answer. Backend updates final score and transitions to COMPLETED.

**Ownership:** Backend owns all game state and rules. Frontend displays and triggers; it never mutates state locally. Score and transitions are always computed server-side.

**Separation:** `createGame` is lightweight; `startGame` is heavy. That keeps create fast and allows users to abandon before starting.

---

## 3. Backend Deep Dive

### A. NestJS Architecture

**Modules:** `backend/src/app.module.ts` (lines 12–26)

- `ConfigModule` (global)
- `PrismaModule` (DB client)
- `AuthModule` (SupabaseService, AuthGuard)
- `GameModule` (GameController, GameService)
- `UserModule` (UserController, UserService)
- `ParsingModule`, `IngestionModule` (data ingestion)

**Controllers:** Define HTTP routes. `GameController` (`game.controller.ts`) has `@Controller('games')` and `@UseGuards(AuthGuard)` at class level.

**Services:** Hold business logic. `GameService` (`game.service.ts`) contains all game rules, state transitions, and Prisma calls.

**DTOs:** `backend/src/game/dto/` — e.g. `AnswerClueDto` (`answer-clue.dto.ts` lines 3–7): `@IsBoolean()`, `@IsNotEmpty()` on `correct`.

**Guards:** `AuthGuard` runs before controller methods; `@Public()` bypasses.

**Middleware:** `createCorsMiddleware` (`backend/src/common/middleware/cors.middleware.ts`) runs first; sets `Access-Control-*` headers and handles OPTIONS preflight.

**Business rules:** In `GameService` — e.g. Daily Double positions (3rd/4th/5th in category), wager bounds, state transitions.

**State transitions:** `GameState`: PENDING → ACTIVE → FINAL_PENDING → FINAL_ACTIVE → COMPLETED | ELIMINATED. `ClueState`: UNANSWERED → ANSWERED (DD only) → RESOLVED.

**User scoping:** Every game operation passes `userId` from `@CurrentUser()`; `getGameById` and `verifyGameOwnership` enforce ownership.

---

### B. Prisma

**Schema:** `backend/prisma/schema.prisma`

**Models and relationships:**
- `User` 1:N `Game`
- `Game` 1:N `GameClue`, 1:1 `FinalJeopardy`, 1:N `GameAudit`
- `Clue` N:1 `GameClue` (via `GameClueClue`), N:1 `FinalJeopardy` (via `FinalJeopardyClue`)
- `GameClue` links `Game` and `Clue`; has `state`, `isDailyDouble`, `wager`, `scoreDelta`
- `FinalJeopardy` links `Game` and `Clue`; has `wager`, `correct`, `scoreDelta`

**Migrations:** `backend/prisma/migrations/` — e.g. `20251231200038_init`, `20260125165351_add_user_profile_and_stats`.

**Prisma → SQL:** `prisma.game.create()` → `INSERT INTO "Game" ...`; `findUnique` with `include` → JOINs. Prisma generates type-safe client from schema.

**Transactions:** `game.service.ts` (lines 86–158, 419–462, 868–882, 906–918) — `prisma.$transaction(async (prisma) => { ... })` for create-game, start-game, final-wager, final-answer.

**Why Prisma:** Type safety, migrations, relation loading, transactions. **Pros:** Schema as source of truth, good DX. **Cons:** Less control than raw SQL; some N+1 risks if not careful with `include`.

---

### C. Supabase

**What Supabase provides:**
- **Postgres:** Hosted database; `DATABASE_URL` connects Prisma.
- **Auth:** Email/password sign-up and sign-in; issues JWTs.
- **JWT verification:** Backend verifies tokens with `SUPABASE_JWT_SECRET` (HS256) or `getUser()` (RS256 fallback).

**SUPABASE_ANON_KEY vs SUPABASE_JWT_SECRET:**
- **ANON_KEY:** Public key for Supabase client. Used by frontend and backend's Supabase client. Does not verify JWTs.
- **JWT_SECRET:** Secret for verifying JWT signatures. Found in Supabase Dashboard → Project Settings → API → JWT Secret. Backend uses it with `jwt.verify()`.

**JWT verification:** `supabase.service.ts` (lines 52–163): Decodes header for algorithm; HS256 → `jwt.verify(token, jwtSecret)`; RS256/ES256 → `supabase.auth.getUser(token)`.

---

### D. DTOs and Validation

The DTO is a schema and validator for the request payload, ensuring only well-formed, expected data reaches the service layer.

DTO (Data Transfer Object): A backend “interface with rules” that defines the shape of data sent to or from an API. In NestJS, DTOs are typically classes that specify types and validation for incoming requests, ensuring the backend only processes well-formed data. They act as a contract between the client and the service layer, similar to TypeScript interfaces but with runtime enforcement.

**Location:** `backend/src/game/dto/` — `create-game.dto.ts`, `answer-clue.dto.ts`, `submit-wager.dto.ts`, etc.

**Validation pipe:** `backend/src/main.ts` (lines 91–96): `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. Strips unknown properties, rejects extra fields, coerces types.

**Without validation:** Malformed or extra fields could reach the service; risk of injection or unexpected behavior.

---

### E. Logging, CORS, and Security

**CORS:** `backend/src/main.ts` (lines 12–88): `FRONTEND_URL` from env (comma-separated); custom middleware + `app.enableCors()`. Production requires `FRONTEND_URL` or only localhost is allowed.

**Environment separation:** Dev uses localhost origins; production uses `FRONTEND_URL` (CloudFront, custom domain). CORS middleware (lines 22–72) allows CloudFront hostnames and subdomains.

**Without correct CORS:** Browser blocks cross-origin requests; API returns 403 or CORS errors. CloudFront origin request policy must forward `Origin` (e.g. `Managed-AllViewerExceptHostHeader`).

---

## 4. CI/CD + Deployment

### Pipeline Trace

```
Push to main (backend/** or frontend/**)
    → GitHub Actions
    → Backend: npm ci, prisma generate, test, docker build (Dockerfile.prod), push to ECR, ECS update-service
    → Frontend: npm ci, next build (static export), aws s3 sync out/, cloudfront create-invalidation
```

### Workflow Files

- **Backend:** `.github/workflows/backend-deploy.yml` — triggers on `backend/**`; builds `Dockerfile.prod`; pushes to ECR; `aws ecs update-service --force-new-deployment`.
- **Frontend:** `.github/workflows/frontend-deploy.yml` — triggers on `frontend/**`; builds with `NEXT_PUBLIC_*` from secrets; syncs `out/` to S3; invalidates CloudFront.

### Dockerfile

- **Backend prod:** `backend/Dockerfile.prod` — multi-stage: builder runs `npm run build`, production stage copies `dist/` and runs `node dist/src/main.js`.

### ECS Task

- **Config:** `backend/ecs-task-backend.json` — Fargate, 256 CPU, 512 MB; secrets from SSM; `FRONTEND_URL` required for CORS.

### Why Static Export Works with S3

- `next build` with `output: 'export'` produces static HTML/JS/CSS in `out/`.
- S3 serves these files. No Node.js runtime needed.
- CloudFront caches at the edge.

### Why /api Is Routed Through CloudFront

- Single domain: frontend and API share the same origin for cookies/CORS.
- CloudFront path `/api*` → ALB → ECS. `NEXT_PUBLIC_API_URL` must be the CloudFront (or custom domain) URL including `/api` (e.g. `https://domain.com/api`).

### If SSR Were Used

- Would need a Node.js server (e.g. ECS, Lambda, or Vercel).
- S3 + CloudFront alone would not suffice; would need a server origin for dynamic routes.

---

## 5. Critical Architectural Tension: Next.js vs Plain React

### What Next.js Features Are Used

- App Router file-based routing
- `layout.tsx` for shared shell
- `generateStaticParams` for `/games/[id]` static export
- `next/image` (with `unoptimized: true` for static export)
- `next/navigation` (useRouter, useParams, useSearchParams)

### What Is Not Used

- SSR, RSC, `getServerSideProps`
- API routes (`app/api/`)
- Edge runtime
- Middleware (auth middleware exists but is minimal)
- ISR, revalidation

### Would Vite + React Have Been Simpler?

**Yes, for this app.** The frontend is effectively a SPA: login-gated, client-side routing, API-driven data. Vite would give:
- Simpler config
- Faster dev server
- No static export quirks (e.g. CloudFront rewrites for `/games/:id`)
- Single `index.html` for all routes (no need for `generateStaticParams` + rewrite)

### Was Static Export Necessary?

**For S3 + CloudFront, yes.** Next.js static export produces a static site. Alternative: Vite build → single `index.html` + JS chunks; S3 serves `index.html` for all routes via CloudFront error-page config. Simpler than Next.js static export + path rewrites.

### What Complexity Did Next Introduce?

- CloudFront function to rewrite `/games/:id` → `/games/new.html`
- `generateStaticParams` returning `[{ id: 'new' }]` as a single static path
- Client reading `gameId` from `window.location.pathname` because `params` may be stale in static export
- `images.unoptimized: true` for static export

### Would Deployment Have Been Simpler Without Next?

**Yes.** A Vite SPA: build → `dist/`; S3 + CloudFront with 404/403 → `index.html`. No path rewrites, no `generateStaticParams`.

---

### Interview Defense Strategy

**If I keep Next.js, how do I justify it?**
- "We use the App Router for structure and layouts. Static export keeps costs low and fits our S3 + CloudFront setup. We may add SSR or RSC later for SEO or performance."
- "The team was already familiar with Next.js; the tradeoff was acceptable for this project."

**If asked 'why not Vite?'**
- "Honestly, for this app, Vite would have been simpler. We don't use SSR or RSC. The main reason was existing Next.js familiarity and the hope of future server features. If I rebuilt it today, I'd consider Vite for a leaner stack."

**If I rebuilt it today, what would I change?**
- Consider Vite + React for the frontend.
- Ensure `NEXT_PUBLIC_API_URL` consistently includes `/api` (document and fix docker-compose if needed).
- Add request logging in the backend for easier debugging.
- Consider React Query instead of Redux for server state (games, board) to reduce boilerplate.

---

## 6. Things You Likely Don't Understand But Should

### AI-Scaffolded Areas

- **Daily Double assignment logic** (`game.service.ts` lines 313–416): Positions, category constraints, validation. Study the rules (1 DD in Jeopardy, 2 in Double Jeopardy, different categories).
- **CORS middleware** (`cors.middleware.ts`): CloudFront hostname matching, credentials, preflight. Know why `Origin` must be forwarded.
- **JWT verification fallback** (`supabase.service.ts` lines 80–111): HS256 vs RS256, when `getUser()` is used. Understand algorithm detection and fallback.

### Subtle Architectural Decisions

- **GameClue.isDailyDouble vs Clue.dailyDouble:** Per-game assignment is in `GameClue`; `Clue.dailyDouble` is unused for board creation. Ensures each game has correct DD placement.
- **Clue selection retry** (`game.service.ts` lines 331–311): Up to 50 retries to find categories with enough clues. Handles sparse or uneven data.
- **selectClue uses gameClueId for API:** `answerClue` and `passClue` take `clueId` in the URL, but the backend expects the **GameClue ID** (from `gameClueId`), not the Clue ID. Trace this in the controller and service.

### Hidden Complexity

- **Static export + client routing:** `params` from `useParams()` can be wrong for `/games/:id` in static export. The client uses `window.location.pathname` to get the real `gameId` (`GameDetailPageClient.tsx` lines 44–46).
- **CloudFront function:** Must be published after edits. Path pattern `/games/*` must have leading slash.
- **API URL with /api:** Frontend `API_URL` must end with `/api` so that `API_URL + '/games'` = `https://domain.com/api/games`. Docker Compose may use `http://localhost:3001`; if so, backend receives `/games` and 404s. Should be `http://localhost:3001/api`.

---

## 7. Mastery Checklist

Before interviews, confirm you can:

- [ ] **Explain auth flow without looking:** Sign in → Supabase session → `getSession()` → `Authorization: Bearer` → AuthGuard → `verifyToken()` → `sub` as userId.
- [ ] **Trace a clue answer:** Click → `answerClue` thunk → `apiPost(/games/:id/clues/:clueId/answer)` → GameController → GameService.answerClue → Prisma transaction (GameClue + Game update) → UserService stats → response → fetchGameData → Redux update.
- [ ] **Explain Prisma schema relationships:** User→Game→GameClue↔Clue; Game→FinalJeopardy↔Clue; GameAudit.
- [ ] **Justify architectural tradeoffs:** Next vs Vite, static export vs SSR, Prisma vs raw SQL, CORS requirements.
- [ ] **Explain CI/CD confidently:** Push → GitHub Actions → backend: test, Docker build, ECR push, ECS deploy; frontend: static build, S3 sync, CloudFront invalidation.
- [ ] **Describe deployment topology:** CloudFront → /api* to ALB→ECS, /* to S3; `NEXT_PUBLIC_API_URL` = CloudFront URL with `/api`.
- [ ] **Explain game state machine:** PENDING → ACTIVE → FINAL_PENDING → FINAL_ACTIVE → COMPLETED | ELIMINATED.
- [ ] **Explain Daily Double rules:** 1 in Jeopardy (positions 3–5), 2 in Double Jeopardy (different categories, positions 3–5).

---

*End of walkthrough. Use this as a living document; update line numbers if the codebase changes.*
