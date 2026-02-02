# Implementation Roadmap

This document outlines a strict, ordered sequence for implementing a production-quality, employer-facing MVP. Each phase must be completed and validated before proceeding to the next.

The plan assumes:

- Backend-authoritative business rules
- A locked data model and interface contracts
- A thin frontend client
- Deterministic, testable system behavior

**Checkpoint rule:** After every 2–3 phases, the following must be answered: *Can a human complete a meaningful task?* If not, the roadmap must not advance.

**Structure:** Phases are grouped into **Planning**, **Core Implementation**, **UX & Auth Foundation**, **Frontend Polish**, **Testing**, **Infrastructure & Environment**, **Deployment**, and **Post-Deployment Polish**. Core functionality, UX, and data integrity are established before deployment; infrastructure and deployment are intentional, not incidental.

---

## Planning (Pre-Implementation)

### Phase 0: Contracts and Schema Lock

- Finalize game rules specification, database schema, and API contract before building.
- Lock schema and contracts so backend and frontend share a single source of truth; avoid cascading refactors from late changes.
- Document business rules (e.g. game_rules_specification.md), Prisma schema, and API shapes.

**Rationale:** Prevents rework; ensures backend and frontend align on state, endpoints, and validation. Professional builds lock contracts early.

**Exit condition:** Schema, API contract, and game rules are documented and agreed; migrations and endpoint list exist on paper or in version control.

---

## Core Implementation

### Phase 1: Project and Infrastructure Setup

- Initialize frontend and backend projects (frameworks, TypeScript, database ORM, environment configuration).
- Configure database connections and environment variables.
- Apply the locked database schema and run initial migrations.
- Verify database tables, constraints, and relationships match the schema.

**Rationale:** Build and database must be stable before domain or API work. No feature work without a working stack.

**Exit condition:** The system builds, connects to the database, and the schema matches the design with no warnings or drift.

---

### Phase 2: Backend Core Domain

- Implement core backend domain services and entities.
- Encode all business rules and state transitions in the backend.
- Ensure state progression is explicit and enforced; invalid states are rejected; all calculations and mutations occur server-side.
- Persist all authoritative state changes. Do not implement API controllers or UI yet.

**Rationale:** Rules live in one place; API and UI later delegate to domain. Enables testing and consistency.

**Exit condition:** All rules described in business_rules.md (or equivalent) can be enforced via domain services alone.

---

### Phase 3: Minimal Clue Data for Gameplay

- Provide just enough clue data to support one playable game round (seed, migration, or parse minimal raw subset).
- Persist clues with correct round, category, value, question, and answer.
- Ensure the backend can create a game and serve at least one full round of clues.

**Rationale:** Playable loop requires real data; no placeholders. Data scope stays minimal until loop is proven.

**Exit condition:** A game can be created and populated with enough clues for a human to play one full round. No placeholder or mocked clue content.

**Checkpoint:** Can a human complete a meaningful task? Not yet—no UI. Satisfied once the vertical slice (Phase 6) is complete.

---

### Phase 4: Authentication (Essential)

- Implement sign-up and sign-in using Supabase Auth.
- Configure Supabase client, JWT verification, and extraction of user identity from tokens.
- Ensure userId from the JWT is passed to domain services for entity creation and queries.
- Protect game-related endpoints: require valid Supabase JWT and enforce that users can access only their own games.
- Implement only what is needed for the playable loop: sign up, sign in, token validation, userId propagation.

**Rationale:** All game operations are user-scoped; auth is a prerequisite for API and UI. No gameplay without identity and ownership.

**Exit condition:** A user can sign up and sign in; all protected endpoints require a valid JWT and use the authenticated userId; ownership checks prevent access to other users’ games.

---

### Phase 5: API Contracts and Endpoints

- Implement API endpoints according to the locked contract for the core gameplay loop (create game, start game, fetch game and board, select clue, submit answer, score update).
- Include input validation, authorization checks, state enforcement, and structured error handling.
- Keep endpoints thin: no duplicated business logic; all rules delegated to domain services.
- Integrate authentication guards from Phase 4.

