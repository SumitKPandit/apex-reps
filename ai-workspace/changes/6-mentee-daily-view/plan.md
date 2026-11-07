# Plan — Issue #6: Mentee Daily View (Story 4)

**Status: Done** — All 6 tasks complete, QA passed, code review approved.

**Goal:** Complete the mentee-facing daily diet plan tracking page so a mentee can view today's plan, see progress bars, check off meals, navigate dates, and save notes — with a mobile bottom nav and native date picker.

## Status at Planning Time

Issue #6 is **substantially implemented** already:

- `app/pages/diet-plan.vue` — full page with progress bars, meal cards with checkboxes, notes section, prev/today/next date navigation
- `app/stores/dietPlan.ts` — mentee actions: `fetchPlanForDate`, `fetchLogs`, `fetchNotes`, `toggleConsumed`, `saveNotes`, `clearPlan`
- `tests/unit/dietPlanStore.test.ts` — thorough unit tests for mentee + coach store actions

**Still missing (per issue acceptance criteria):**

1. Bottom nav tab (currently Diet Plan link only in desktop header)
2. Date picker at top (currently only ← / Today / → buttons)
3. Collapsible meal cards (currently static cards)
4. Component-level tests for the page (store tests exist; page tests don't)
5. Test scripts in package.json (vitest config exists but no `test:unit`/`test:integration` scripts)

## Acceptance Criteria (from issue)

- Mentee sees today's plan with progress bars at `0 / planned`
- Checking items fills progress bars incrementally in real-time
- Navigating to previous date shows that day's plan and consumption logs
- Notes persist on reload
- Mobile-first: collapsible meals, sticky progress bars, touch-friendly checkboxes

## Codebase Investigation

| Pattern / Location                                                                  | Reuse For                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| `app/stores/dietPlan.ts` — `toggleConsumed` (upsert + optimistic local state)       | Already implemented; no change needed             |
| `app/stores/dietPlan.ts` — `fetchPlanForDate`, `fetchLogs`, `fetchNotes`            | Already implemented; no change needed             |
| `app/layouts/default.vue` — desktop header nav with Diet Plan link                  | Reference for bottom nav link styling             |
| `app/pages/diet-plan.vue` — existing page structure                                 | Enhance in place (date picker, collapsible meals) |
| `vitest.config.ts` — vitest + jsdom, `tests/**/*.test.ts`                           | Component test pattern                            |
| `tests/unit/dietPlanStore.test.ts` — store mock pattern (`createChain`, `mockFrom`) | Reference for mocking Supabase in component test  |

## Test Plan (test-first per AGENTS.md)

| Test Type   | Scope                                                                                     | File                              |
| ----------- | ----------------------------------------------------------------------------------------- | --------------------------------- |
| Unit        | diet-plan page renders progress bars, meal items, checkboxes toggle, notes save, date nav | `tests/unit/dietPlanPage.test.ts` |
| Integration | None needed — store integration already covered by `dietPlanStore.test.ts`                | —                                 |

## Tasks (Ordered)

### Task 1: Add vitest test scripts to package.json

**Type:** config  
**Depends on:** none  
**Gate level:** strict  
**Description:** Add `test:unit` and `test:integration` scripts so `pnpm test:unit --run` and `pnpm test:integration --run` work (per AGENTS.md Quality Gates).  
**Files:** `package.json`  
**Test first:** n/a (config)  
**Verification:** `pnpm test:unit --run` and `pnpm test:integration --run` execute without error  
**Rollback:** Remove the two script lines from package.json

### Task 2: Write component test for diet-plan page

**Type:** test  
**Depends on:** Task 1  
**Gate level:** standard  
**Description:** Vitest + @vue/test-utils component test rendering `app/pages/diet-plan.vue`. Covers: progress bars show consumed/planned, checkbox toggles consumed state, notes textarea saves, date navigation changes selected date, empty state when no plan. Mocks `useDietPlanStore`, `useAuthStore`, `useProfileStore`.  
**Files:** `tests/unit/dietPlanPage.test.ts` (create)  
**Test first:** Write test before implementing Tasks 3–5? No — page already renders. Test validates existing + new behavior.  
**Verification:** `pnpm test:unit --run` passes including new test file  
**Rollback:** Delete `tests/unit/dietPlanPage.test.ts`

### Task 3: Add mobile-only bottom nav with 3 tabs (Dashboard, Check-in, Diet Plan)

**Type:** component  
**Depends on:** Task 1  
**Gate level:** standard  
**Description:** Create a bottom navigation bar component shown ONLY on mobile viewport sizes (hidden on desktop). Tabs: Dashboard (`/`), Check-in (`/check-in`), Diet Plan (`/diet-plan`). Active tab highlighted. On desktop, the existing top header nav remains (Diet Plan link for mentees). Bottom nav follows mobile-first pattern — top nav for large screens, bottom nav for mobile.  
**Files:** `app/components/BottomNav.vue` (create), `app/layouts/default.vue` (modify — add BottomNav with mobile-only visibility; keep desktop top nav)  
**Test first:** Unit test in `tests/unit/dietPlanPage.test.ts` can assert nav renders; or separate `tests/unit/BottomNav.test.ts`  
**Verification:** Bottom nav visible on mobile viewport, hidden on desktop, correct tab active, click navigates  
**Rollback:** Remove BottomNav import and component from layout

### Task 4: Add native HTML5 date picker to diet-plan page

**Type:** component  
**Depends on:** Task 1  
**Gate level:** standard  
**Description:** Replace/enhance ← / Today / → with `<input type="date">` bound to `selectedDate`. Default: today. Constrained to plan's `start_date`–`end_date` range (min/max attributes). Keep Today button as shortcut.  
**Files:** `app/pages/diet-plan.vue` (modify template + script)  
**Test first:** Assert in `tests/unit/dietPlanPage.test.ts` that date input exists and changing it updates selectedDate  
**Verification:** Date picker opens calendar on mobile, selecting a date loads that day's plan  
**Rollback:** Revert to ← / Today / → buttons

### Task 5: Make meal cards collapsible

**Type:** component  
**Depends on:** Task 1  
**Gate level:** standard  
**Description:** Each meal card has a toggle (chevron) to expand/collapse its food item list. Default expanded on desktop, collapsible on mobile. Simple Vue transition (`v-show` + CSS slide).  
**Files:** `app/pages/diet-plan.vue` (modify meal card template)  
**Test first:** Assert in `tests/unit/dietPlanPage.test.ts` that meal items can be collapsed/expanded  
**Verification:** Clicking meal header toggles visibility of food items  
**Rollback:** Revert to always-expanded meal cards

### Task 6: Run all quality gates and verify no regressions

**Type:** verification  
**Depends on:** Tasks 2, 3, 4, 5  
**Gate level:** light  
**Description:** Run `pnpm typecheck`, `pnpm lint`, `pnpm test:unit --run`. Confirm existing tests still pass and no new errors introduced.  
**Files:** none  
**Verification:** All gates pass  
**Rollback:** git stash / revert the task branch

## Risks & Rollback

| Risk                                          | Likelihood | Impact | Mitigation                                                         | Rollback                     |
| --------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------ | ---------------------------- |
| Bottom nav breaks desktop layout              | Low        | Medium | Hide on desktop via Tailwind `hidden`/`md:flex`                    | Remove component from layout |
| Date picker conflicts with existing prev/next | Low        | Low    | Keep buttons as fallback; date input drives `selectedDate` watcher | Revert template changes      |
| Collapsible meals cause layout shift          | Low        | Low    | Use CSS transition with fixed height or `v-show`                   | Revert to static cards       |

## Outputs

- `package.json` — test scripts added
- `tests/unit/dietPlanPage.test.ts` — component test (create)
- `app/components/BottomNav.vue` — bottom nav component (create)
- `app/layouts/default.vue` — add BottomNav, responsive nav links
- `app/pages/diet-plan.vue` — date picker + collapsible meals
