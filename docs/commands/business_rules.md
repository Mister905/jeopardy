# Business Rules – Single-Player Jeopardy Game

These rules define the authoritative behavior for the game, and any implementation must enforce them.

---

## 1. Player and Game

- Each game is played by a single authenticated user.
- A user may only have one active game at a time.
- All actions are tied to the user through a JWT.

---

## 2. Game Structure

- Each game consists of three sequential rounds:
  1. Jeopardy
  2. Double Jeopardy
  3. Final Jeopardy
- A game proceeds round by round; the next round begins only after all clues in the current round are resolved.
- Players are eliminated if their score is ≤ $0 after Double Jeopardy.

---

## 3. Clues

- All clues originate from the backend’s cached data sources (Cluebase or static datasets).
- Clues are immutable: category, round, question, answer, value cannot change once stored.
- Each clue can only be answered once.
- Daily Double clues must follow backend-assigned status; no random assignment by the client.

---

## 4. Wagering

- Daily Double:
  - Minimum wager: $5
  - Maximum wager: the greater of the player’s current score or the highest clue value of the round.
  - If the player’s score is ≤ $0, max wager is the round’s highest clue value.
- Final Jeopardy:
  - Player may wager any amount from $0 up to their total score.
- Score is updated only after player submits Yes/No adjudication.

---

## 5. Answer Submission

- No typed input is required; the player indicates correct or incorrect via a button.
- The backend validates wagers and prevents duplicate submissions.
- Scores are persisted server-side and are the single source of truth.

---

## 6. Game Completion

- A game completes when:
  - All board clues are resolved and Final Jeopardy is completed, or
  - The player is eliminated after Double Jeopardy.
- Final score is saved and game status is set to COMPLETED or ELIMINATED.
- Completed games are read-only.

---

## 7. Auditability

- All significant actions must be tracked:
  - Clue answered
  - Wager submitted
  - Score change
  - Game state transition
- Historical records are immutable.

---

## 8. Error Handling

- Backend rejects:
  - Attempting to answer an already resolved clue
  - Submitting multiple responses for the same clue
  - Wagers outside allowed bounds
  - Modifying a completed game
  - Accessing another user’s game