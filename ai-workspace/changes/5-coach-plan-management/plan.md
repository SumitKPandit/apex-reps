# Plan: Coach Plan Management (Story 3) — **DONE**

**Issue:** #5 — [Story 3] Coach Plan Management: List, Create, Edit Diet Plans  
**Goal:** Enable coaches to list, create, and edit diet plans for their mentees with meal-level macro tracking.

---

## Acceptance Criteria (from Issue)

- Coach sees list of all mentees and their plans
- Coach creates full day plan: 3 meals + 2 snacks with multiple items each
- Macros calculate correctly per meal and daily total
- Edit plan modifies existing data correctly
- Data persists after page reload

---

## Codebase Investigation

### Reusable Patterns Found

| Pattern                          | Location                                                   | Reuse For                  |
| -------------------------------- | ---------------------------------------------------------- | -------------------------- |
| Transactional multi-table insert | `app/stores/stats.ts` (`insertStat`)                       | `dietPlanStore.createPlan` |
| Pinia store with Supabase        | `app/stores/foodItem.ts`, `app/stores/dietPlan.ts`         | Coach CRUD actions         |
| Autocomplete food search         | `app/components/diet-plan/FoodSelector.vue`                | Meal builder               |
| Custom food creation             | `app/components/diet-plan/CustomFoodModal.vue`             | Meal builder               |
| Macro calculation                | `app/utils/foodMacros.ts` (`calculateMacros`, `sumMacros`) | Meal totals                |
| Zod validation + toast           | `app/components/diet-plan/CustomFoodModal.vue`             | Plan form validation       |
| Role-based routing guard         | `app/middleware/auth.global.ts`, pages                     | Coach-only pages           |

### Existing Types to Extend

- `app/types/dietPlan.ts` — Already has `DietPlanWithMeals`, `DietPlanMeal`, `DietPlanFoodItem`
- `app/types/database.ts` — Supabase-generated types for all diet_plan tables
- `app/types/food.ts` — `FoodItemSearchResult`, `CustomFoodInput`

### Placement Decisions

| New Code               | Expected Location                          | Reason                                                                |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Coach CRUD actions     | `app/stores/dietPlan.ts`                   | Extends existing store (follows statsStore pattern)                   |
| Mentee fetching        | `app/stores/profile.ts` or new `coach.ts`  | Profile store already fetches profile; new action for coach's mentees |
| Create plan page       | `app/pages/coach/diet-plans/new.vue`       | Already exists, needs backend integration                             |
| Edit plan page         | `app/pages/coach/diet-plans/[id]/edit.vue` | New file                                                              |
| List page enhancements | `app/pages/coach/diet-plans.vue`           | Already exists, needs real data                                       |

---

## Decisions Needed (Resolved in decisions.md)

| ID  | Decision                                                                      | Status                                                            |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Mentee list source: profiles with role='mentee' AND coach_id = current user   | Resolved                                                          |
| 2   | Plan list view: group by mentee or flat list?                                 | Resolved: Group by mentee                                         |
| 3   | Edit page: separate route `/coach/diet-plans/:id/edit`                        | Resolved                                                          |
| 4   | Meal ordering: `display_order` managed by drag-drop or fixed order?           | Resolved: Fixed order (Breakfast=0, Lunch=1, Dinner=2, Snacks=3+) |
| 5   | Unique constraint (mentee_id, start_date): client-side check or server error? | Resolved: Client-side warning + server error handling             |
| 6   | Coach notes field: include in create/edit?                                    | Resolved: Yes, optional textarea                                  |
| 7   | Validation: Zod schema for plan form                                          | Resolved: Yes                                                     |

---

## Test Plan

### Unit Tests (Vitest) — implement-task writes

- [ ] `calculateMacros(food, quantityG)` → correct scaled macros
- [ ] `sumMacros(items[])` → correct totals
- [ ] Plan form Zod schema: validates required fields, rejects invalid dates
- [ ] Meal totals: `getMealTotalMacros(meal)` matches `sumMacros`

### Integration Tests (Vitest + Supabase) — implement-task writes

- [ ] `dietPlanStore.fetchMentees()` → returns coach's mentees
- [ ] `dietPlanStore.fetchCoachPlans()` → returns plans with meals + items
- [ ] `dietPlanStore.createPlan(data)` → inserts diet_plan + meals + food_items transactionally
- [ ] `dietPlanStore.updatePlan(id, data)` → updates plan, replaces meals/items
- [ ] `dietPlanStore.deletePlan(id)` → cascades deletes meals + food_items
- [ ] RLS: coach can CRUD own mentees' plans, mentee can only read

### QA Workflows (Playwright) — verify-qa executes

- [ ] Coach logs in → sees `/coach/diet-plans` with mentee list + plans
- [ ] Coach clicks "Create New Plan" → fills form, adds meals/items via FoodSelector → saves → appears in list
- [ ] Coach clicks "Edit" on existing plan → modifies meals/items → saves → changes persist
- [ ] Coach creates plan with overlapping date for same mentee → shows error
- [ ] Mentee logs in → can view assigned plan on `/diet-plan` (existing page)

---

## Tasks (Ordered by Dependency)

### Task 1: Extend dietPlanStore with Coach CRUD Actions

**Type:** store  
**Depends on:** none  
**Gate Level:** strict

**Description:** Add coach-facing actions to existing `useDietPlanStore`: `fetchMentees`, `fetchCoachPlans`, `createPlan`, `updatePlan`, `deletePlan`. Transactional insert for plan + meals + food_items (mirrors `statsStore.insertStat`).

