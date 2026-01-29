# Feature 0017: Shadcn UI Integration — Code Review

**Reviewer:** Code review per `docs/commands/code_review.md`  
**Plan:** `docs/features/0017_PLAN.md`  
**Scope:** Phase 1 (setup/theming), Phase 2 (mapping), Phase 3 (incremental integration)

---

## 1. Plan adherence

**Implemented as intended.**

- **Phase 1:** Shadcn-style setup is in place: `components.json`, Radix + CVA + `tailwind-merge` in `package.json`, Tailwind theme extended with Shadcn-style CSS variables in `tailwind.config.js`, `globals.css` defines `:root` (and `.dark`) tokens. Layout still loads `globals.css` then `main.scss`; `.app-root` gradient remains in SCSS. Theme values in `globals.css` align with the palette described in `_variables.scss` (primary, destructive, border, etc.).
- **Phase 2:** `frontend/REFACTOR.md` exists with a mapping table, migration order, and theme-sync note. Matches the plan’s “mapping table or list” deliverable.
- **Phase 3:** Button (wrapper over `base-button`), Input/Label (WagerInput, login), Card (dashboard sections), Dialog (clue modal), Alert (ErrorDisplay) are integrated. Consuming components use the new primitives; SCSS (e.g. `DashboardSection.scss`) is used for overrides only.

**Minor deviation:** The plan suggested “add Shadcn component (e.g. `npx shadcn add button`)”. The code uses a custom `base-button.tsx` (CVA + Radix Slot) instead of the CLI-generated button. Behavior and API are Shadcn-style and the public `Button` API (primary/secondary/danger) is preserved, so this is acceptable.

---

## 2. Bugs and issues

### Use `ErrorDisplay` in game PENDING state (fix recommended)

In `frontend/src/app/games/[id]/page.tsx`, when `game.state === 'PENDING'` and there is an error, the UI uses a raw styled div instead of `ErrorDisplay`:

```tsx
// Lines 240–243 (PENDING state)
{error && (
  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
    {error}
  </div>
)}
```

Elsewhere on the same page (e.g. initial load error, inline error with Dismiss), `ErrorDisplay` is used. For consistency and to keep all error UI on Shadcn Alert, this block should render `<ErrorDisplay error={error} />` (and optionally a Dismiss button if desired), and the one-off red styling should be removed.

### No other obvious bugs

- WagerInput: `onChange={(e) => handleWagerChange(e.target.value)}` is correct.
- Dialog: Controlled with `open={!!selectedClue}` and `onOpenChange` dispatching `setSelectedClue(null)`; close (X) and overlay behave as expected.
- ErrorDisplay: Accepts `string | Error` and uses Alert destructive variant; `errorMessage` derivation is correct.
- Login: `error || validationError || ''` is only rendered when `(error || validationError)` is truthy, so the displayed value is always a string when the block is shown.

---

## 3. Data alignment (snake_case / camelCase / nesting)

No issues found. Components use React/Supabase-style props and state; no mismatch between snake_case API and camelCase props, or unexpected `{ data: { ... } }` wrapping in the reviewed flows.

---

## 4. Over-engineering and file size

- **Game detail page** (`app/games/[id]/page.tsx`): Long but single-responsibility (game state machine, routing, modals). Acceptable; splitting would be optional (e.g. extract clue modal content into a `ClueModal` component) for readability, not required for this review.
- **UI components:** `base-button`, `alert`, `card`, `dialog`, `input`, `label` are small and focused. No over-engineering.
- **REFACTOR.md:** Concise; no unnecessary process.

---

## 5. Syntax and style vs rest of codebase

### Consistency

- **Button:** Public `Button.tsx` keeps PascalCase and `variant?: 'primary' | 'secondary' | 'danger'`; internal implementation uses `base-button.tsx` and CVA. Matches existing “wrapper over Shadcn-style primitive” approach.
- **Imports:** Mix of `@/components/ui/…` and `../ui/…` (e.g. WagerInput uses `../ui/Button`). Not wrong; consider standardizing on `@/` for consistency with login and game page.
- **Quotes:** New Shadcn-style files use double quotes; existing files often use single quotes. Cosmetic only; no functional impact.

### Minor style suggestions

- **Button ref:** `Button.tsx` does not use `forwardRef`, so a ref passed to `<Button ref={...}>` is not forwarded to the underlying DOM button. If any parent needs to focus or measure the button, consider wrapping with `forwardRef` and passing the ref to `BaseButton`.
- **CardTitle semantics:** Dashboard sections use `<CardTitle className="...">`; the Shadcn card component renders `CardTitle` as a `div`. For accessibility, consider using an appropriate heading level (e.g. `CardTitle asChild` with an `h2`) where each card is a section. Optional.

---

## 6. Theme and SCSS sync

- **globals.css** `:root` and **\_variables.scss** are documented as aligned in REFACTOR.md and in a comment in `globals.css`. Values (e.g. primary blue, destructive red) match. There is no single programmatic source of truth; the plan allowed “documenting and manually keeping” in sync, which is satisfied.
- **DashboardSection.scss** still uses `$color-border-section`, `$color-primary-translucent`, etc., and is applied via `className` on `Card`; no conflict with Shadcn tokens.

---

## 7. Tests

- **WagerInput:** Tests use `getByLabelText(/wager/i)` and `getByRole('button', { name: /submit/i })`. The Shadcn `Label` (htmlFor) and `Input` (id) are correctly associated; the submit button is still a button with “Submit” text. No test changes required for the Shadcn swap; behavior is unchanged.

---

## Summary

| Area              | Status | Notes                                                                 |
|-------------------|--------|-----------------------------------------------------------------------|
| Plan implemented  | OK     | Phases 1–3 and REFACTOR.md match plan; base-button vs CLI is fine.    |
| Bugs              | 1      | Use ErrorDisplay in game PENDING state instead of raw red div.        |
| Data alignment    | OK     | No snake_case/camelCase or nesting issues.                           |
| Over-engineering  | OK     | File sizes and structure are reasonable.                              |
| Style / consistency | OK   | Minor: Button ref forwarding, CardTitle a11y, import path style.     |
| Theme / SCSS      | OK     | Documented sync; DashboardSection overrides are appropriate.         |
| Tests             | OK     | WagerInput tests remain valid.                                       |

**Recommendation:** Fix the PENDING-state error block to use `ErrorDisplay` for consistency and to keep error UI on Shadcn Alert. Other items are optional improvements.
