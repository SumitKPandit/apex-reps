# Decisions: Fix QA Bugs from Issue #5 (Coach Plan Management)

**Issue:** #5 — Coach Plan Management (bugfix follow-up)  
**Date:** 2026-11-01

---

## Decision 1: BUG-001 — Remove `macros` from `diet_plan_logs` operations

**Context:** `toggleConsumed` upserts `macros` into `diet_plan_logs`, `fetchLogs` selects `macros` from it, and `DietPlanLog` type declares `macros?: CalculatedMacros`. But `diet_plan_logs` has no `macros` column — macros live on `diet_plan_food_items`.

**Choice:** Remove all `macros` references from `diet_plan_logs` operations:

- Remove `macros` from `toggleConsumed` upsert payload
- Remove `macros` from `fetchLogs` select
- Remove `macros?: CalculatedMacros` from `DietPlanLog` interface

**Rationale:** Simplest fix, no migration needed, macros already available via plan meal items for progress display. Minimal surface area.

---

## Decision 2: BUG-005 — Add `onConflict` to `toggleConsumed` upsert

**Context:** `toggleConsumed` used a bare `upsert()` without `onConflict`. On toggle-off, Supabase tried to INSERT a duplicate row, violating `diet_plan_logs_unique_mentee_item_date`.

**Choice:** Add `{ onConflict: "mentee_id, food_item_id, log_date" }` to the upsert call and remove the now-unneeded `as any` cast.

**Rationale:** Upsert with onConflict correctly updates the existing row instead of attempting a duplicate insert. This is the standard Supabase pattern for "create or update" semantics.

---

## Decision 3: BUG-006 — Store auth access token separately

**Context:** `getSupabase(true)` read `authStore.user.access_token`, but the `User` interface doesn't include `access_token`. The value was always `undefined`, so no `Authorization: Bearer` header was sent, and RLS blocked all browser requests.

**Choice:** Add `accessToken` to auth store state, populated from `supabase.auth.getSession()` in `fetchSession()`, and used by `getSupabase(true)`.

**Rationale:** `supabase.auth.getSession()` returns the full session object including `access_token`. Storing it separately ensures `getSupabase(true)` can construct authenticated Supabase clients for browser-side RLS-protected queries.

---

## Decision 4: BUG-007 — Remove auto-save watch from edit page

**Context:** The edit page had a `watch` with `deep: true` that auto-called `savePlan()` whenever `planName`, `startDate`, `endDate`, or `meals` changed. After `fetchPlanForEdit` populated all fields and set `initialized.value = true`, the watch fired and auto-saved, immediately redirecting to `/coach/diet-plans`.

**Choice:** Remove the auto-save watch entirely. Users explicitly click "Save Plan" to save changes.

**Rationale:** Auto-save on every field change causes unwanted redirects and is redundant with the explicit Save button. Removing it eliminates the bug and simplifies the page.

---

## Decision 5: BUG-008 — Fix edit page loading/error handling

**Context:** `loading.value` was never set to `false` when `fetchProfile()` failed. The profile fetch failure path redirected to `/` instead of `/coach/diet-plans`, leaving users stranded.

**Choice:** Wrap `onMounted` in `try/catch/finally` with `loading.value = false` in `finally`. On profile failure, redirect to `/coach/diet-plans`.

**Rationale:** Ensures the loading spinner always dismisses and errors navigate to a sensible page.

---

## Summary Table

| ID  | Decision                | Choice                                                          |
| --- | ----------------------- | --------------------------------------------------------------- |
| 1   | BUG-001 fix approach    | Remove `macros` from `diet_plan_logs` operations (no migration) |
| 2   | BUG-005 upsert conflict | Add `onConflict: "mentee_id, food_item_id, log_date"`           |
| 3   | BUG-006 auth token      | Store `accessToken` in authState, use in `getSupabase(true)`    |
| 4   | BUG-007 auto-save watch | Remove auto-save watch from edit page                           |
| 5   | BUG-008 loading/error   | `try/catch/finally` with loading dismiss + redirect to list     |