**Files to create/modify:**

- `app/stores/dietPlan.ts` — Add actions, types for coach plan summary

**Test first:**

- [ ] Unit: `createPlan` input validation
- [ ] Integration: `createPlan` inserts 3 tables atomically
- [ ] Integration: `fetchCoachPlans` returns correct structure
- [ ] Integration: `updatePlan` replaces meals/items correctly
- [ ] Integration: `deletePlan` cascades

**Verification:** Run integration tests against local Supabase; verify rows in `diet_plans`, `diet_plan_meals`, `diet_plan_food_items`.

**Rollback:** Revert store changes; no migration needed.

---

### Task 2: Enhance List Page (`/coach/diet-plans.vue`)

**Type:** page  
**Depends on:** Task 1  
**Gate Level:** standard

**Description:** Replace mock data with real `fetchMentees` + `fetchCoachPlans`. Show mentees grouped with their plans. Each plan shows: name, date range, status badge (active/upcoming/expired), actions (View, Edit). "Create New Plan" button navigates to `/coach/diet-plans/new`.

**Files to create/modify:**

- `app/pages/coach/diet-plans.vue` — Replace mock with store calls, add plan list rendering

**Test first:**

- [ ] Integration: Page loads mentees + plans from store
- [ ] Unit: Status badge logic (active/upcoming/expired based on date)

**Verification:** Manual check in browser; coach sees real data.

**Rollback:** Revert page changes.

---

### Task 3: Create Plan Page — Backend Integration (`/coach/diet-plans/new.vue`)

**Type:** page  
**Depends on:** Task 1  
**Gate Level:** strict

**Description:** Replace mock save with `dietPlanStore.createPlan`. Add Zod validation schema for plan form. Connect FoodSelector to meal builder (already wired). Meal macros display using `sumMacros`. On success, redirect to list with toast.

**Files to create/modify:**

- `app/pages/coach/diet-plans/new.vue` — Replace mock save, add validation, toast

**Test first:**

- [ ] Unit: Zod schema validates required fields, date logic
- [ ] Integration: Submit creates plan + meals + items in DB
- [ ] Integration: Meal macros display correctly

**Verification:** Create plan in browser; verify in Supabase dashboard.

**Rollback:** Revert page changes.

---

### Task 4: Edit Plan Page (`/coach/diet-plans/[id]/edit.vue`)

**Type:** page  
**Depends on:** Task 1, Task 3  
**Gate Level:** standard

**Description:** New page. Fetch plan with meals/items via `dietPlanStore.fetchPlanForEdit(id)` (new action). Pre-populate form. Same meal builder as create. On save, call `updatePlan` (delete old meals/items, insert new). On delete, call `deletePlan` with confirmation.

**Files to create/modify:**

- `app/pages/coach/diet-plans/[id]/edit.vue` — New file
- `app/stores/dietPlan.ts` — Add `fetchPlanForEdit` action

**Test first:**

- [ ] Integration: `fetchPlanForEdit` loads full plan structure
- [ ] Integration: `updatePlan` replaces meals/items correctly
- [ ] Integration: `deletePlan` removes plan + cascades

**Verification:** Edit existing plan in browser; verify changes persist.

**Rollback:** Delete page file; revert store changes.

---

### Task 5: Add Coach Mentee Fetching to Profile Store (or new store)

**Type:** store  
**Depends on:** Task 1  
**Gate Level:** light

**Description:** Add `fetchMyMentees()` to `useProfileStore` (or create `useCoachStore`). Query `profiles` where `role = 'mentee'` AND `coach_id = auth.uid()`. Used by create/edit pages for mentee dropdown.

**Files to create/modify:**

- `app/stores/profile.ts` — Add `fetchMyMentees` action

**Test first:**

- [ ] Integration: Returns only coach's mentees

**Verification:** Mentee dropdown shows correct names.

**Rollback:** Revert store changes.

---

### Task 6: Unit Tests for Macro Utilities

**Type:** test  
**Depends on:** none  
**Gate Level:** strict

**Description:** Add Vitest unit tests for `calculateMacros` and `sumMacros` in `app/utils/foodMacros.ts`.

**Files to create/modify:**

- `tests/unit/foodMacros.spec.ts` — New file

**Test first:**

- [ ] `calculateMacros` scales correctly for various quantities
- [ ] `calculateMacros` throws on quantity <= 0
- [ ] `sumMacros` aggregates multiple items
- [ ] `sumMacros` returns zeros for empty array

**Verification:** `pnpm test:unit --run` passes.

**Rollback:** Delete test file.

---

---

## Risk Assessment & Rollback

| Risk                                     | Likelihood | Impact | Mitigation                                  | Rollback                       |
| ---------------------------------------- | ---------- | ------ | ------------------------------------------- | ------------------------------ |
| RLS blocks coach actions                 | Low        | High   | Test as coach + mentee locally              | Disable policy, fix, re-enable |
| Unique constraint violation              | Medium     | Medium | Client check + server error handling        | Show toast, keep form data     |
| Transactional insert partial failure     | Low        | High   | Use Supabase RPC or sequential with cleanup | Delete orphaned rows manually  |
| FoodSelector not emitting correct macros | Low        | Medium | Already tested in Story 2                   | Debug FoodSelector emit        |

---

## Out of Scope

- Drag-and-drop meal reordering (fixed display_order)
- Bulk plan operations (copy week, template)
- Plan versioning/history
- Coach dashboard analytics
- Mentee plan view (already exists in Story 1/2)
