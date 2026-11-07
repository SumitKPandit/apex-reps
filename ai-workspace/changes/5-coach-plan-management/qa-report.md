# QA Report: Coach Plan Management (Issue #5)

**Date:** 2026-11-01T11:45:00Z  
**Environment:** Local dev (supabase + pnpm dev on port 3000)  
**Browser:** agent-browser (headed Chrome via CDP, v0.27.0)  
**Test Users:** coach2@example.com / testpassword123 (coach), test@example.com / testpassword123 (mentee)  
**Review:** review.md (APPROVED_WITH_FOLLOWUP)  
**Commit:** working tree changes

---

## Workflows Tested

### 1. Coach: Login

**Status:** PASS  
**Steps:** Open / → Enter email coach2@example.com → Enter password testpassword123 → Click Continue  
**Observations:** Redirected to coach dashboard. Welcome message "Welcome back, Coach Two!" displayed. Dashboard shows Total Mentees: 2, Active Plans: 2.

### 2. Coach: List Mentees and Plans

**Status:** PASS  
**Steps:** Login as coach → Click "View All Plans" → Verify mentee list with plans  
**Observations:** /coach/diet-plans loads. Mentee Two section shown with multiple plans (name, status badge, date range, Edit link). Plans grouped by mentee as designed. "Create New Plan" button present.

### 3. Coach: Create Diet Plan

**Status:** PARTIAL  
**Steps:** Login as coach → Click "Create New Plan" → Select mentee "Mentee Two" → Enter plan name "QA Test Plan - Nov 2026" → Keep dates 2026-11-01 to 2026-11-08 → Search "chicken" in Breakfast → Select "Chicken breast, raw" → Set quantity 100g → Click Add → Click Save Plan  
**Observations:**

- Mentee combobox works (shows "Mentee Two" and "Test Mentee" options)
- Plan name field accepts input
- Food search works: typing "chicken" returns "Chicken breast, raw" and "Chicken thigh, raw" with per-100g macros
- Adding food to meal works: Chicken breast (100g) added to Breakfast
- Macro calculation works: Breakfast total shows "165 cal • 31g protein"; Daily Totals show 165 cal, 31g protein, 3.6g fat
- **Save Plan fails:** "duplicate key value violates unique constraint diet_plans_unique_mentee_start" — Mentee Two already has a plan starting 2026-11-01 (from prior test run: "week 1 plan")
- Date picker UX issue: clicking a date in the calendar does not update the selected date (stays on 2026-11-01)
- Error shown only in console, not as user-friendly toast

### 4. Coach: Unique Constraint Enforcement

**Status:** PASS  
**Steps:** Attempt to create plan with start date 2026-11-01 for Mentee Two (who already has a plan on that date)  
**Observations:** Database correctly rejects the insert with unique constraint violation on (mentee_id, start_date). Error caught by try/catch and logged. Constraint works as designed.

### 5. Coach: Edit Plan

**Status:** FAIL  
**Steps:** Login as coach → /coach/diet-plans → Click "Edit" on a plan  
**Observations:** Clicking "Edit" links (NuxtLink to `/coach/diet-plans/:id/edit`) does not navigate. Direct navigation to edit URL via `agent-browser open` loads the list page instead of the edit page — the edit page redirects back immediately. Server log shows the edit page's `fetchPlanForEdit` action is called but the page ends up back on the list. Root cause not fully isolated (possible profile loading race or session issue in browser context).  
**API verification:** Plan data IS accessible via REST API as coach (200 response with full meals/items structure), confirming the backend works; the issue is in the browser-side navigation/page load.

### 6. Mentee: Login

**Status:** PASS  
**Steps:** Open / → Enter email test@example.com → Enter password testpassword123 → Click Continue  
**Observations:** Redirected to mentee dashboard. "Welcome Test Mentee!" displayed. Navigation shows "Diet Plan" link.

### 7. Mentee: View Assigned Plan

**Status:** PASS  
**Steps:** Login as mentee → Click "Diet Plan" → Verify plan for today (Sunday, November 1, 2026)  
**Observations:** /diet-plan loads. Plan shows Breakfast (2 items) and Lunch (3 items) with food names, quantities, and macros. Daily Progress shows totals: 0/1191 kcal, 0/53.3g protein, 0/190.5g carbs, 0/24.25g fat, 0/26.5g fiber.

### 8. Mentee: Macro Calculation Verification

**Status:** PASS  
**Steps:** View mentee plan → Manually sum item macros vs displayed daily totals  
**Observations:**

- Calories: 305 + 17 + 365 + 360 + 144 = 1191 ✅ (matches displayed 1191 kcal)
- Protein: 16.5 + 1.7 + 7.1 + 20 + 8 = 53.3 ✅ (matches displayed 53.3g)
- Carbs: 24 + 2.5 + 80 + 60 + 24 = 190.5 ✅ (matches displayed 190.5g)
- Fat: 16.5 + 0.05 + 0.7 + 5 + 2 = 24.25 ✅ (matches displayed 24.25g)
- Macros calculate correctly per meal and daily total.

