---
name: review-code
description: "Peer code review for quality, readability, and maintainability. Binary checklist, max 2 rounds, clear exit criteria. Third step: plan-feature → implement-task → review-code → verify-qa → maintain-context. Reads handoff.json + review.md, outputs review.md. Does NOT run quality gates (implement-task did) or execute workflows (verify-qa does)."
---

# Review Code Skill

## Purpose

Peer review implementation for **code quality, readability, and long-term maintainability**. **Third step** in workflow. Bounded: max 2 rounds, binary checklist, clear "approved" definition.

**Human-Readable Output:** Review feedback uses specific file:line references, plain-language explanations, and actionable fixes. No vague suggestions. A human can act on feedback without guessing.

## When to Use

- After `implement-task` completes all tasks (quality gates pass)
- Before `verify-qa` (black-box QA)
- When code is ready for merge

## Workflow Position

```
plan-feature → implement-task → review-code → verify-qa → maintain-context
     │              │               │            │              │
   plan.md      code + tests    reads        qa-report.md  updates
   created      passing gates   handoff.json, created       AGENTS.md,
   tasks        self-reviewed   review.md    verify-qa     workspace/
   defined      done            outputs      executes      from
   decisions    (unit/integ)    review.md    workflows     handoff.json
```

## Inputs (Read)

- Implementation code (diff or files)
- `handoff.json` — scope, tasks, decisions, acceptance criteria
- `review.md` — previous round history (single file, not round-1/2)
- Unit/integration test files
- AGENTS.md quick refs (patterns, conventions)

## Anti-Loop Guardrails

| Guardrail         | Rule                                                   |
| ----------------- | ------------------------------------------------------ |
| **Max rounds**    | 2 (Round 1: blocking fixes, Round 2: accept remaining) |
| **Exit criteria** | All blocking PASS → **APPROVED**                       |
| **Non-blocking**  | Deferred to issues, never block                        |
| **Reviewer role** | Enforce standards, not preferences                     |
| **Timebox**       | 20 min per round                                       |

**Definition of Approved:**

```
✅ All blocking checklist items PASS
✅ Acceptance criteria met (from handoff.json scope.in)
✅ No new TODO/FIXME in production code
✅ Quality gates already passed (implement-task verified)
```

## Review Checklist (Binary Pass/Fail Only)

### BLOCKING (Must Pass to Approve)

| #   | Category                 | Check                                                             | Pass Criteria                                                     |
| --- | ------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| B1  | **Intent Clarity**       | Names reveal purpose without reading body                         | `calculateMacros` not `calc`; `fetchPlanForDate` not `getData`    |
| B2  | **Type Safety**          | No `any`, no implicit `any`, explicit return types on public APIs | TypeScript strict passes; interfaces for all object shapes        |
| B3  | **Error Handling**       | Every async: try/catch + user feedback + logging                  | No unhandled rejections; toasts for user-facing errors            |
| B4  | **Loading/Empty States** | All async UI shows loading; empty states handled                  | No blank screens; skeletons/spinners; "no data" messages          |
| B5  | **Side Effects**         | No hidden mutations; pure = pure; stores own state                | Functions don't mutate args; composables don't leak subscriptions |
| B6  | **Resource Cleanup**     | Subscriptions, timers, listeners cleaned up                       | `onUnmounted`, `AbortController`, `try/finally` for resources     |
| B7  | **Pattern Consistency**  | Follows project patterns (store, component, composable)           | Matches conventions in AGENTS.md, handoff.json placement          |
| B8  | **No Dead Code**         | No commented code, unused imports, dead branches                  | `eslint: no-unused-vars`; manual check for comments               |
| B9  | **Security**             | No secrets; input validation; no injection risk                   | Parameterized queries; Zod/Yup validation on all inputs           |
| B10 | **Accessibility**        | Semantic HTML; labels; focus management; ARIA                     | `axe-core` passes; keyboard navigable; screen reader tested       |

### NON-BLOCKING (Defer to Issues)

| #   | Category              | Check                                                 | Action if Fail                                     |
| --- | --------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| N1  | **Abstraction Level** | Right level (not over/under-engineered)               | Create issue: "Refactor: extract composable for X" |
| N2  | **Performance**       | No obvious N+1, redundant renders, large bundles      | Create issue: "Perf: memoize X / virtualize list"  |
| N3  | **Code Style**        | Consistent (formatting by Prettier)                   | Auto-fix via format; subjective nits → ignore      |
| N4  | **Documentation**     | JSDoc on public APIs; "why" comments on complex logic | Create issue: "Docs: add JSDoc to X"               |
| N5  | **DRY**               | No duplication beyond 2nd use (3rd = extract)         | Create issue: "DRY: extract shared logic for X"    |
| N6  | **Naming Polish**     | Names good but could be slightly better               | Create issue: "Rename: X → Y for clarity"          |
| N7  | **Component Size**    | Components < 150 lines, functions < 30 lines          | Create issue: "Split: X component too large"       |

