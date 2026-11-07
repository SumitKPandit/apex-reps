---
name: implement-task
description: "Execute a single task from handoff.json. Test-first (unit + integration), minimal implementation, tiered quality gates, bounded self-review, sync decision requests. Second step: plan-feature → implement-task → review-code → verify-qa → maintain-context. Reads handoff.json, writes code + unit/integration tests + updated handoff.json."
---

# Implement Task Skill

## Purpose

Execute **one task** from `handoff.json` with senior discipline: test-first (unit + integration), minimal code, tiered quality gates, bounded self-review, sync decision requests. **Second step** in workflow.

**Human-Readable Output:** All code uses clear names, small functions, explicit types, and meaningful comments. Tests read like specifications. No clever one-liners, no implicit magic.

## When to Use

- After `plan-feature` creates `handoff.json` + `plan.md` + `decisions.md`
- For each task in the plan (in dependency order)
- Before `review-code` (self-review first, then peer review)

## Workflow Position

```
plan-feature → implement-task → review-code → verify-qa → maintain-context
     │              │               │            │              │
   handoff.json  reads           reads        reads           reads
   created       handoff.json    handoff.json  handoff.json    handoff.json
   + code +     + decisions.md  + decisions.md + decisions.md  + qa-report.md
   tests
```

## Inputs (Read from handoff.json)

- Task description, type, gate_level, dependencies
- Files to create/modify
- Unit/integration test requirements
- Acceptance criteria for this task
- Placement decisions, reusable patterns
- Resolved decisions (from decisions.md)

## The Task Loop (Per Task)

```
FOR EACH TASK IN HANDOFF (in dependency order):

1. READ HANDOFF (5 min)
   ├─ Read task details from handoff.json
   ├─ Read decisions.md for context
   ├─ Note: acceptance criteria, files, test requirements
   └─ Note: placement decisions, reusable patterns

2. TEST FIRST — Unit + Integration (write → RED)
   ├─ Unit tests: pure functions, utils, calculations
   ├─ Integration tests: store actions, API calls, composables
   ├─ NO E2E tests (verify-qa handles black-box QA)
   └─ Run new tests → confirm RED

3. IMPLEMENT (minimal → GREEN)
   ├─ Minimal code to pass tests
   ├─ Follow project patterns (from handoff)
   ├─ DRY/YAGNI/KISS/SOLID
   ├─ Clear types, small functions, meaningful names
   ├─ Reuse existing utilities, components, composables
   └─ Place code where expected (convention over config)

4. VERIFY (Tiered Quality Gates — ALL must pass for task's gate_level)
   ├─ strict:   unit + integration + lint + typecheck + format + build
   ├─ standard: unit + lint + typecheck
   ├─ light:    lint + typecheck
   └─ Run gates → confirm GREEN

5. SELF-REVIEW (bounded: max 2 cycles, 15 min each)
   Cycle 1: Run checklist → if FAIL, fix → re-verify → Cycle 2
   Cycle 2: Run checklist → if FAIL, fix → re-verify → ACCEPT (defer rest)

6. DOCUMENT & UPDATE HANDOFF
   ├─ Update AGENTS.md quick refs (new actions, commands)
   ├─ Update plan.md task checkboxes
   ├─ Update handoff.json (task done, test results, any new decisions)
   ├─ Summarize context for next phase (smart summarizer)
   └─ Update ai-workspace/ domain docs if schema changed

7. MARK TASK DONE → NEXT TASK (or → review-code if all tasks done)
```

---

### Supporting Utilities (Local)

| Utility                                  | Purpose                                                     |
| ---------------------------------------- | ----------------------------------------------------------- |
| `./utils/dag.ts`                         | DAG analyzer for gate_level auto-assignment                 |
| `./utils/summarize.ts`                   | Smart context summarizer (preserves types/decisions/errors) |
| `./schemas/handoff.schema.json`          | Validates handoff.json structure                            |
| `./schemas/decision_request.schema.json` | Validates decision requests                                 |

## Phase 1: Read Handoff (5 min)

**Read from handoff.json + decisions.md:**

- Task acceptance criteria
- Files to create/modify
- Unit/integration test requirements
- Reusable patterns (from plan investigation)
- Placement decisions
- Resolved decisions (context for implementation)

**Do NOT:**

