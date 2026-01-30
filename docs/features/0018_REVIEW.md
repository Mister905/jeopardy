# Feature 0018: Player Option to Pass on a Clue — Code Review

## Overview

This review covers the implementation of the “Pass on a clue” feature as specified in `0018_PLAN.md`. The implementation matches the plan: backend pass endpoint, validation (including Daily Double rejection), frontend Pass button placement and visibility, and no pass path for Daily Doubles or Final Jeopardy.

---

## 1. Plan Compliance

### Backend

| Requirement | Status | Notes |
|-------------|--------|--------|
| New endpoint `POST /games/:id/clues/:clueId/pass` | ✅ | `game.controller.ts` lines 301–342 |
| Auth same as answer (authenticated, game owner) | ✅ | Uses `AuthGuard`, `verifyGameOwnership` |
| Reject pass for Daily Double with validation error (400) | ✅ | `PassValidationException` in `game.service.ts` (line 1059): “Pass is not allowed for Daily Double clues” |
| Reject pass when clue already RESOLVED | ✅ | `PassValidationException` (line 1063): “Clue has already been resolved” |
| Reject when game not ACTIVE | ✅ | Controller checks `game.state !== GameState.ACTIVE` → `GameStateException` |
| Pass → RESOLVED, scoreDelta 0, score unchanged | ✅ | Service updates clue to RESOLVED, scoreDelta 0; no score update |
| Do not call `updateUserStatsOnClueResolved` for pass | ✅ | Comment and no call in `passClue` (line 1078) |
| Round completion after pass (all RESOLVED → FINAL_PENDING or ELIMINATED) | ✅ | Same logic as answer: `allResolved` check, then game state update |
| Response shape (gameClueId, clueId, state, scoreDelta: 0, newScore, answeredAt, message) | ✅ | Controller returns `AnswerClueResponseDto` with `correct: false`, `scoreDelta: 0`, `message: 'Clue passed'` |
| PassValidationException (400) for pass validation | ✅ | `exceptions/pass-validation.exception.ts` extends `BadRequestException`; controller rethrows in `handleServiceError` |

### Frontend

| Requirement | Status | Notes |
|-------------|--------|--------|
| Pass button immediately to the right of “Show Answer” | ✅ | `AnswerAdjudication.tsx`: Pass button in same `answer-adjudication__button-row` as Show Answer (lines 232–241) |
| Pass only when clue is active and unanswered | ✅ | Pass is in `!showAnswer` block; after Show Answer only “I got it right” / “I got it wrong” (and no Pass) |
| Pass not shown for Daily Double (intro, wager, or question) | ✅ | Game page: DD intro and DD question both use `allowPass={false}` (lines 497, 520). Regular UNANSWERED uses `allowPass={!selectedClue?.isDailyDouble}` (line 549) |
| Pass not shown in Final Jeopardy | ✅ | Final Jeopardy uses `FinalJeopardyView`; no `AnswerAdjudication` with Pass there |
| Pass does not reveal answer | ✅ | `handlePass` only calls `onPass()`; does not call `setShowAnswer(true)` |
| On success: refetch state, close/resolve clue | ✅ | `passClue` thunk calls `apiPassClue` then `dispatch(fetchGameData(gameId))`; fulfilled clears `selectedClue` |
| `passClue` API and thunk | ✅ | `games.ts`: `passClue(gameId, clueId)` → `POST …/pass`; `gameSlice.ts`: `passClue` thunk and extraReducers |
| `onPass` handler and `allowPass` prop | ✅ | Game page: `handlePassClue` dispatches `passClue`; passes `onPass={handlePassClue}` and `allowPass={!selectedClue?.isDailyDouble}` for regular clue |

### Styles

| Requirement | Status | Notes |
|-------------|--------|--------|
| Layout for Show Answer + Pass (flex row, Pass to the right) | ✅ | `AnswerAdjudication.scss`: `.answer-adjudication__button-row` flex row, gap; `.answer-adjudication__pass-btn` flex-shrink: 0; Show Answer flex: 1 |

---

## 2. Bugs and Logic

- No functional bugs found. Pass flow, validation, and UI visibility match the plan.
- **Redundancy (cosmetic):** In the game page, the block `selectedClue.state === 'UNANSWERED' && !selectedClue.isDailyDouble` already guarantees non–Daily Double; `allowPass={!selectedClue?.isDailyDouble}` is therefore always true there. You could use `allowPass={true}` for clarity; behavior is unchanged.

---

## 3. Data and API Alignment

- **Path param name vs semantics:** The route is `POST /games/:id/clues/:clueId/pass` and the backend looks up the clue with `gameClue.findUnique({ where: { id: clueId } })`. So the path parameter is effectively the **GameClue ID**, not the Clue (question) ID. The frontend correctly sends `selectedClue.gameClueId` in the pass API call. This matches existing `answerClue` and `submitClueWager` behavior. Only the param name is misleading; no change required for correctness, but documenting that `:clueId` is the GameClue id in the API layer would help.
- **Response:** Pass returns the same DTO shape as answer (`AnswerClueResponseDto` / `AnswerClueResponse`). Frontend uses existing types; no snake_case/camelCase or nesting issues found.

---

## 4. Over-engineering and Size

- **Backend:** `passClue` in the service is focused (validation, update, round completion). Dedicated `PassValidationException` is appropriate.
- **Frontend:** Pass is a small addition in `AnswerAdjudication` and the game page; `gameSlice` gains one thunk and three extraReducer cases. No refactor needed.
- File sizes and structure remain reasonable.

---

## 5. Style and Consistency

- Backend: Same patterns as `answerClue` (ownership check, game state check, service call, DTO mapping, `handleServiceError`).
- Frontend: Same button and handler patterns as existing adjudication (e.g. `handleAnswer` / `handlePass`), same loading/error handling via Redux.
- Naming and structure are consistent with the rest of the codebase.

---

## 6. Edge Cases and Error Handling

- **Pass fails (e.g. 400):** Thunk rejects, reducer sets `state.error`; game page renders `ErrorDisplay` from `state.game.error`; modal stays open. Plan satisfied.
- **Daily Double:** Backend rejects with 400 and “Pass is not allowed for Daily Double clues”; frontend does not show Pass for DD. Plan satisfied.
- **Already resolved:** Backend rejects with `PassValidationException`; frontend does not show Pass when `state === 'RESOLVED'` or in the post-answer view. Plan satisfied.

---

## Summary

| Category | Result |
|---------|--------|
| Plan implemented correctly | ✅ Yes |
| Obvious bugs | None found |
| Data/API alignment | ✅ OK (path param naming noted) |
| Over-engineering | None |
| Style / consistency | ✅ Matches codebase |

**Verdict: Approved.** The feature is implemented in line with the plan: pass is available only for regular, unanswered clues; Daily Doubles and Final Jeopardy correctly have no pass option; backend enforces rules and does not update user stats on pass; UI places Pass to the right of Show Answer and keeps layout and hierarchy unchanged.

### Optional Follow-ups

1. **Document API param:** In backend and/or API docs, note that `:clueId` in `POST /games/:id/clues/:clueId/pass` (and answer/wager) is the **GameClue** id, not the Clue id.
2. **Simplify allowPass in game page:** In the `UNANSWERED && !selectedClue.isDailyDouble` block, `allowPass={true}` is equivalent and slightly clearer than `allowPass={!selectedClue?.isDailyDouble}`.