**Rule:** Non-blocking **never block approval**. Create GitHub issue, link in review file, move on.

---

### Supporting Schemas (Local)

| Schema                                   | Purpose                          |
| ---------------------------------------- | -------------------------------- |
| `./schemas/handoff.schema.json`          | Validates handoff.json structure |
| `./schemas/decision_request.schema.json` | Validates decision requests      |

## Review Output (Required)

**Location:** `ai-workspace/changes/<issue-id>-<slug>/review.md` (single file, not round-1/2)

**Format:**

```markdown
# Code Review: <PR # or Task>

**Reviewer:** <agent/human>
**Date:** <ISO timestamp>
**PR/Task:** #<number> — <title>
**Commit:** <sha>

---

## Round History

### Round 1

| Item | Status | File:Line                         | Details                                             |
| ---- | ------ | --------------------------------- | --------------------------------------------------- |
| B1   | PASS   | —                                 | Names clear, intent obvious                         |
| B3   | FAIL   | `app/stores/foodItem.ts:34`       | Missing try/catch + toast on saveFood()             |
| B7   | FAIL   | `app/components/FoodSelector.vue` | Uses custom pattern, not store pattern from handoff |
| ...  | ...    | ...                               | ...                                                 |

### Round 2 (if needed)

| Item | Status | File:Line                         | Details                     |
| ---- | ------ | --------------------------------- | --------------------------- |
| B3   | PASS   | `app/stores/foodItem.ts:34`       | Added try/catch + toast     |
| B7   | PASS   | `app/components/FoodSelector.vue` | Refactored to store pattern |
| ...  | ...    | ...                               | ...                         |

## Non-Blocking Items (N1-N7) — Logged as Issues

| Item | Issue # | File:Line                             | Details                      |
| ---- | ------- | ------------------------------------- | ---------------------------- |
| N2   | #123    | `app/composables/useFoodSearch.ts:18` | Could memoize search results |
| N5   | #124    | `app/utils/validation.ts`             | Duplicate validation logic   |

---

## Decision

**Round 1:** CHANGES_REQUESTED — Fix blocking items, re-run quality gates, request Round 2
**Round 2:** APPROVED / APPROVED_WITH_FOLLOWUP — All blocking pass / remaining tracked in issues

---

## Summary

- Blocking: X pass, Y fail
- Non-blocking: Z logged as issues
- Acceptance criteria: MET / NOT MET
- Next action: [Fix B3, B7 → request Round 2] / [Approve → verify-qa] / [Approve with follow-up → verify-qa]
```

---

## Review Process (2 Rounds Max)

```
ROUND 1 (Blocking Focus)
├─ Verify: quality gates already passed (implement-task did this)
├─ Check B1-B10 against implementation + handoff.json
├─ If any FAIL → document: item #, file:line, expected fix
├─ If architectural issue found → emit decision_request.json (sync)
├─ Author fixes → re-run quality gates → ROUND 2

ROUND 2 (Final)
├─ Re-check ONLY previously FAILED blocking items
├─ If all PASS → APPROVE
├─ If any still FAIL → APPROVE_WITH_FOLLOWUP (pragmatism)
├─ Log non-blocking items (N1-N7) as linked issues
└─ DONE → handoff to verify-qa
```

**Round 2 Pragmatism:** If blocking item still fails after fix attempt → approve with issue. Don't loop.

---

## Sync Decision Requests During Review

If reviewer finds architectural issue requiring new decision:

1. Emit `decision_request.json` (schema: `./schemas/decision_request.schema.json`)
2. **Pause** — wait for user response
3. User answers → written to `decisions.md` + `handoff.json`
4. Resume review

**Decision Request Format:**

```json
{
  "id": "cache-ttl",
  "question": "Should search cache TTL be 24h or 7d?",
  "options": ["24h", "7d", "configurable"],
  "impact": "cache invalidation strategy, user experience",
  "recommendation": "24h",
  "threshold": "architectural",
  "context": "Food search cache in useFoodCache composable",
  "files_affected": ["app/composables/useFoodCache.ts"],
  "created_at": "2026-10-31T...",
  "resolved": false
}
```

---

## What Reviewer Checks (How to Evaluate)

### B1: Intent Clarity

```typescript
// ❌ FAIL
function process(d) {
  return d.map((x) => x * 2);
}

// ✅ PASS
function doubleQuantities(items: FoodItem[]): FoodItem[] {
  return items.map((item) => ({ ...item, quantity: item.quantity * 2 }));
}
```

**Check:** Predict behavior from name + signature alone.

### B2: Type Safety

```typescript
// ❌ FAIL
function parseFood(data: any): FoodItem { ... }

// ✅ PASS
function parseFood(data: unknown): FoodItem {
  return FoodItemSchema.parse(data)
}
```

**Check:** `tsc --noEmit` passes; no `any` in new code.

### B3: Error Handling