**Rationale:** API is the single source of truth for state; frontend will consume it. Thin controllers keep behavior in domain and testable.

**Exit condition:** All operations required for the playable game loop are available via the API and behave correctly. API responses are the single source of truth for state.

---

### Phase 6: Vertical Slice — Playable Game Loop

- Deliver a single, end-to-end flow that a human can use without placeholders or mocks.
- The user must be able to: sign up or sign in, start a game, see a clue (question and value), answer a clue (correct or incorrect), receive score feedback.
- The UI may be minimal but must be fully functional. All interactions must call real APIs and display real backend state.
- Frontend must remain thin: no client-side business rules; display and actions driven by API responses.

**Rationale:** Validates the full stack early; proves that core functionality, UX, and data integrity work together. Foundation for all later phases.

**Exit condition:** A new user can sign up, sign in, start a game, see at least one clue, answer it, and see their score update correctly. The full loop completes without errors.

**Checkpoint:** Can a human complete a meaningful task? Yes—completing one round of play with real sign-in, clues, and score.

---

### Phase 7: Raw Final Jeopardy File Parsing

- Implement local parsing for raw clue files (round = 3, validate required fields, write to parsed/).
- Log parsing results and flag malformed or duplicate rows.

**Rationale:** Extends clue data in a controlled way; parsing is separate from ingestion and domain logic.

**Exit condition:** All raw files are processed; only valid Final Jeopardy clues exist in parsed/; dataset is ready for ingestion.

---

### Phase 8: Final Jeopardy Ingestion and Normalization

- Ingest parsed Final Jeopardy clues into the database; deduplicate; validate dataset.
- Ensure backend can serve Final Jeopardy clues to the game lifecycle.

**Rationale:** Completes data pipeline for full game; playable loop remains working with expanded dataset.

**Exit condition:** All parsed Final Jeopardy clues are ingested; backend serves them correctly. Existing playable loop still works.

**Checkpoint:** Full playable loop works with Final Jeopardy data.

---

### Phase 9: Frontend State and Integration

- Refine frontend state management so UI stays aligned with API state.
- Track user interactions and current entity or workflow state.
- Update UI strictly from API responses. Extend UI only to support flows already backed by the API (full game flow, round transitions).

**Rationale:** Prevents client/server drift; keeps frontend as a reflection of backend state. No speculative or hidden rules.

**Exit condition:** A user can complete a full Jeopardy round (and Double Jeopardy and Final Jeopardy if implemented) without errors. All visible state reflects backend state.

---

## UX & Auth Foundation

### Phase 10: Foundational UX & Auth

- **Functional sign-up and sign-in flows:** Ensure sign up and sign in work end-to-end with clear feedback (validation, errors, redirects).
- **Username support:** Collect and persist username where required by the contract; display where appropriate (e.g. header, profile).
- **Removal of non-functional OAuth paths:** Remove or disable any OAuth or social login paths that are not implemented or not in scope; avoid dead links or misleading UI.
- **Baseline UI completeness:** Forms, buttons, labels, and error messages are present and usable before adding more features. No “coming soon” or broken flows in the primary auth and game-entry path.

**Rationale:** Auth and first-run UX set the tone for the product. Incomplete or broken auth flows undermine trust and employer review. Establishing a complete, minimal UX before feature expansion reduces rework and polish debt.

**Exit condition:** A new user can sign up (with username if required), sign in, and reach the main app without hitting non-functional or placeholder flows. Auth-related UI is complete and consistent for the scope of the project.

---

## Frontend Polish

### Phase 11: Frontend Styling & Component Strategy

- **Component library decision:** Decide and document whether to use a component library (e.g. shadcn/ui) or custom components; apply consistently across the app.
- **SCSS adoption and style organization:** Adopt SCSS (or agreed approach) with a clear structure (e.g. variables, mixins, component-scoped files); avoid ad-hoc or duplicated styles.
- **Removal of excessive inline styles:** Move styling into stylesheets or design tokens; reserve inline styles only where necessary (e.g. dynamic values). Improves maintainability and consistency.
- **Visual consistency and accessibility:** Apply a consistent visual language (spacing, typography, colors); address baseline accessibility (focus, contrast, labels, semantic structure) so the app is presentable and usable for employer review.

