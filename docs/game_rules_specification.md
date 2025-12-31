# Game Rules Specification

## 1. Purpose

This document defines the gameplay rules for a single-player Jeopardy-style trivia game. The rules are grounded in the real Jeopardy television format while remaining feasible given the constraints of the Cluebase API and the intended scope of a portfolio application.

The goal is faithful adaptation, not full simulation. Where the real game introduces complexity that is impractical for a single-player, API-driven application, those differences are explicitly documented.

These rules form a contract between the frontend, backend, database schema, and automated tests.

---

## 2. Scope and Fidelity to Jeopardy

### 2.1 Rules Mirrored from Real Jeopardy

- Clue-and-response trivia format
- Categories with dollar values
- Increasing difficulty reflected by higher dollar values
- Daily Double wagering mechanics
- Final Jeopardy round

### 2.2 Intentional Simplifications

- Single-player only with no buzzing or turn order
- No timers or time pressure
- No host moderation
- No automated natural-language judging of answers

---

## 3. Game Structure

Each game consists of three sequential rounds, mirroring the real show:

1. Jeopardy Round
2. Double Jeopardy Round
3. Final Jeopardy

All rounds are played by a single authenticated user.

---

## 4. Question Selection Rules (API-Constrained)

### 4.1 Source of Truth

- All clues originate from the Cluebase API
- Only clues with the following properties are eligible:
  - Non-null clue text
  - Non-null correct response
  - Valid dollar value
- The backend is solely responsible for fetching, normalizing, and storing clues
- The frontend never communicates directly with Cluebase

### 4.2 Categories

- Categories are derived from Cluebase data
- Category names are treated as immutable strings
- Category grouping is best-effort due to inconsistencies in historical data

---

## 5. Jeopardy and Double Jeopardy Rounds

### 5.1 Board Composition

For each of the first two rounds:

- 6 categories are selected
- 5 clues per category are selected
- Dollar values follow the canonical Jeopardy structure:
  - Jeopardy: $200, $400, $600, $800, $1000
  - Double Jeopardy: $400, $800, $1200, $1600, $2000

If the backend cannot assemble a valid board due to insufficient data:

- It must attempt best-effort selection
- Game creation fails if minimum requirements cannot be met

### 5.2 Clue Selection

- The player may select clues in any order
- Each clue may be selected and answered only once
- Answered clues are marked as resolved

---

## 6. Daily Double (API-Defined)

### 6.1 Availability

- Daily Double status is not randomly assigned by the application
- The backend uses the `daily_double` field provided by the Cluebase API as the source of truth
- For each game board:
  - Jeopardy Round must contain exactly 1 Daily Double
  - Double Jeopardy Round must contain exactly 2 Daily Doubles

If the backend cannot construct a valid board that satisfies these constraints using available Cluebase data, game creation fails.

### 6.2 Wager Rules

- Minimum wager: $5
- Maximum wager:
  - The player’s current score, or
  - The highest clue value of the round, whichever is greater

If the player’s score is $0 or negative, the maximum wager equals the highest clue value of the round.

### 6.3 Scoring

- Correct response: wager amount is added to the score
- Incorrect response: wager amount is subtracted from the score

---

## 7. Final Jeopardy

### 7.1 Eligibility

- A player must have a positive score at the end of the Double Jeopardy round to participate in Final Jeopardy
- If the player’s score is $0 or negative, the game ends immediately after Double Jeopardy

This mirrors the elimination rule used in the television show and is preserved intentionally.

### 7.2 Setup

- One Final Jeopardy clue is selected
- The category is revealed before wagering

### 7.3 Wager

- The player may wager any amount from $0 up to their total score

### 7.4 Outcome

- Correct response: wager is added to the score
- Incorrect response: wager is subtracted from the score

---

## 8. Answer Submission and Validation

### 8.1 Self-Adjudicated Responses

- No typed answer input is required
- After revealing the correct response, the player explicitly indicates whether they answered correctly using a Yes or No action

The integrity of scoring relies on player honesty and is acceptable for a single-player trivia application.

### 8.2 Backend Responsibilities

The backend is authoritative for:

- Enforcing game state rules
- Validating wager bounds
- Applying score changes
- Preventing duplicate submissions

---

## 9. Scoring Rules

- Scores may be positive or negative
- Initial score is $0
- All score updates are calculated and persisted server-side

---

## 10. Game Completion

A game is complete when:

- All board clues are resolved and Final Jeopardy is completed, or
- The player is eliminated after Double Jeopardy due to a non-positive score

Upon completion:

- Final score is persisted
- Game status is set to `COMPLETED`
- No further actions are permitted

---

## 11. Persistence Model

The system persists sufficient data to support:

- Active games
- Completed game review
- Debugging and testing

For each resolved clue, the following is stored:

- Clue ID
- Round (Jeopardy, Double Jeopardy, or Final)
- Dollar value
- Wager, if applicable
- Player response text
- Correctness flag
- Score delta
- Timestamp

Historical records are immutable.

---

## 12. Error Conditions

The API must reject requests that attempt to:

- Answer a resolved clue
- Submit multiple responses for the same clue
- Wager outside allowed bounds
- Modify a completed game
- Access another user’s game

---

## 13. Determinism and Feasibility

- Daily Doubles are determined by the backend based on Cluebase data
- Game state is fully reproducible from persisted data
- Rules are constrained to what Cluebase can reliably provide

---

## 14. Rule Governance

Any rule changes require updates to:

- This document
- Backend tests
- API documentation

Rule evolution is tracked via version control.
