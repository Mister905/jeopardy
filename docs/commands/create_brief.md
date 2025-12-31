# Project Brief

## 1. Overview

This project is a single-player Jeopardy-style trivia web application.  
The system is designed to prioritize backend-enforced rules, deterministic state, and architectural clarity over feature breadth.  
This brief defines the fixed context and constraints for all planning and implementation work.

---

## 2. Purpose and Success Criteria

**Purpose**
- Build a faithful but simplified single-player adaptation of the Jeopardy game format.
- Demonstrate senior-level system design through clear rule enforcement, data modeling, and backend authority.

**Success means**
- All game rules are enforced server-side with no reliance on client logic.
- The system is deterministic, testable, and understandable by reading the schema and rules alone.

---

## 3. Core Constraints (Non-Negotiable)
- Single-player only; no multiplayer, turn order, or real-time interaction.
- Backend is the sole authority for game state, scoring, and rule enforcement.
- Game data must be persisted such that completed games are reproducible.
- External trivia data is constrained by the capabilities and limitations of the Cluebase API.

---

## 4. Users and Scope

**Primary user(s)**
- A single authenticated user playing a solo trivia game.

**In scope**
- Full Jeopardy, Double Jeopardy, and Final Jeopardy gameplay flow.
- Game creation, clue selection, answer submission, scoring, and completion.

**Explicitly out of scope**
- Multiplayer gameplay or competitive features.
- Timers, buzzing mechanics, or natural-language answer validation.
- Administrative tooling or content management interfaces.

---

## 5. Data Sources and Dependencies

**External data sources**
- Cluebase API (Jeopardy and Double Jeopardy clues only)
- Static offline dataset for Final Jeopardy clues

**Dependency constraints**
- The backend is solely responsible for fetching, normalizing, and storing external clue data.
- The frontend never communicates directly with external trivia APIs.

---

## 6. Business Rules Summary

The following rules must always be enforced:
- Each clue may be selected and answered only once.
- Daily Double and Final Jeopardy wagering must respect defined bounds.
- Game round progression is linear and irreversible.
- Completed games are immutable and reject further actions.

**Rule enforcement authority**
- Backend

---

## 7. Architecture Snapshot
- Frontend: Next.js (React)
- Backend: NestJS
- Database: PostgreSQL (via Supabase)
- ORM / Data layer: Prisma
- Authentication: JWT-based

---

## 8. Authority, Determinism, and State
- Source of truth: Backend database
- Runtime external calls allowed: Yes (Cluebase API during game creation only)
- Derived or transient state allowed: No
- All state transitions must be persisted: Yes

---

## 9. Immutability and Auditability

**Immutable data**
- Resolved clue records
- Completed game results

**Actions that must be traceable**
- Clue selection and resolution
- Wager submissions
- Score changes
- Game completion or elimination

---

## 10. Non-Goals (Intentional Exclusions)

The following are explicitly not part of this project:
- Real-time multiplayer features
- Automated answer correctness evaluation
- Dynamic rule configuration or game variants
- Production-grade security hardening beyond standard JWT auth

---

## 11. Locked Artifacts and References

The following documents or artifacts are authoritative:
- Schema: prisma/schema.prisma
- Rules specification: docs/business_rules.md

This brief is considered **locked**.  
Any change requires deliberate revision before implementation continues.