**Rationale:** Styling and component strategy done early reduce churn. A coherent, accessible UI signals professional frontend practice and supports resume/portfolio narrative.

**Exit condition:** Styling is organized and consistent; inline styles are minimized; component strategy is documented; baseline accessibility is met. No new features that add significant UI without following the strategy.

---

### Phase 12: Stats, Dashboards, and Historical Features

- Implement stats dashboards, historical game lists, or user progress tracking according to the locked contract.
- All new behavior must be backed by the backend; frontend only displays and triggers API calls.
- Follow the styling and component strategy from Phase 11.

**Rationale:** Extends value of the app after core loop and polish are stable. Keeps backend as source of truth.

**Exit condition:** A user can complete a game and see their stats or history (as specified) in the UI, with data from the API. UI conforms to the chosen styling and component approach.

---

## Testing (Before Deployment)

### Phase 13: Testing Phase

- **Backend unit and integration testing (NestJS):** Unit tests for domain services (game rules, state transitions, edge cases). Integration tests for API endpoints (auth, ownership, validation). Use NestJS testing utilities and, where appropriate, mocked or real DB as documented.
- **Frontend component and interaction testing (React):** Component tests for critical UI (e.g. game board, clue modal, auth forms). Interaction tests for user flows driven by API responses (e.g. create game, answer clue). Use React Testing Library (or equivalent); mock API where appropriate.
- **Define “sufficiently tested” for this project:** Document which paths are critical (e.g. auth, create/start game, answer clue, score update) and what level of coverage or test types are required before deployment. Clarify which tests are required to pass in CI and which are optional or deferred.
- **Demonstrate real-world testing practices:** Tests should be readable, deterministic, and suitable for employer review—no flaky or environment-dependent tests without documentation. Fix or quarantine known failures and document expectations.

**Rationale:** Testing before deployment catches regressions and demonstrates engineering discipline. A clear “sufficiently tested” bar avoids either under-testing or blocking deploy on non-critical tests. Employer-facing projects benefit from visible, maintainable test suites.

**Exit condition:** Critical paths have automated tests; “sufficiently tested” is documented; required tests pass in CI; known gaps or skipped tests are documented. Human playable loop still works; no regressions in covered behavior.

**Checkpoint:** Core functionality is tested and deployable from a quality perspective.

---

## Infrastructure & Environment

### Phase 14: Infrastructure & Environment Phase

- **Docker + Docker Compose for local dev:** Provide a single-command way to run frontend and backend locally (e.g. `docker compose up`). No database container if using external Supabase; document that Supabase (Postgres + Auth) is external.
- **Environment parity:** Document and align required environment variables for local and production (e.g. DATABASE_URL, Supabase vars, API URL, frontend URL). Use `.env.example` and avoid secrets in Dockerfiles or compose files.
- **Clear separation of concerns:** Document roles of frontend, backend, and external Supabase (Auth, Postgres). Frontend talks only to backend API and Supabase Auth; backend talks to Supabase Postgres and verifies Supabase JWT. No mixing of responsibilities.

**Rationale:** Infrastructure decisions should be intentional and repeatable. Docker and env parity make onboarding and deployment predictable; separation of concerns keeps the system understandable and secure.

**Exit condition:** Developers can run the full stack locally with Docker (and configured .env). Environment variables and separation of concerns are documented. No secrets in version-controlled infra files.

---

## Deployment

### Phase 15: Deployment Phase (AWS-Focused)

- **Frontend deployment:** Use S3 + CloudFront (or equivalent) for hosting the built frontend. Configure origin, caching, and HTTPS. Ensure NEXT_PUBLIC_API_URL (or equivalent) points to the deployed backend.
- **Backend deployment:** Use AWS for the API (ECS, EC2, or equivalent). Configure runtime, environment variables, and health checks. Ensure CORS (FRONTEND_URL or allowed origins) matches the deployed frontend origin.
- **Clear rationale for AWS choices:** Document why AWS (e.g. portfolio signaling, employer familiarity, cost control). Keep architecture simple and explainable for interviews.
- **Minimal deploy checklist:** Gate this phase on a minimal deploy checklist: migrations applied to production DB; clue data ingested or seeded; env vars set for production; CORS and API URL consistent; at least one smoke check (e.g. sign in, create game, open clue). See also Feature 0020 (Minimum Deploy Readiness) for a detailed checklist.

