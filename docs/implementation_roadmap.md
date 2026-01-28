# Implementation Roadmap

This document outlines a strict, ordered sequence for implementing a production-quality MVP.
Each phase must be completed and validated before proceeding to the next.

The plan assumes:

- Backend-authoritative business rules
- A locked data model and interface contracts
- A thin frontend client
- Deterministic, testable system behavior

**Checkpoint rule:** After every 2–3 phases, the following must be answered: *Can a human complete a meaningful task?* If not, the roadmap must not advance. Do not proceed until the checkpoint is satisfied.

---

## Phase 1: Project and Infrastructure Setup

- Initialize frontend and backend projects using the chosen frameworks.
- Install and configure core tooling:
  - TypeScript
  - Database ORM
  - Environment configuration
- Configure database connections and environment variables.
- Apply the locked database schema.
- Run initial migrations.
- Verify database tables, constraints, and relationships match the schema exactly.

**Exit condition:** The system builds, connects to the database, and the schema matches the design with no warnings or drift.

---

## Phase 2: Backend Core Domain

- Implement core backend domain services and entities.
- Encode all business rules and state transitions in the backend.
- Ensure:
  - State progression is explicit and enforced
  - Invalid states are impossible or rejected
  - All calculations and mutations occur server-side
- Persist all authoritative state changes.
- Do not implement API controllers or UI logic yet.

**Exit condition:** All rules described in business_rules.md can be enforced via domain services alone.

---

## Phase 3: Minimal Clue Data for Gameplay

- Provide just enough clue data to support one playable game round.
- Options (choose one and lock):
  - Seed a small set of clues via migration or script
  - Parse a minimal subset of raw files and ingest only what is needed for one round
- Persist clues with correct round, category, value, question, and answer.
- Ensure the backend can create a game and serve at least one full round of clues.
- Data ingestion in this phase exists only to support gameplay; do not expand the dataset beyond what is required.

**Exit condition:** A game can be created and populated with enough clues for a human to play one full round. No placeholder or mocked clue content.

**Checkpoint:** Can a human complete a meaningful task? (Not yet—no UI. Checkpoint satisfied once Phase 6 is complete.)

---

## Phase 4: Authentication (Essential)

- Implement sign-up and sign-in using Supabase Auth.
- Configure Supabase client, JWT verification, and extraction of user identity from tokens.
- Ensure userId from the JWT is passed to domain services for entity creation and queries.
- Protect game-related endpoints: require valid Supabase JWT and enforce that users can access only their own games.
- Implement only what is needed for the playable loop: sign up, sign in, token validation, and userId propagation. Defer advanced auth features (e.g. roles, password reset flows) until after the core gameplay loop is complete.

**Exit condition:** A user can sign up and sign in; all protected endpoints require a valid JWT and use the authenticated userId; ownership checks prevent access to other users’ games.

---

## Phase 5: API Contracts and Endpoints

- Implement API endpoints according to the locked interface contract for the core gameplay loop:
  - Create game, start game, fetch game and board
  - Select clue, submit answer, receive score update
- Include input validation, authorization checks, state enforcement, and structured error handling.
- Keep endpoints thin: no duplicated business logic; all rules delegated to domain services.
- Integrate authentication guards from Phase 4.

**Exit condition:** All operations required for the playable game loop (create game, start game, see clues, answer clues, get score) are available via the API and behave correctly. API responses are the single source of truth for state.

---

## Phase 6: Vertical Slice — Playable Game Loop

- Deliver a single, end-to-end flow that a human can use without placeholders or mocks.
- The user must be able to:
  - Sign up or sign in
  - Start a game
  - See a clue (question and value)
  - Answer a clue (correct or incorrect)
  - Receive score feedback (updated score visible after answering)
- The UI may be minimal (e.g. simple forms, basic layout, no polish) but must be fully functional.
- All interactions must call real APIs and display real backend state. No mocked responses, no stub flows, no “coming soon” steps in this path.
- Frontend must remain thin: no client-side business rules; display and actions driven by API responses.

**Exit condition (human-usable):** A new user can sign up, sign in, start a game, see at least one clue, answer it, and see their score update correctly. The full loop completes without errors. If this cannot be demonstrated, the phase is not complete and the roadmap must not advance.

**Checkpoint:** Can a human complete a meaningful task? Yes—completing one round of play with real sign-in, clues, and score. Do not proceed to Phase 7 until this is true.

---

## Phase 7: Raw Final Jeopardy File Parsing