### 9. Mentee: Check Off Food Item (Toggle Consumed)

**Status:** FAIL  
**Steps:** Login as mentee → /diet-plan → Click checkbox on "Milk, whole" (Breakfast, 305 cal)  
**Observations:** Checkbox UI updates to checked=true. However, no `diet_plan_logs` row is created in the database. Server log shows:

```
ERROR: Could not find the 'macros' column of 'diet_plan_logs' in the schema cache
at Proxy.toggleConsumed (app/stores/dietPlan.ts:198:22)
```

Root cause: `toggleConsumed` action (line 348 of dietPlan.ts) attempts to upsert a `macros` column into `diet_plan_logs`, but that column does not exist in the schema. Macros belong on `diet_plan_food_items`, not `diet_plan_logs`. The `as Record<string, number>` cast bypasses TypeScript but fails at runtime.

### 10. API: RLS Verification

**Status:** PASS  
**Steps:** Test each RLS policy via curl with coach and mentee tokens  
**Observations:**

| Policy                   | Test                               | Status | Result                 |
| ------------------------ | ---------------------------------- | ------ | ---------------------- |
| diet_plans_mentee_select | GET own plans as mentee            | PASS   | 200                    |
| diet_plans_mentee_select | GET other mentee's plans as mentee | PASS   | [] (filtered, no leak) |
| diet_plans_coach_crud    | GET coach's mentee plans as coach  | PASS   | 200                    |
| food_items_insert_coach  | POST food as mentee                | PASS   | 403 (blocked)          |
| food_items_insert_coach  | POST food as coach                 | PASS   | 201 (allowed)          |

---

## Acceptance Criteria Check

| Criteria                                                                 | Status     | Evidence                                                                                          |
| ------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------- |
| Coach sees list of all mentees and their plans                           | ✅ PASS    | /coach/diet-plans shows mentees grouped with plans                                                |
| Coach creates full day plan: 3 meals + 2 snacks with multiple items each | ⚠️ PARTIAL | Can add foods to meals via FoodSelector; save blocked by date conflict + date picker UX issue     |
| Macros calculate correctly per meal and daily total                      | ✅ PASS    | Verified in coach create (165 cal/31g protein) and mentee view (1191 kcal total matches item sum) |
| Edit plan modifies existing data correctly                               | ❌ FAIL    | Edit page not reachable via browser navigation                                                    |
| Data persists after page reload                                          | ⚠️ PARTIAL | Plan data persists in DB; consumption logs do NOT persist (BUG-001)                               |

---

## Bugs Found

| ID      | Severity | Workflow               | Steps to Reproduce                                                | Expected                                            | Actual                                                                                                     |
| ------- | -------- | ---------------------- | ----------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BUG-001 | Critical | Mentee: Check off item | Login as mentee → /diet-plan → Click checkbox on any food item    | Log saved to `diet_plan_logs`, progress bar updates | Checkbox toggles UI but no DB row created. Error: "Could not find the 'macros' column of 'diet_plan_logs'" |
| BUG-002 | Minor    | Coach: Create plan     | Open date picker on create form → Click a date (e.g., Nov 15)     | Date field updates to selected date                 | Date stays on 2026-11-01; picker closes without updating                                                   |
| BUG-003 | Minor    | Coach: Edit plan       | /coach/diet-plans → Click "Edit" link on a plan                   | Navigate to `/coach/diet-plans/:id/edit`            | Page stays on list; direct URL open redirects back to list                                                 |
| BUG-004 | Minor    | Coach: Create plan     | Try to create plan with start date that already exists for mentee | User-friendly error toast                           | Error logged to console only; no toast shown                                                               |

---

## Skipped Workflows (from scope.out)

| Workflow                      | Reason                             |
| ----------------------------- | ---------------------------------- |
| Drag-and-drop meal reordering | Out of scope (fixed display_order) |
| Bulk plan operations          | Out of scope                       |
| Plan versioning/history       | Out of scope                       |
| Coach dashboard analytics     | Out of scope                       |

---

## Non-Blocking Issues from review-code

| Issue # | Category                 | Status                             |
| ------- | ------------------------ | ---------------------------------- |
| N2      | RPC for true atomicity   | Not verified (out of scope for QA) |
| N5      | Extract transform helper | Not verified (out of scope for QA) |
| N7      | Split dietPlanStore      | Not verified (out of scope for QA) |

---

## Summary

- **Workflows tested:** 10
- **Passed:** 6
- **Partial:** 2 (Create plan, Data persistence)
- **Failed:** 2 (Edit plan, Check off item)
- **API endpoints verified:** 5 (all RLS policies)
- **Blocking bugs:** 1 (BUG-001 — consumption tracking broken)
- **Follow-up issues:** 3 (BUG-002, BUG-003, BUG-004)

**Overall:** NOT READY FOR MERGE — BUG-001 (critical) breaks the mentee consumption tracking workflow, which is a core feature. Fix the `macros` column reference in `toggleConsumed` (dietPlan.ts line 348) before merging. BUG-003 (edit plan navigation) also needs investigation as it prevents the edit workflow entirely in the browser.
