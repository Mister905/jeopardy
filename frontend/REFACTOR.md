# Shadcn UI Component Mapping

Component mapping for Feature 0017 (Shadcn UI integration). Keep in sync with `docs/features/0017_PLAN.md`.

| Current component | Shadcn counterpart | Status |
|-------------------|--------------------|--------|
| `components/ui/Button.tsx` | `base-button.tsx` (wraps Shadcn-style button) | Replaced – wrapper preserves primary/secondary/danger API |
| `components/ui/ErrorDisplay.tsx` | `Alert` (variant destructive) | Replaced |
| Form inputs (WagerInput, login) | `Input`, `Label` | Replaced |
| Dashboard sections (Summary, Accuracy, Streaks, Wagers) | `Card`, `CardHeader`, `CardTitle`, `CardContent` | Replaced |
| Game detail clue modal | `Dialog`, `DialogContent` | Replaced |
| GameCard | Card (optional) | Not yet – can use Card in a later pass |
| GameBoard / ClueCard | Keep SCSS + Tailwind | No Shadcn replacement – game-specific layout |
| Header, Footer | Keep existing SCSS | No change |
| LoadingSpinner | Keep custom | No Shadcn replacement |

## Migration order (completed)

1. Button  
2. Input / Label (WagerInput, login)  
3. Card (dashboard sections)  
4. Dialog (clue modal)  
5. Alert (ErrorDisplay)

## Theme sync

- `src/app/globals.css` `:root` CSS variables are aligned with `src/styles/_variables.scss` (primary, secondary, destructive, border, etc.).
- Body background is still controlled by `.app-root` in `main.scss` (gradient).
