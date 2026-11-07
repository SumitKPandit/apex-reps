---
name: plan-feature
description: "Turn a requirement (issue, spec, story) into a concrete, minimal, test-first implementation plan. Investigates codebase for reuse, identifies decisions to clarify with user, breaks into ordered tasks. Outputs plan.md + decisions.md + handoff.json to ai-workspace/changes/<issue-id>-<slug>/. First step in workflow: plan-feature → implement-task → review-code → verify-qa → maintain-context."
---

# Plan Feature Skill

## Purpose

Create a concrete implementation plan from a requirement. **First step** in the workflow. Never assumes — clarifies decisions with user. Outputs `plan.md`, `decisions.md`, `handoff.json` for downstream skills.

**Human-Readable Output:** All generated plans use clear headings, tables, and plain language. No dense JSON, no abbreviated codes. A human should understand the plan in 5 minutes.

## When to Use

- Starting a new feature/issue/story
- Before any implementation begins
- When requirements are unclear or need decisions

## Workflow Position

```
plan-feature → implement-task → review-code → verify-qa → maintain-context
     │              │               │            │              │
   plan.md      reads          reads        reads           reads
   decisions.md handoff.json   handoff.json  handoff.json    handoff.json
   handoff.json                  + code       + code          + qa-report.md
   created
```

## Modes

| Mode       | Scope                         | Output                                          |
| ---------- | ----------------------------- | ----------------------------------------------- |
| `feature`  | Full feature (default)        | plan.md + decisions.md + handoff.json           |
| `bugfix`   | Root cause + minimal fix      | plan.md (minimal) + decisions.md + handoff.json |
| `refactor` | Impact analysis + incremental | plan.md + decisions.md + handoff.json           |
| `config`   | Config change only            | handoff.json (no plan.md)                       |
| `docs`     | Documentation only            | plan.md (docs only) + handoff.json              |

---

## Planning Workflow (7 Steps)

```
1. Understand Requirements
       │
       ▼
2. Investigate Codebase (reuse, patterns, placement) ← MANDATORY
       │
       ▼
3. Identify Decisions Needed → Ask User (options + recommendation)
       │
       ▼
4. Design Test Plan (Unit → Integration → QA)
       │
       ▼
5. Break Into Ordered Tasks (dependencies, vertical slices, gate_level auto)
       │
       ▼
6. Assess Risks & Rollback
       │
       ▼
7. Write Plan + Decisions + Handoff → ai-workspace/changes/<issue-id>-<slug>/
```

---

## Step 1: Understand Requirements

**Inputs:** GitHub issue, Jira ticket, REQUIREMENTS.md (archived after planning), user conversation

**Output:** One-sentence goal + acceptance criteria list

**Questions:**

- What user problem does this solve?
- Hard acceptance criteria?
- Explicitly out of scope?
- Deadlines/dependencies?

---

## Step 2: Investigate Codebase (Mandatory)

**Search for:**

- Similar features (grep keywords, component names, store actions)
- Reusable utilities, composables, helpers
- Established patterns (store structure, component hierarchy, API clients)
- Existing type definitions
- Test patterns in similar features

**Document in plan:**

```markdown
## Codebase Investigation

### Reusable Patterns Found

| Pattern                    | Location                                | Reuse For      |
| -------------------------- | --------------------------------------- | -------------- |
| Transactional store insert | `app/stores/stats.ts`                   | Diet plan save |
| Autocomplete component     | `app/components/SelectAutocomplete.vue` | Food selector  |

### Placement Decisions

| New Code      | Expected Location                           | Reason                     |
| ------------- | ------------------------------------------- | -------------------------- |
| dietPlanStore | `app/stores/dietPlan.ts`                    | Follows statsStore pattern |
| FoodSelector  | `app/components/diet-plan/FoodSelector.vue` | Feature-scoped             |

### Existing Types to Extend

- `app/types/database.ts` — diet_plan tables
- `app/types/index.ts` — export new types
```

---

## Step 3: Identify Decisions → Ask User (Sync)

**Never decide yourself.** Present options with recommendation:

```markdown
### Decision: [Title]

**Context:** [Why this matters]

**Options:**

1. **Option A** (recommended) — [Why]
2. Option B — [Trade-off]
3. Option C — [Trade-off]

**My recommendation:** Option A because [reason]

**Your call:**
```

**Common categories:** API design, state management, component granularity, validation, migration strategy, UI library, offline strategy.

**Output:** `decisions.md` with resolved choices.

---

## Step 4: Design Test Plan (Test-First)

| Test Type          | Scope                                 | Written By     | Verified By                    |
| ------------------ | ------------------------------------- | -------------- | ------------------------------ |
| **Unit**           | Pure functions, utils, calculations   | implement-task | implement-task (quality gates) |
| **Integration**    | Store actions, API calls, composables | implement-task | implement-task (quality gates) |
| **QA (Black-box)** | Full user flows, auth, navigation     | verify-qa      | verify-qa (qa-report.md)       |

