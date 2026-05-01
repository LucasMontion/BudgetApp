# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build
npm run lint      # Run ESLint
npm run preview   # Preview production build
```

No test suite is configured.

## Architecture

React 19 + Vite SPA with Supabase (PostgreSQL + Auth) as the backend. No routing library — screen navigation is managed via a `screen` state string in `App.jsx`. No TypeScript; `.jsx`/`.js` files throughout.

### Key files

- **`src/App.jsx`** — Root component. Owns all UI state: `screen`, `activeBudgetId`, `activeSection`, dark mode, period offset, modal open/close. All screen transitions happen here.
- **`src/hooks/useBudgets.js`** — The single source of truth for budget data. Manages in-memory state, localStorage persistence, and Supabase cloud sync. All CRUD (budgets, transactions, cards, card payments) flows through this hook.
- **`src/contexts/AuthContext.jsx`** — Supabase auth session state, exposed via `useAuth()`.
- **`src/lib/supabase.js`** — Supabase client (reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from env).
- **`src/themes.js`** — Theme color palettes. Custom themes use a `custom_#RRGGBB` ID convention.

### Data persistence

Local-first, cloud-synced:

- **Guest users**: data in `localStorage` key `budgets_v1`; max 3 budgets.
- **Authenticated users**: full JSON blob upserted to `user_budgets` table in Supabase; max 5 budgets.
- On login, if both local and cloud data exist, an `ImportConflictModal` lets the user choose merge/cloud/local.
- Every state change triggers a `useEffect` that either writes to localStorage or calls `cloudSave()`.

### Core data model

```js
// Budget
{ id, type, name, themeId, sections, transactions, cards, cardPayments,
  recurrent, recurrence, recurrenceDays, recurrenceStart, createdAt, trackCards }

// sections — keyed object, e.g. sections.income.items[]
// transactions[] — { id, sectionKey, subcategoryName, amount, memo, date, cardId? }
// cards[]        — { id, name, limit, cycleStartDay, cycleDays?, color }
// cardPayments[] — { id, cardId, amount, date, memo }
```

### Period logic

`getPeriodBounds()` in `useBudgets.js` computes date ranges for recurrent budgets:
- **Weekly**: Monday–Sunday
- **Biweekly**: 14-day cycles anchored to 2024-01-01 (a known Monday)
- **Monthly/quarterly/yearly**: calendar-based
- `periodOffset` (integer in App state) navigates past/future periods.

### Environment

Copy `.env.example` to `.env` and fill in Supabase credentials:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