- Investigate codebase (done in plan-feature)
- Make new decisions (resolved in plan-feature)
- Design test strategy (in plan.md → handoff.json)

---

## Phase 2: Test First — Unit + Integration Only

### Unit Tests (Vitest)

```typescript
// tests/unit/utils/macros.test.ts
import { describe, it, expect } from 'vitest'
import { calculateMacros, sumMealMacros } from '@/utils/macros'

describe('macros utils', () => {
  it('calculates macros scaled by quantity', () => {
    const food = { calories_per_100g: 200, protein_g_per_100g: 20, ... }
    expect(calculateMacros(food, 150)).toEqual({ calories: 300, protein_g: 30, ... })
  })

  it('handles edge cases: zero, negative', () => {
    expect(calculateMacros(food, 0)).toEqual(zeroMacros)
    expect(() => calculateMacros(food, -10)).toThrow()
  })
})
```

### Integration Tests (Vitest + Test DB)

```typescript
// tests/integration/stores/dietPlan.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDietPlanStore } from "@/stores/dietPlan";
import { createTestSupabase } from "@/test/supabase-client"; // test client

describe("dietPlanStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("fetches plan for date with meals and items", async () => {
    const store = useDietPlanStore();
    await store.fetchPlanForDate("2026-01-15");
    expect(store.currentPlan).toBeDefined();
    expect(store.currentPlan.meals.length).toBeGreaterThan(0);
  });

  it("toggles consumed and updates local state", async () => {
    const store = useDietPlanStore();
    await store.fetchPlanForDate("2026-01-15");
    const itemId = store.currentPlan.meals[0].items[0].id;
    await store.toggleConsumed(itemId, true);
    expect(store.logs[itemId].consumed).toBe(true);
  });
});
```

**NO E2E tests here.** `verify-qa` handles black-box user flows.

**Run → confirm RED:**

```bash
pnpm test:unit --run
pnpm test:integration --run
```

---

## Phase 3: Implement (Minimal, Convention-Aligned)

| Principle | Application                                                  |
| --------- | ------------------------------------------------------------ |
| **DRY**   | Extract on 2nd use → `utils/`, `composables/`, store actions |
| **YAGNI** | No config, generics, abstractions until needed               |
| **KISS**  | 3 small functions > 1 clever one                             |
| **SOLID** | Store = data, component = UI, depend on interfaces           |

### Follow Patterns from Handoff

```typescript
// Store pattern (from handoff investigation)
export const useDietPlanStore = defineStore('dietPlan', () => {
  const currentPlan = ref<DietPlanWithMeals | null>(null)
  const logs = ref<Record<string, DietPlanLog>>({})

  async function fetchPlanForDate(date: string) {
    const { data, error } = await supabase
      .from('diet_plans')
      .select('*, meals(*, food_items(*))')
      .eq('mentee_id', user.value.id)
      .lte('start_date', date)
      .gte('end_date', date)
      .single()
    if (error) throw error
    currentPlan.value = transformPlan(data)
  }

  async function toggleConsumed(itemId: string, consumed: boolean) {
    logs.value[itemId] = { ...logs.value[itemId], consumed, consumed_at: consumed ? new Date().toISOString() : null }
    const { error } = await supabase.from('diet_plan_logs').upsert({ ... })
    if (error) { /* rollback + toast */ }
  }

  return { currentPlan, logs, fetchPlanForDate, toggleConsumed }
})
```

### Placement Rules (from Handoff)

| Code Type                | Location                                       |
| ------------------------ | ---------------------------------------------- |
| Pure logic               | `app/utils/<domain>.ts`                        |
| Reactive state + actions | `app/stores/<domain>.ts`                       |
| Reusable Vue logic       | `app/composables/use<Domain>.ts`               |
| Feature components       | `app/components/<feature>/`                    |
| Shared UI components     | `app/components/ui/`                           |
| Types                    | `app/types/<domain>.ts` + export in `index.ts` |
| Unit tests               | `tests/unit/` mirroring src                    |
| Integration tests        | `tests/integration/` mirroring src             |

---

## Phase 4: Verify (Tiered Quality Gates — Zero Tolerance)

**Gate Levels (from task.gate_level):**