```typescript
// ❌ FAIL
async function savePlan(plan: Plan) {
  await supabase.from("plans").insert(plan);
}

// ✅ PASS
async function savePlan(plan: Plan) {
  try {
    const { error } = await supabase.from("plans").insert(plan);
    if (error) throw error;
    toast.success("Plan saved");
  } catch (err) {
    logger.error("savePlan failed", err);
    toast.error("Failed to save plan");
    throw err;
  }
}
```

**Check:** Every `await` in try/catch; user toast; error logged.

### B4: Loading/Empty States

```vue
<!-- ❌ FAIL -->
<template>
  <div v-for="item in items">{{ item.name }}</div>
</template>

<!-- ✅ PASS -->
<template>
  <Skeleton v-if="loading" count="5" />
  <div v-else-if="items.length === 0" class="empty-state">
    No foods found. <button @click="createCustom">Add custom</button>
  </div>
  <div v-else v-for="item in items">{{ item.name }}</div>
</template>
```

**Check:** Loading skeleton, empty state with action, error state.

### B5: Side Effects

```typescript
// ❌ FAIL - mutates input
function addMacros(item: FoodItem, extra: Macros) {
  item.calories += extra.calories;
  return item;
}

// ✅ PASS - immutable
function addMacros(item: FoodItem, extra: Macros): FoodItem {
  return { ...item, calories: item.calories + extra.calories };
}
```

**Check:** No input mutation; stores manage own state; composables return cleanup.

### B6: Resource Cleanup

```typescript
// ❌ FAIL - leak
function useRealtimePlan(planId: string) {
  const channel = supabase.channel("plan").subscribe();
  return { channel };
}

// ✅ PASS - cleanup
function useRealtimePlan(planId: string) {
  const channel = supabase.channel("plan").subscribe();
  onUnmounted(() => supabase.removeChannel(channel));
  return { channel };
}
```

**Check:** `onUnmounted`, `AbortController`, `try/finally` for subscriptions/timers.

### B7: Pattern Consistency

```typescript
// ❌ FAIL - custom pattern not in handoff
const foodData = ref([])
async function loadFoods() { ... }

// ✅ PASS - follows store pattern from handoff
export const useFoodItemStore = defineStore('foodItem', () => {
  const foods = ref([])
  async function loadFoods() { ... }
  return { foods, loadFoods }
})
```

**Check:** Matches conventions in AGENTS.md, placement in handoff.json.

### B8: No Dead Code

```bash
rg "console\.log" -- app/
rg "TODO|FIXME" -- app/
# Should return nothing for new code
```

### B9: Security

```typescript
// ❌ FAIL - string interpolation
const query = `SELECT * FROM foods WHERE name = '${name}'`

// ✅ PASS - parameterized + validation
const { data } = await supabase.from('foods').select('*').eq('name', name)
const parseResult = FoodNameSchema.safeParse(name)
if (!parseResult.success) throw new ValidationError(...)
```

### B10: Accessibility

```vue
<!-- ❌ FAIL -->
<input v-model="quantity" type="number" />

<!-- ✅ PASS -->
<label for="quantity-g">Quantity (grams)</label>
<input id="quantity-g" v-model="quantity" type="number" min="1" required />
<div v-if="errors.quantity" role="alert">{{ errors.quantity }}</div>
```

**Check:** Labels, semantic HTML, focus order, error announcements, color contrast.

---

## Reviewer Guidelines

| Do                                            | Don't                                 |
| --------------------------------------------- | ------------------------------------- |
| Comment: "B3 FAIL: line 34 missing try/catch" | Comment: "I'd write this differently" |
| Reference checklist item #                    | Say "this could be cleaner"           |
| Suggest specific fix                          | Ask "what do you think about..."      |
| Approve when blocking pass                    | Block for N1-N7                       |
| Create issue for non-blocking                 | Leave N1-N7 as PR comments            |

---

## Author Response Protocol

1. Read all comments — don't defend, understand
2. Fix blocking items only (B1-B10)
3. Re-run quality gates (`pnpm test:unit --run`, etc.)
4. Reply: "Fixed B3: added try/catch + toast" (reference item #)
5. Create issues for N1-N7, link in review file
6. Request Round 2 review

---

## Round 2: Final Decision

```
Re-check ONLY previously failed blocking items:

IF all now PASS → ✅ APPROVE
   "All blocking resolved. Non-blocking: #123, #124. Approved → verify-qa."

IF some still FAIL → ✅ APPROVE_WITH_FOLLOWUP
   "B6 still fails. Created issue #125. Approved with follow-up → verify-qa."

NEVER → Round 3
```

---

## Handoff to verify-qa

**verify-qa reads:**

- `review.md` (approval decision)
- `handoff.json` (scope, acceptance criteria)
- `qa-report.md` template

**verify-qa does:**

- Black-box QA: browser workflows + API tests + DB verification
- Outputs `qa-report.md`

**verify-qa does NOT:**

- Review code quality (review-code did)
- Run unit/integration tests (implement-task did)
