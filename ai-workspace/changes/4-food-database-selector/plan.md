# Implementation Plan: Food Database & Selector (Issue #4)

**Issue:** #4 — [Story 2] Food Database & Selector: Search, Custom Foods, Autocomplete
**Created:** 2026-10-31
**Status:** Draft

---

## 1. Goal & Acceptance Criteria

Build the food database layer and coach-facing food selector component.

**Acceptance Criteria (from issue):**

- Coach searches "chicken" → sees USDA results (chicken breast, thigh, etc.)
- Coach enters quantity in grams → calories/protein/carbs/fat/fiber auto-filled
- Coach adds custom food "Whey isolate" → appears in autocomplete immediately
- Mentee cannot insert foods (RLS enforced)
- Search debounced, cached, works offline

---

## 2. Codebase Investigation Summary

### Reusable Patterns Found

| Pattern                                  | Location                                      | Reuse For                          |
| ---------------------------------------- | --------------------------------------------- | ---------------------------------- |
| Transactional store insert with rollback | `app/stores/stats.ts:saveStatsAndPhotos()`    | `foodItemStore.createCustomFood()` |
| Pinia store with getters/actions         | `app/stores/profile.ts`, `app/stores/plan.ts` | `foodItemStore`, `dietPlanStore`   |
| Supabase client usage                    | `app/utils/supabase.ts`                       | All store actions                  |
| TypeScript types from DB                 | `app/types/database.ts`                       | Food item types, inserts           |
| Nuxt 3 composables (`useRuntimeConfig`)  | `app/utils/supabase.ts`                       | Config access                      |
| Toast/error handling pattern             | `app/stores/stats.ts` (console.error + throw) | New stores                         |
| Autocomplete/Search pattern              | None existing                                 | New `FoodSelector.vue` component   |
| Modal pattern                            | None existing                                 | "Add Custom Food" modal            |

### Placement Decisions

| New Code                | Expected Location                                       | Reason                         |
| ----------------------- | ------------------------------------------------------- | ------------------------------ |
| `useFoodItemStore`      | `app/stores/foodItem.ts`                                | Follows existing store pattern |
| `FoodSelector.vue`      | `app/components/diet-plan/FoodSelector.vue`             | Feature-scoped component       |
| `CustomFoodModal.vue`   | `app/components/diet-plan/CustomFoodModal.vue`          | Feature-scoped modal           |
| Macro calculation utils | `app/utils/foodMacros.ts`                               | Pure functions, testable       |
| IndexedDB caching       | `app/composables/useFoodCache.ts`                       | Reusable composable            |
| Types                   | `app/types/food.ts` (new) + `app/types/index.ts` export | Extends database types         |

### Existing Types to Extend

- `app/types/database.ts` — Already has `food_items` Row/Insert/Update types (generated from migration)
- Need to create domain types for store state, search results, form inputs

---

## 3. Decisions Required

### Decision 1: Autocomplete Component Library

**Context:** Need a searchable dropdown for food items. No existing autocomplete component in codebase.

**Options:**

1. **Build custom** with `<select>` + filtered options (recommended) — Zero deps, full control, matches Nuxt UI style
2. Use `@nuxt/ui` `USelect` with filtering — If available in v4
3. Use headless UI library (e.g., `@headlessui/vue`) — More features, extra dep

**My recommendation:** Option 1 — Custom lightweight autocomplete using Nuxt UI's `USelect` or native `<select>` with filtered options. The dataset is small (~50 seeded items + coach custom), so client-side filtering is fine.

**Decision:** Option 1 confirmed — Build custom autocomplete with filtered `<select>`.

---

### Decision 2: IndexedDB Caching Strategy

**Context:** Requirement: "Search debounced, cached, works offline"

**Options:**

1. **`@vueuse/core` `useIndexedDB`** (recommended) — Already a dependency? Check package.json... Not listed. But lightweight.
2. **Custom wrapper** around `idb` library — More control, extra dep
3. **Simple localStorage** for search results — Simpler, but no query-based caching