| Level      | Gates                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `strict`   | `pnpm test:unit --run` + `pnpm test:integration --run` + `pnpm lint` + `pnpm typecheck` + `pnpm format:check` + `pnpm build` |
| `standard` | `pnpm test:unit --run` + `pnpm lint` + `pnpm typecheck`                                                                      |
| `light`    | `pnpm lint` + `pnpm typecheck`                                                                                               |

**Run ALL for task's level, fix ANY failure:**

```bash
# Example for strict
pnpm test:unit --run
pnpm test:integration --run
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

**If any fail:** Fix code (not test), re-run from start. No "skip" in production.

---

## Phase 5: Self-Review (Bounded: 2 Cycles, 15 min each)

**Binary checklist — 10 items, all must PASS:**

| #   | Check                            | Pass Criteria                                       |
| --- | -------------------------------- | --------------------------------------------------- |
| 1   | **Task acceptance criteria met** | All criteria from handoff.json task satisfied       |
| 2   | **Quality gates pass**           | All gates for task's gate_level green               |
| 3   | **No regressions**               | Existing tests still pass                           |
| 4   | **Error handling**               | All async: try/catch + user toast + logging         |
| 5   | **Loading states**               | All async UI shows loading/skeleton                 |
| 6   | **Empty states**                 | UI handles empty data (no plan, no foods, no logs)  |
| 7   | **No dead code**                 | No commented code, unused imports, dead branches    |
| 8   | **No debug artifacts**           | No `console.log`, `debugger`, `console.dir`         |
| 9   | **Types explicit**               | No `any`, no implicit `any`, interfaces for objects |
| 10  | **Naming consistent**            | Matches codebase conventions                        |

**Cycle 1:** Run checklist. FAIL → fix → re-run Phase 4 → Cycle 2.

**Cycle 2:** Run checklist. FAIL → fix → re-run Phase 4 → **ACCEPT & MOVE ON** (remaining → follow-up issues).

**Defer to issues (never block):**

- Refactoring, style nits, performance, over-abstraction, doc enhancements

---

## Phase 6: Sync Decision Requests (Pause & Ask)

**When to request a decision during implementation:**

- Affects >2 files OR changes an interface
- No existing pattern in codebase for the situation
- Trade-off with no clear precedent in codebase

**Process:**

1. Emit `decision_request.json` (schema: `./schemas/decision_request.schema.json`)
2. **Pause execution** — wait for user response
3. User answers → written to `decisions.md` + `handoff.json`
4. Resume implementation

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

**Threshold Guide:**

| Threshold       | When to Use                                                | Action                                      |
| --------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `architectural` | Affects >2 files OR changes interface OR no pattern exists | **Sync pause**                              |
| `tactical`      | Naming, formatting, minor logic                            | Async (use recommendation, flag for review) |

---

## Phase 7: Document & Update Handoff

1. **AGENTS.md quick refs** — new store actions, commands
2. **plan.md task checkboxes** — tick completed task
3. **handoff.json** — update task.done=true, add test_results, any new decisions
4. **Smart summarization** — run summarizer (`./utils/summarize.ts`) before passing context forward:
   - Preserves: types, decisions, errors, criteria, signatures
   - Drops: verbose comments, redundant examples, boilerplate
   - Target: ~8k tokens max for next phase
5. **ai-workspace/ domain docs** — if schema/RLS changed

---

## Phase 8: Handoff

**If more tasks in handoff:** Next task → Phase 1

**If all tasks done:** → `review-code` (peer review)

**implement-task outputs:**

- Working code + unit/integration tests passing
- Updated plan.md checkboxes
- Updated AGENTS.md quick refs
- Updated handoff.json (task done, test results, new decisions)
- No E2E tests, no QA report

---

## Quality Gates (Configure in AGENTS.md)

```markdown
## Quality Gates (All Must Pass)

| Check             | Command                       |
| ----------------- | ----------------------------- |
| Unit tests        | `pnpm test:unit --run`        |
| Integration tests | `pnpm test:integration --run` |
| Lint              | `pnpm lint`                   |
| Typecheck         | `pnpm typecheck`              |
| Format            | `pnpm format:check`           |
| Build             | `pnpm build`                  |
```

---

## Adapting to Your Project

1. Copy to `.agents/skills/implement-task/SKILL.md`
2. Configure in AGENTS.md:
   - Quality gate commands (unit, integration, lint, typecheck, format, build)
   - Test structure (unit/integration folders)
   - Store/component/composable patterns
3. Reference from AGENTS.md index