- Implement a local parsing service for raw clue files:
  - Read all files from `backend/data/jeopardy_clue_dataset/raw`
  - Filter records where `round = 3` (Final Jeopardy)
  - Validate required fields: `category`, `answer`, `question` must be non-empty
  - Optional: tag each clue with `season_number` derived from metadata or filename
- Write cleaned, normalized data to `backend/data/jeopardy_clue_dataset/parsed`
- Log parsing results and flag any malformed or duplicate rows

**Exit condition:** All raw files are processed; only valid Final Jeopardy clues exist in `parsed/`; dataset is ready for ingestion in the next phase.

---

## Phase 8: Final Jeopardy Ingestion and Normalization

- Implement database ingestion service:
  - Read cleaned clues from `backend/data/jeopardy_clue_dataset/parsed`
  - Persist Final Jeopardy clues to the database with `round = FINAL`, correct category, and immutable semantics
  - Deduplicate identical clues
- Validate the dataset: ensure sufficient clues exist for game creation; support querying by category if needed.
- Add error handling and logging.

**Exit condition:** All parsed Final Jeopardy clues are ingested; each has valid `category`, `answer`, and `question`; the backend can serve Final Jeopardy clues to the game lifecycle. Existing playable loop from Phase 6 still works with the expanded dataset.

**Checkpoint:** Can a human complete a meaningful task? Yes—playable loop still works with full Final Jeopardy data. Do not proceed to Phase 9 until this is confirmed.

---

## Phase 9: Frontend State and Integration

- Introduce or refine frontend state management so UI stays aligned with API state.
- Track user interactions and current entity or workflow state.
- Update UI strictly from API responses. Avoid client-side business rules and speculative or derived logic.
- Extend the UI only to support flows already backed by the API (e.g. full game flow, round transitions). Do not add stats dashboards, historical views, or optimization work in this phase.

**Exit condition (human-usable):** A new user can complete a full Jeopardy round (and, if implemented, Double Jeopardy and Final Jeopardy) without errors. All visible state (score, board, clue state) reflects backend state. No hidden or local-only rules.

---

## Phase 10: Stats, Dashboards, and Historical Features

- Implement any stats dashboards, historical game lists, or user progress tracking according to the locked contract.
- All new behavior must be backed by the backend; frontend only displays and triggers API calls.
- This phase assumes the core gameplay loop and data ingestion are already complete and stable.

**Exit condition (human-usable):** A user can complete a game and see their stats or history (as specified in the contract) in the UI, with data coming from the API.

---

## Phase 11: Testing and Validation

- Write backend unit tests for business rules, state transitions, and edge cases.
- Write frontend tests for rendering and state updates driven by API responses.
- Add integration tests for API endpoints.
- Validate that all documented rules hold and all forbidden states are unreachable.
- Fix defects and apply light polish without introducing new hidden logic.

**Exit condition:** All critical paths are tested; the system behaves deterministically; a human can still complete the full playable loop and any supported stats/history flows without regression.

**Checkpoint:** Can a human complete a meaningful task? Yes—full loop and any Phase 10 features remain usable and tested.

---

## Final Outcome

Upon completion, the system has:

- A backend that fully enforces all business rules
- A frontend that reflects backend state without duplicating logic
- A playable game loop that was validated early (Phase 6) and never broken by later phases
- Test coverage for critical behavior
- A stable, explainable architecture ready for iteration

---

## Why This Structure Works

### Backend-First Authority

Rules are implemented once, centrally, and enforced consistently.

### Locked Schema and Contracts

Early finalization prevents cascading refactors and schema drift.

### Deterministic State

All authoritative state is persisted, reproducible, and auditable.

### Vertical Slice Before Expansion

The playable game loop is delivered early (Phase 6). Data ingestion and advanced features expand a working, human-usable flow instead of building atop invisible or incomplete systems.

### Human-Usable Exit Conditions

Phases that introduce or change UI require exit conditions stated in terms of user actions (e.g. “A new user can complete a full round without errors”). This prevents “backend complete, UI nonfunctional” drift.

### Recurring Checkpoints

After every 2–3 phases, the checkpoint rule forces the question: *Can a human complete a meaningful task?* If not, the roadmap does not advance. This keeps progress visible and usable.

### Testability as a Constraint

Correctness is validated continuously, not retrofitted.

### Clear Separation of Concerns

Infrastructure, rules, contracts, UI, and validation remain isolated and comprehensible.