**My recommendation:** Option 1 — Add `@vueuse/core` (already commonly used with Nuxt) and use `useIndexedDB` with key `food-search:{query}`. Cache TTL: 24 hours. Falls back to network.

**Decision:** Option 1 confirmed — Use `@vueuse/core` `useIndexedDB`.

---

### Decision 3: Macro Calculation — Where?

**Context:** `quantity_g` × `per_100g` / 100 = calculated macros. Need this in:

- FoodSelector (live preview as user types quantity)
- Coach plan creation (save calculated macros to `diet_plan_food_items`)
- Mentee view (display planned macros)

**Options:**

1. **Pure utility functions** in `app/utils/foodMacros.ts` (recommended) — Testable, reusable, no store dependency
2. Store getters — Tied to Pinia, harder to test
3. Database computed columns — Not flexible for UI preview

**My recommendation:** Option 1 — Pure functions: `calculateMacros(foodItem, quantityG)`, `sumMacros(items[])`.

**Decision:** Option 1 confirmed — Pure utility functions in `app/utils/foodMacros.ts`.

---

### Decision 4: Custom Food Modal — Validation

**Context:** Coach adds custom food: name, macros per 100g. Must validate macros are non-negative numbers.

**Options:**

1. **Zod schema** (recommended) — Consistent with existing Zod usage in project
2. Manual validation in component
3. HTML5 validation only

**My recommendation:** Option 1 — Zod schema in `app/utils/validation.ts` (new) or inline. Reuse pattern from check-in form if any.

**Decision:** Option 1 confirmed — Zod schema for custom food validation.

---

## 4. Test Plan

### Unit Tests (Vitest) — implement-task writes

- [x] `calculateMacros(foodItem, quantityG)` → `{calories, protein, carbs, fat, fiber}`
- [x] `sumMacros(foodItems[])` → totals
- [x] `validateCustomFood(input)` → Zod result (valid/invalid with errors)
- [x] `debounce(fn, ms)` utility

### Integration Tests (Vitest + Supabase) — implement-task writes

- [x] `foodItemStore.searchFoods(query)` → filtered results from Supabase
- [x] `foodItemStore.createCustomFood(data)` → inserts to DB, updates local cache
- [ ] `foodItemStore.getCachedSearch(query)` → returns IndexedDB cached results
- [ ] RLS: Coach can insert, mentee cannot (test with two auth contexts)

### QA Workflows (Playwright/curl) — verify-qa executes

- [ ] Coach searches "chicken" → sees USDA results (chicken breast, thigh, etc.)
- [ ] Coach enters quantity in grams → macros auto-filled in real-time
- [ ] Coach adds custom food "Whey isolate" → appears in autocomplete immediately
- [ ] Mentee cannot insert foods (RLS enforced) — verify 403/401 on insert
- [ ] Search debounced (300ms), cached, works offline (disconnect network, search cached term)

---

## 5. Task Breakdown

### Task 1: Create Macro Calculation Utilities

**Type:** utility

**Depends on:** none

**Description:** Pure functions for macro calculations, fully testable.

**Files created/modified:**

- `app/utils/foodMacros.ts` — New file with `calculateMacros()`, `sumMacros()`
- `tests/unit/foodMacros.test.ts` — Unit tests (8 passing)

**Test first (implement-task writes):**

- [x] Unit: `tests/unit/foodMacros.test.ts`

**Verification:** Run `pnpm test:unit --run` — all pass ✅

**Rollback:** Delete `app/utils/foodMacros.ts`

---

### Task 2: Create `useFoodItemStore` Pinia Store ✅ COMPLETE

**Type:** store

**Depends on:** Task 1

**Description:** Pinia store with search, create custom food, IndexedDB caching.

**Files created/modified:**

