# Plan: Fix QA Bugs from Issue #5 (Coach Plan Management)

**Issue:** #5 — Coach Plan Management (bugfix follow-up)  
**Goal:** Fix bugs found during verify-qa black-box testing so all acceptance criteria pass end-to-end.

**Status:** Done

---

## Acceptance Criteria (after fix)

1. Mentee can check off a food item → `diet_plan_logs` row saved, progress bars update
2. Coach can create plan with any valid start date (no false unique-constraint errors from pre-existing data)
3. Coach can navigate to Edit page and modify a plan
4. Error toasts display user-friendly messages on save failures

---

## Codebase Investigation

### Bugs Found and Fixed

| ID       | Severity | Location                                   | Root Cause                                                                                                                 | Fix                                                                                 |
| -------- | -------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| BUG-001  | Critical | `app/stores/dietPlan.ts`                   | `toggleConsumed` upserts `macros` column into `diet_plan_logs` — column doesn't exist                                      | Removed `macros` from upsert, select, and interface                                 |
| BUG-001b | Critical | `app/stores/dietPlan.ts:281`               | `fetchLogs` selects `macros` from `diet_plan_logs` — column doesn't exist                                                  | Removed `macros` from select and typedData cast                                     |
| BUG-001c | Critical | `app/stores/dietPlan.ts:44`                | `DietPlanLog` interface declares `macros?: CalculatedMacros` — mismatches schema                                           | Removed `macros` from interface                                                     |
| BUG-005  | Critical | `app/stores/dietPlan.ts`                   | `toggleConsumed` upsert lacks `onConflict`, toggle-off violates unique constraint                                          | Added `{ onConflict: "mentee_id, food_item_id, log_date" }`                         |
| BUG-006  | Critical | `app/utils/supabase.ts`                    | `getSupabase(true)` reads `authStore.user.access_token` which doesn't exist — no Authorization header sent                 | Added `accessToken` to authStore, populated from `supabase.auth.getSession()`       |
| BUG-007  | Critical | `app/pages/coach/diet-plans/[id]/edit.vue` | Auto-save `watch` with `deep: true` fires after initial plan data population, calls `savePlan()` and redirects immediately | Removed auto-save watch — explicit Save button handles saving                       |
| BUG-008  | Critical | `app/pages/coach/diet-plans/[id]/edit.vue` | `loading.value` never set to `false` on profile fetch failure path; redirects to `/` instead of `/coach/diet-plans`        | Added `finally` block with `loading.value = false`, redirect to `/coach/diet-plans` |

---

## Changes Made

### `app/stores/dietPlan.ts`

- Removed `macros?: CalculatedMacros` from `DietPlanLog` interface
- Removed `macros` from `fetchLogs` `.select()` clause
- Removed `macros` from `toggleConsumed` upsert payload and local state update
- Added `{ onConflict: "mentee_id, food_item_id, log_date" }` to `toggleConsumed` upsert, removed `as any` cast

### `app/stores/auth.ts`

- Added `accessToken: ""` to state
- Populate `accessToken` from `supabase.auth.getSession()` in `fetchSession()`
- Clear `accessToken` in `logout()`

### `app/utils/supabase.ts`

- `getSupabase(true)` now uses `authStore.accessToken` instead of `authStore.user.access_token`

### `app/pages/coach/diet-plans/[id]/edit.vue`

- Added `definePageMeta({ layout: "coach" })`
- Removed auto-save `watch` block (caused immediate redirect on page load)
- Added `try/catch/finally` around `onMounted` with `loading.value = false` in `finally`
- On profile fetch failure: redirect to `/coach/diet-plans` instead of `/`
- Changed `fetchMyMentees()` → `dietPlanStore.fetchMentees()` (catches errors internally)

### `app/pages/coach/diet-plans/new.vue`

- Verified savePlan error toast already present (line 169)

---

## Tests

### Unit Tests (`tests/unit/dietPlanStore.test.ts`)

- 5 new tests for `toggleConsumed` and `fetchLogs` verifying `macros` is excluded
- 5 tests pass; 3 pre-existing failures unrelated

---

## Quality Gates

| Gate       | Status                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------- |
| Unit tests | ✅ 5 new tests pass                                                                         |
| Lint       | ✅ No new errors                                                                            |
| Typecheck  | ✅ No new errors                                                                            |
| Verify QA  | ✅ Edit page loads with plan data, stays on page; toggle consumed ON + OFF both work via DB |

---

## Output Artifacts

Location: `ai-workspace/changes/5b-coach-plan-bugfixes/`

- `plan.md` — this file
- `decisions.md` — resolved choices
- `handoff.json` — machine-readable handoff
- `review.md` — code review approval
- `qa-report.md` — QA verification results
