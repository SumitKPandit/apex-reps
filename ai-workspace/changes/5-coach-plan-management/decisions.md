# Decisions: Coach Plan Management (Story 3)

**Issue:** #5  
**Date:** 2026-10-31

---

## Decision 1: Mentee List Source

**Context:** Create/Edit pages need a dropdown of the coach's mentees.

**Options:**

1. **Query `profiles` where `role = 'mentee' AND coach_id = auth.uid()`** (recommended) — Direct, uses existing coach_id FK on profiles
2. Join through `diet_plans` — Only shows mentees with existing plans
3. New `coach_mentees` junction table — Over-engineering

**Choice:** Option 1  
**Rationale:** The `profiles` table already has `coach_id` FK (per schema). Simple query, no new tables. Coach assigns mentees via profile update (admin or separate feature).

---

## Decision 2: Plan List View — Group by Mentee

**Context:** How to display plans on `/coach/diet-plans`.

**Options:**

1. **Group by mentee** (recommended) — Mentee card with their plans listed inside
2. Flat list with mentee name column — Simpler but less organized
3. Tabs per mentee — More clicks

**Choice:** Option 1  
**Rationale:** Matches current mock UI (mentee cards). Scales better as coach gets more mentees. Clear visual hierarchy.

---

## Decision 3: Edit Page Route

**Context:** Where to put the edit plan UI.

**Options:**

1. **Separate route: `/coach/diet-plans/:id/edit`** (recommended) — RESTful, shareable URL, browser history
2. Modal on list page — Keeps context but harder to share/deep-link
3. Same page as create with `?edit=id` — Conflates create vs edit

**Choice:** Option 1  
**Rationale:** Standard Nuxt pattern. Allows direct link to edit a specific plan. Browser back button works naturally.

---

## Decision 4: Meal Ordering — Fixed Order

**Context:** Meals have `display_order` column. How to manage ordering.

**Options:**

1. **Fixed order: Breakfast=0, Lunch=1, Dinner=2, Snacks=3,4,...** (recommended) — No drag-drop complexity
2. Drag-and-drop reordering — Nice UX but significant effort
3. User-entered order number — Error-prone

**Choice:** Option 1  
**Rationale:** Standard meal sequence. "Add Snack" appends to end. Simpler implementation, matches user mental model. Drag-drop can be future enhancement.

---

## Decision 5: Unique Constraint Handling (mentee_id, start_date)

**Context:** DB has unique constraint on `(mentee_id, start_date)`. One active plan per mentee per start date.

**Options:**

1. **Client-side check + server error handling** (recommended) — Query existing plans for mentee, warn before submit; catch DB error as fallback
2. Server error only — Simpler client, worse UX
3. Auto-adjust date (e.g., next available) — Confusing for coach

**Choice:** Option 1  
**Rationale:** Proactive UX prevents frustration. Server constraint is safety net. Query `diet_plans` for mentee in create/edit submit handler.

---

## Decision 6: Coach Notes Field

**Context:** `diet_plans.notes` column exists (coach-facing notes, separate from mentee daily notes).

**Options:**

1. **Include optional textarea in create/edit** (recommended) — Uses existing column
2. Omit for now — Misses useful field
3. Separate "plan details" page — Over-engineering

**Choice:** Option 1  
**Rationale:** Column exists in schema. Low effort to add. Coach can document plan rationale.

---

## Decision 7: Form Validation — Zod Schema

**Context:** Plan form needs validation (required fields, date logic, unique check).

**Options:**

1. **Zod schema** (recommended) — Consistent with CustomFoodModal, type-safe
2. Manual validation — Inconsistent, more boilerplate
3. VeeValidate + Yup — Extra dependency

**Choice:** Option 1  
**Rationale:** Already used in codebase (CustomFoodModal). Type inference for form data. Lightweight.

---

## Decision 8: Plan Status Badges

**Context:** List view shows plan status (active/upcoming/expired).

**Options:**

1. **Client-side calculation from dates** (recommended) — No extra data needed
2. Store computed status — Stale risk
3. DB view/function — Overkill

**Choice:** Option 1  
**Rationale:** Pure function of `start_date`, `end_date`, `today`. Compute in component or store getter.

---

## Decision 9: Transactional Save Strategy

**Context:** Create plan inserts into 3 tables: `diet_plans`, `diet_plan_meals`, `diet_plan_food_items`.

**Options:**

1. **Sequential inserts with cleanup on failure** (recommended) — Simple, no RPC needed
2. Postgres function (RPC) — Atomic but adds migration complexity
3. Supabase transaction (not directly supported) — Not available

**Choice:** Option 1  
**Rationale:** Pattern used in `statsStore.insertStat` (stat + photos). Insert plan → meals → food_items. On any failure, delete created rows in reverse order. Low risk, tested pattern.

---

## Decision 10: Update Plan Strategy

**Context:** Editing a plan replaces meals and food items.

**Options:**

1. **Delete old meals/items → insert new** (recommended) — Simpler than diffing
2. Diff and patch individual rows — Complex, marginal benefit
3. Soft delete + insert new — Schema doesn't support soft delete

**Choice:** Option 1  
**Rationale:** Meals/items are replaceable content. Delete cascade handles cleanup. Matches "replace entire plan" mental model.

---

## Summary Table

| ID  | Decision           | Choice                                                   |
| --- | ------------------ | -------------------------------------------------------- |
| 1   | Mentee source      | `profiles` where `role='mentee' AND coach_id=auth.uid()` |
| 2   | List grouping      | Group by mentee                                          |
| 3   | Edit route         | `/coach/diet-plans/:id/edit`                             |
| 4   | Meal order         | Fixed (Breakfast=0, Lunch=1, Dinner=2, Snacks=3+)        |
| 5   | Unique constraint  | Client check + server error                              |
| 6   | Coach notes        | Include optional textarea                                |
| 7   | Validation         | Zod schema                                               |
| 8   | Status badges      | Client-side date comparison                              |
| 9   | Create transaction | Sequential inserts with rollback                         |
| 10  | Update strategy    | Delete old meals/items → insert new                      |