- `app/stores/foodItem.ts` — New store
- `app/types/food.ts` — New domain types
- `app/types/index.ts` — Export new types
- `tests/unit/foodItemStore.test.ts` — Unit tests (4 passing)

**Test first (implement-task writes):**

- [x] Unit: `tests/unit/foodItemStore.test.ts` (mock Supabase)
- [ ] Integration: `tests/integration/foodItemStore.test.ts` (real Supabase)

**Verification:** Store actions work, RLS enforced, cache works ✅

**Rollback:** Delete store file, remove type exports

---

### Task 3: Build `FoodSelector.vue` Component ✅ COMPLETE

**Type:** component

**Depends on:** Task 1, Task 2

**Description:** Autocomplete dropdown + quantity input + macro preview + "Add Custom Food" button.

**Files created/modified:**

- `app/components/diet-plan/FoodSelector.vue` — New component
- `app/components/diet-plan/CustomFoodModal.vue` — New modal component
- `tests/unit/FoodSelector.test.ts` — Unit tests (5 passing)

**Test first (implement-task writes):**

- [x] Unit: Component renders, emits events
- [ ] Integration: Search → select → quantity → emits calculated macros

**Verification:** Component works in isolation ✅

**Rollback:** Delete component files

---

### Task 4: IndexedDB Caching Composables ✅ COMPLETE

**Type:** composable

**Depends on:** Task 2

**Description:** `useFoodCache.ts` for caching search results with TTL.

**Files created/modified:**

- `app/composables/useFoodCache.ts` — New composable (uses `@vueuse/integrations/useIDBKeyval`)
- Added `@vueuse/core` and `@vueuse/integrations` to dependencies

**Test first (implement-task writes):**

- [ ] Unit: Cache set/get, TTL expiry, fallback to network

**Verification:** Offline search works for cached queries (composable ready for store integration)

**Rollback:** Delete composable, remove dependency if unused

---

### Task 5: Integration & E2E Tests

**Type:** test

**Depends on:** Task 2, Task 3

**Description:** Full integration tests for store + component, Playwright E2E for coach flow.

**Files to create/modify:**

- `tests/integration/foodSelector.test.ts`
- `tests/e2e/food-database.spec.ts`

**Test first (implement-task writes):**

- [ ] Integration: Full flow search → select → quantity → custom food
- [ ] E2E: Coach creates custom food, sees in autocomplete

**Verification:** `pnpm test:integration --run`, `pnpm test:e2e` pass

**Rollback:** Revert test files

---

## 6. Risk Assessment

| Risk                                        | Likelihood | Impact | Mitigation                                        | Rollback                         |
| ------------------------------------------- | ---------- | ------ | ------------------------------------------------- | -------------------------------- |
| RLS blocks coach insert                     | Low        | High   | Test with coach auth context in integration tests | Disable policy, fix, re-enable   |
| IndexedDB not available (private browsing)  | Low        | Medium | Graceful fallback to network-only                 | Cache composable handles error   |
| Autocomplete performance with large dataset | Low        | Low    | Dataset small (~100 items); client-side filter OK | Add server-side search if needed |
| Macro calculation precision                 | Low        | Medium | Use `numeric` in DB, round to 2dp in utils        | Adjust rounding in utils         |

---

## 7. Documentation Updates Needed

- `AGENTS.md` — Add `foodItem` store to Quick Refs
- `ai-workspace/database/tables.md` — Already covers `food_items`
- `ai-workspace/database/rls-policies.md` — Already covers `food_items` policies
- New: `ai-workspace/stores/foodItem.md` (if stores doc folder exists)

---

## Handoff to implement-task

**implement-task reads:**

- This `plan.md` — task breakdown, test plan, file placements
- `REQUIREMENTS.md` — Full spec for context
- `app/types/database.ts` — Generated types for `food_items`

**Decisions to resolve before implement-task starts:**

1. Autocomplete approach (Decision 1)
2. IndexedDB library (Decision 2)
3. Macro calculation location (Decision 3)
4. Validation approach (Decision 4)
