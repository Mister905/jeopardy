# Implementation Roadmap

This document outlines a strict, ordered sequence for implementing a production-quality MVP.
Each phase must be completed and validated before proceeding to the next.

The plan assumes:

- Backend-authoritative business rules
- A locked data model and interface contracts
- A thin frontend client
- Deterministic, testable system behavior

---

## Phase 1: Project & Infrastructure Setup

- Initialize frontend and backend projects using the chosen frameworks.
- Install and configure core tooling:
  - TypeScript
  - Database ORM
  - Environment configuration
- Configure database connections and environment variables.
- Apply the locked database schema.
- Run initial migrations.
- Verify database tables, constraints, and relationships match the schema exactly.

**Exit condition:**
The system builds, connects to the database, and the schema matches the design with no warnings or drift.

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

**Exit condition:**
All rules described in business_rules.md can be enforced via domain services alone.

---

## Phase 3: Raw Final Jeopardy File Parsing

- Implement a local parsing service for raw clue files:
  - Read all files from `backend/data/jeopardy_clue_dataset/raw`
  - Filter records where `round = 3` (Final Jeopardy)
  - Validate required fields: `category`, `answer`, `question` must be non-empty
  - Optional: tag each clue with `season_number` derived from metadata or filename
- Write cleaned, normalized data to `backend/data/jeopardy_clue_dataset/parsed`
- Log parsing results and flag any malformed or duplicate rows

**Exit condition:**
- All raw files are processed
- Only valid Final Jeopardy clues exist in `parsed/`
- Dataset is ready for ingestion into the database in the next phase

---

## Phase 4: Final Jeopardy Ingestion & Normalization

- Implement database ingestion service:
  - Read cleaned clues from `backend/data/jeopardy_clue_dataset/parsed`
  - Persist Final Jeopardy clues to the database:
    - Store with `round = FINAL` in the Clue table
    - Set appropriate category
    - Ensure clues are immutable after creation
    - Deduplicate identical clues
- Validate the dataset:
  - Ensure sufficient number of clues exist for game creation
  - Allow querying by category if needed
- Add error handling and logging

**Exit condition:**
- All parsed Final Jeopardy clues are ingested into the database
- Each clue has valid `category`, `answer`, and `question`
- Backend can safely serve Final Jeopardy clues to the Create Game endpoint

---

## Phase 5: Authentication

- Implement authentication and authorization infrastructure using Supabase Auth.
- Initialize Supabase Auth in the backend:
  - Configure Supabase client with project credentials
  - Set up Supabase Auth service integration
  - Configure JWT secret and verification settings
- Add JWT verification for all API endpoints that require authentication:
  - Implement authentication guards using Supabase JWT verification
  - Create middleware to validate Supabase JWT tokens
  - Extract user identity from verified JWT tokens
- Ensure that userId from the JWT is used to associate game objects and other domain entities:
  - Extract userId from Supabase JWT token claims
  - Pass userId to domain services for entity creation and queries
  - Associate all game objects, scores, and actions with authenticated userId
- Include authorization checks based on roles or ownership if necessary:
  - Verify users can only access their own games
  - Enforce ownership-based access control for game operations
  - Add role-based checks if multi-user or admin features are needed
- Ensure:
  - All protected endpoints require valid Supabase JWT tokens
  - User identity is reliably extracted from tokens for authorization checks
  - User context is available to domain services via authenticated userId
  - Implementation is fully verified via unit and end-to-end tests, including:
    - Valid, expired, and invalid JWT tokens
    - Missing or malformed token headers
    - Public route bypass
    - CurrentUser extraction
    - Logging and error handling without exposing sensitive information

**Exit condition:**
Supabase Auth is fully integrated, tested, and functional. All protected API endpoints securely identify users via JWT verification, userId is correctly propagated to domain services, and authorization checks enforce ownership and access control. Unit and E2E tests pass for all token and authentication scenarios.

---

## Phase 6: API Contracts & Endpoints

- Implement API endpoints according to the locked interface contract.
- Include:
  - Input validation
  - Authorization checks
  - State enforcement
  - Structured error handling
- Ensure endpoints remain thin:
  - No duplicated business logic
  - All rules delegated to domain services
- Integrate authentication guards from Phase 5.

**Exit condition:**
API endpoints fully expose backend capabilities without leaking or duplicating rules.

---

## Phase 7: Frontend Skeleton

- Build a minimal frontend layout.
- Integrate API calls for:
  - Creating or initializing core entities
  - Fetching current system state
- Render:
  - Core data views
  - State-driven UI (active vs inactive, enabled vs disabled)
- Implement basic user interactions without complex client-side logic.

**Exit condition:**
The UI can render and interact with real backend state without enforcing rules locally.

---

## Phase 8: Frontend State & Integration

- Introduce frontend state management if needed.
- Track:
  - User interactions
  - Current entity or workflow state
- Update UI strictly based on API responses.
- Explicitly avoid:
  - Client-side business rules
  - Derived or speculative logic

**Exit condition:**
The frontend behaves as a predictable client of the backend with no hidden logic.

---

## Phase 9: Testing & Validation

- Write backend unit tests for:
  - Business rules
  - State transitions
  - Edge cases
- Write frontend tests for:
  - Rendering
  - State updates
- Add integration tests for API endpoints.
- Validate:
  - All documented rules
  - All forbidden states are unreachable
- Fix defects and apply light polish.

**Exit condition:**
All critical paths are tested and the system behaves deterministically.

---

## Final Outcome

Upon completion, the system has:

- A backend that fully enforces all business rules
- A frontend that reflects backend state without duplicating logic
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

### Incremental Complexity

Each phase adds capability without increasing ambiguity.

### Testability as a Constraint

Correctness is validated continuously, not retrofitted.

### Clear Separation of Concerns

Infrastructure, rules, contracts, UI, and validation remain isolated and comprehensible.
