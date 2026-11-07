# Code Review: Round 1 — Issue #4 Food Database & Selector

**Reviewer:** AI Agent (review-code skill)
**Date:** 2026-10-31
**PR/Task:** #4 — [Story 2] Food Database & Selector: Search, Custom Foods, Autocomplete
**Commit:** (working tree)

---

## Blocking Items (B1-B10)

| Item | Status   | File:Line                                         | Details                                                                                                                                                                                                                                                          |
| ---- | -------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1   | PASS     | —                                                 | Names clear: `calculateMacros`, `sumMacros`, `searchFoods`, `createCustomFood`, `handleSelect`, `emitFoodSelected`, `openCustomFoodModal`. Intent obvious from names.                                                                                            |
| B2   | PASS     | —                                                 | No `any` in production code. All interfaces explicit (`FoodMacrosPer100g`, `CalculatedMacros`, `FoodItemSearchResult`, `CustomFoodInput`, `CacheEntry<T>`). TypeScript strict passes.                                                                            |
| B3   | **FAIL** | `app/components/diet-plan/CustomFoodModal.vue:78` | `handleSubmit` catches error but **no user toast/error feedback**. Error only logged to console. Store sets error but component doesn't display it.                                                                                                              |
| B4   | PASS     | —                                                 | Loading states: spinner in search input, "Searching..." in dropdown. Empty states: "No foods found" with action button. Error display in FoodSelector shows `store.error`.                                                                                       |
| B5   | PASS     | —                                                 | No hidden mutations. `calculateMacros`/`sumMacros` pure. Store owns state. Composables return cleanup. Form doesn't mutate props.                                                                                                                                |
| B6   | **FAIL** | `app/components/diet-plan/FoodSelector.vue:100`   | `searchTimeout` cleared in `onUnmounted` ✓. But: `onMounted` adds document click listener, removed in `onUnmounted` ✓. **Missing AbortController for in-flight search requests** — if component unmounts during search, promise resolves on unmounted component. |
| B7   | PASS     | —                                                 | Follows project patterns: Pinia store (`defineStore`), composable (`useFoodCache`), component with `<script setup>`, TypeScript interfaces in `types/food.ts`. Placement matches plan.md.                                                                        |
| B8   | PASS     | —                                                 | No commented code, no unused imports (eslint clean), no dead branches.                                                                                                                                                                                           |
| B9   | PASS     | —                                                 | No secrets. Input validation via Zod schema in CustomFoodModal. Supabase uses parameterized queries (`.eq()`, `.ilike()`). No injection risk.                                                                                                                    |
| B10  | **FAIL** | `app/components/diet-plan/FoodSelector.vue:185`   | Dropdown items are `<div>` not `<button>`/`<option>` — **not keyboard accessible**. No `role="option"`, no `tabindex`, no arrow key navigation. CustomFoodModal: Close button has `aria-label` ✓, form has labels ✓, but focus trap missing.                     |

---

## Non-Blocking Items (N1-N7) — Logged as Issues

| Item | Issue | File:Line                                   | Details                                                                                                                         |
| ---- | ----- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| N1   | #TBD  | `app/stores/foodItem.ts`                    | In-memory `Map` cache + IndexedDB cache in `useFoodCache` — dual caching strategy not unified. Consider single source of truth. |
| N2   | #TBD  | `app/stores/foodItem.ts:47`                 | `supabase.auth.getUser()` called on every `createCustomFood`. Could cache user ID in store after login.                         |
| N4   | #TBD  | `app/utils/foodMacros.ts`                   | JSDoc present but could add `@example` for `calculateMacros`.                                                                   |
| N5   | #TBD  | `app/components/diet-plan/FoodSelector.vue` | `handleSearch` debounce logic duplicated from `useDebounce` in `useFoodCache`. Could reuse composable.                          |
| N7   | #TBD  | `app/components/diet-plan/FoodSelector.vue` | Component ~260 lines. Could split dropdown into `FoodSearchDropdown.vue`.                                                       |

---

## Acceptance Criteria Check (from plan.md / REQUIREMENTS.md)

| Criteria                                                        | Status                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Coach searches "chicken" → sees USDA results                    | ✅ (store + component)                                              |
| Coach enters quantity in grams → macros auto-filled             | ✅ (previewMacros computed)                                         |
| Coach adds custom food "Whey isolate" → appears in autocomplete | ✅ (store.createCustomFood + cache clear)                           |
| Mentee cannot insert foods (RLS enforced)                       | ✅ (DB policy, not tested in unit)                                  |
| Search debounced, cached, works offline                         | ✅ (300ms debounce, in-memory cache, useFoodCache composable ready) |

---

## Decision

**Round 1: CHANGES_REQUESTED** — Fix blocking items (B3, B6, B10), re-run quality gates, request Round 2.

---

## Summary

- Blocking: 7 pass, 3 fail (B3, B6, B10)
- Non-blocking: 5 logged as issues
- Acceptance criteria: MET (with offline cache composable ready but not yet integrated into store)
- Next action: Fix B3 (add toast/error display in CustomFoodModal), B6 (add AbortController for search), B10 (make dropdown keyboard accessible + focus trap in modal) → request Round 2