**Rationale:** Explicit deployment phase with a clear target (AWS) and a gating checklist avoids “it works on my machine” and ensures the project is demonstrably deployable—a key signal for employers.

**Exit condition:** Frontend is deployed and reachable; backend is deployed and reachable; checklist is satisfied; a human can sign in and complete at least one meaningful action in production.

---

## Post-Deployment Polish

### Phase 16: Post-Deployment Polish Phase

- **Performance checks:** Review load time, API response times, and any obvious bottlenecks. Address critical issues; document acceptable baseline for the scope of the project.
- **Error handling and logging review:** Ensure errors are surfaced to users where appropriate (e.g. ErrorDisplay); backend logs are sufficient for debugging without leaking PII. No silent failures on critical paths.
- **README and architecture documentation:** Update README with how to run locally, how to deploy, and what the project does. Add a brief architecture overview (frontend, backend, Supabase, data flow) suitable for portfolio or interview discussion.
- **Resume / interview talking points:** Document key technical decisions, tradeoffs, and “what I would do next” so the project can be discussed confidently in interviews. No code required—bullet points or short notes suffice.

**Rationale:** Polish and documentation complete the professional narrative. Employers and reviewers expect a runnable, explainable project with clear ownership of tradeoffs.

**Exit condition:** Performance is acceptable; error handling and logging are reviewed; README and architecture are updated; talking points are documented. The project is presentable as a portfolio piece.

---

## Final Outcome

Upon completion, the system has:

- A backend that fully enforces all business rules
- A frontend that reflects backend state without duplicating logic
- Functional auth and foundational UX (sign up, sign in, username, no dead OAuth)
- A consistent frontend styling and component strategy with baseline accessibility
- A playable game loop validated early (Phase 6) and never broken by later phases
- Test coverage and a defined “sufficiently tested” bar
- Intentional infrastructure (Docker, env, separation of concerns)
- A deployed, AWS-hosted application gated by a minimal deploy checklist
- Post-deployment polish: performance, errors, docs, and interview-ready talking points

---

## Why This Structure Works

### Backend-First Authority

Rules are implemented once, centrally, and enforced consistently.

### Locked Schema and Contracts

Early finalization (Phase 0) prevents cascading refactors and schema drift.

### Vertical Slice Before Expansion

The playable game loop is delivered early (Phase 6). Data, auth UX, styling, and features expand a working, human-usable flow.

### UX & Auth Before Feature Creep

Phase 10 ensures sign up, sign in, username, and baseline UI completeness before adding stats or extra features. Non-functional OAuth is removed so the app does not present broken paths.

### Styling and Components Before Scale

Phase 11 locks component strategy and SCSS organization so new features do not introduce inconsistent or inline-heavy UI.

### Testing Before Deployment

Phase 13 defines “sufficiently tested” and implements backend and frontend tests before infrastructure and deployment. Quality is a gate, not an afterthought.

### Infrastructure and Deployment as Explicit Phases

Phases 14 and 15 make Docker, env parity, and AWS deployment intentional. A minimal deploy checklist gates go-live. Portfolio and employer expectations are met by a real, deployable system.

### Polish After Deploy

Phase 16 focuses on performance, error handling, documentation, and talking points once the system is live. Completes the professional narrative without blocking first deploy.

### Recurring Checkpoints

The checkpoint rule (“Can a human complete a meaningful task?”) is applied at defined phases so progress stays visible and usable.

### Clear Separation of Concerns

Planning, implementation, UX foundation, frontend polish, testing, infrastructure, deployment, and polish are separated so sequencing and intent are clear—suitable for an employer-facing, professional build.