**Test plan in plan.md:**

```markdown
## Test Plan

### Unit Tests (Vitest) — implement-task writes

- [ ] `calculateMacros(foodItem, quantityG)` → {calories, protein, carbs, fat, fiber}
- [ ] `sumMealMacros(foodItems[])` → totals

### Integration Tests (Vitest + Supabase) — implement-task writes

- [ ] `dietPlanStore.fetchPlanForDate(date)` → plan with meals + items
- [ ] `foodItemStore.searchFoods(query)` → filtered results

### QA Workflows (Playwright/curl) — verify-qa executes

- [ ] Coach creates plan with meals + items via autocomplete
- [ ] Mentee views plan → progress bars show 0/planned
- [ ] Mentee checks items → bars update real-time
- [ ] Offline: mark consumed → sync on reconnect
```

---

## Step 5: Break Into Ordered Tasks (Gate Level Auto-Assigned)

**Principles:**

- One task = one logical change (ideally one PR)
- Order by dependency (foundation → features)
- Each task deployable/verifiable
- Vertical slices over horizontal layers

**Gate Level Auto-Assignment (via DAG):**

| Level      | Criteria (DAG position)              | Gates                                          |
| ---------- | ------------------------------------ | ---------------------------------------------- |
| `strict`   | Root (no dependencies)               | All: typecheck, lint, unit, integration, build |
| `standard` | Intermediate (has deps + dependents) | typecheck + lint + unit                        |
| `light`    | Leaf (no dependents)                 | typecheck + lint only                          |

**Task template (in plan.md):**

```markdown
## Task 1: [Title]

**Type:** migration | store | component | page | test | doc | config

**Depends on:** [Task IDs or "none"]

**Gate Level:** strict | standard | light (auto-assigned)

**Description:** [What changes, where]

**Files to create/modify:**

- `path/to/file.ts` — [what changes]

**Test first (implement-task writes):**

- [ ] Unit: `tests/unit/...`
- [ ] Integration: `tests/integration/...`

**Verification:** [How to confirm it works]

**Rollback:** [How to revert if broken]
```

---

## Step 6: Risk Assessment & Rollback

| Risk                  | Likelihood | Impact | Mitigation              | Rollback                   |
| --------------------- | ---------- | ------ | ----------------------- | -------------------------- |
| Migration breaks data | Low        | High   | Test on staging, backup | `supabase db reset` + seed |
| RLS too restrictive   | Medium     | High   | Test as coach + mentee  | Disable, fix, re-enable    |

---

## Step 7: Output Artifacts

**Location:** `ai-workspace/changes/<issue-id>-<short-slug>/`

| File           | Purpose                                    |
| -------------- | ------------------------------------------ |
| `plan.md`      | Scope, tasks, test plan, risks             |
| `decisions.md` | Resolved decisions (id, choice, rationale) |
| `handoff.json` | Machine-readable handoff for next phase    |

**handoff.json schema:** `./schemas/handoff.schema.json`

```json
{
  "issue_id": "4",
  "mode": "feature",
  "scope": { "in": [...], "out": [...] },
  "decisions": [{ "id": "autocomplete", "choice": "custom", "rationale": "..." }],
  "tasks": [{ "id": 1, "title": "...", "gate_level": "strict", "depends_on": [], "done": false }],
  "canonical_docs": { "plan": "plan.md", "decisions": "decisions.md" },
  "phase": "plan",
  "created_at": "2026-10-31T...",
  "updated_at": "2026-10-31T..."
}
```

---

### Supporting Utilities (Local)

| Utility                                  | Purpose                                                     |
| ---------------------------------------- | ----------------------------------------------------------- |
| `./utils/dag.ts`                         | DAG analyzer for gate_level auto-assignment                 |
| `./utils/summarize.ts`                   | Smart context summarizer (preserves types/decisions/errors) |
| `./schemas/handoff.schema.json`          | Validates handoff.json structure                            |
| `./schemas/decision_request.schema.json` | Validates decision requests                                 |

## Handoff to implement-task

**implement-task reads:** `handoff.json` only (not plan.md directly)

**implement-task does NOT:**

- Make new decisions (resolved in decisions.md)
- Investigate codebase (done in plan-feature)
- Design test strategy (in plan.md)

---

## Adapting to Your Project

1. Copy to `.agents/skills/plan-feature/SKILL.md`
2. Configure in AGENTS.md:
   - Test commands (`pnpm test:unit`, `pnpm test:integration`)
   - Codebase investigation starting points
   - Decision categories for your stack
3. Reference from AGENTS.md index
