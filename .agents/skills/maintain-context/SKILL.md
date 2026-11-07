---
name: maintain-context
description: "Final step: update AGENTS.md and workspace docs after feature completion. Reads qa-report.md, handoff.json, review.md. Updates quick refs, domain docs, archives change folder. Fifth step: plan-feature → implement-task → review-code → verify-qa → maintain-context."
---

# Maintain Context Skill

## Purpose

Update project documentation after feature completion. **Fifth and final step** in workflow. Reads verification outputs, updates AGENTS.md quick refs and workspace domain docs, archives change folder.

**Human-Readable Output:** All docs use consistent structure, clear headings, tables for reference data, and cross-links. No duplication. A new team member can navigate context in 10 minutes.

## When to Use

- After `verify-qa` completes (qa-report.md exists with PASS)
- After `review-code` approves (review.md exists with APPROVED)
- When feature is ready for merge/deploy

## Workflow Position

```
plan-feature → implement-task → review-code → verify-qa → maintain-context
     │              │               │            │              │
   plan.md      code + tests    reviews      qa-report.md  updates
   created      passing gates   code,        created       AGENTS.md,
   tasks        (unit/integ)    outputs      verify-qa     workspace/
   defined      self-reviewed   review.md    executes      from
   decisions    done            (APPROVED)   workflows     handoff.json
                                    │
                              review.md
                              (APPROVED)
                                    │
                              qa-report.md
                              (PASS)
```

## Inputs (Read)

- `qa-report.md` — final QA status, workflows tested, bugs found
- `review.md` — code quality approval, non-blocking issues
- `handoff.json` — what was implemented, decisions, scope, tasks
- Implementation code — new patterns, stores, components, types

**Never reads:** `plan.md`, `review-1.md`, `review-2.md` — only `handoff.json`, `review.md`, `qa-report.md` are canonical.

### Supporting Schema (Local)

| Schema                          | Purpose                          |
| ------------------------------- | -------------------------------- |
| `./schemas/handoff.schema.json` | Validates handoff.json structure |

## Anti-Loop Guardrails

| Guardrail           | Rule                                             |
| ------------------- | ------------------------------------------------ |
| **Single pass**     | Update docs once per feature completion          |
| **No code changes** | maintain-context NEVER modifies implementation   |
| **Source of truth** | AGENTS.md = quick refs only; workspace = details |
| **Exit criteria**   | All doc updates done → feature complete          |

---

## Update Checklist (Binary Done/Not Done)

### AGENTS.md Quick Refs (Always Needed)

| Section              | Update If                                        |
| -------------------- | ------------------------------------------------ |
| **Pinia Stores**     | New store added or new actions on existing store |
| **Commands**         | New npm/pnpm/supabase/playwright commands        |
| **Env**              | New environment variables                        |
| **Gotchas**          | New gotcha discovered during implementation      |
| **Files to Watch**   | New files that affect context when changed       |
| **Detailed Context** | New task types added to workflow                 |
| **Test User**        | Credentials changed                              |

### Workspace Domain Docs (Detailed)

| File                                     | Update If                                     |
| ---------------------------------------- | --------------------------------------------- |
| `ai-workspace/database/tables.md`        | Schema changes (new tables, columns, indexes) |
| `ai-workspace/database/relationships.md` | New FKs, cascade rules, FK diagrams           |
| `ai-workspace/database/rls-policies.md`  | New policies, policy changes                  |
| `ai-workspace/database/storage.md`       | New buckets, path patterns, policies          |
| `ai-workspace/database/migrations.md`    | New migration added, patterns                 |
| `ai-workspace/stores/<store>.md`         | New store or significant action changes       |
| `ai-workspace/components/README.md`      | New component patterns, conventions           |
| `ai-workspace/utils/README.md`           | New utility functions, patterns               |
| `ai-workspace/infra/`                    | CI, deploy, env changes                       |

---

## Update Process

```
1. READ VERIFICATION OUTPUTS
   ├─ qa-report.md — what worked, what didn't
   ├─ review.md — code quality status, non-blocking issues
   └─ handoff.json — what was implemented, decisions, scope, tasks

2. UPDATE AGENTS.MD (Quick Refs)
   ├─ Add new store actions to Pinia Stores table
   ├─ Add new commands to Commands section
   ├─ Add new env vars to Env table
   ├─ Append new gotchas to Gotchas list
   ├─ Add new files to Files to Watch
   └─ Update Detailed Context table if new task types

3. UPDATE WORKSPACE DOCS (Detailed)
   ├─ tables.md — new/changed tables with columns, constraints
   ├─ rls-policies.md — new/changed policies per table
   ├─ relationships.md — updated FK diagram
   ├─ migrations.md — new migration entry
   ├─ stores/<store>.md — actions, patterns, usage
   └─ components/README.md — new components, patterns

4. CROSS-LINK
   ├─ AGENTS.md points to workspace files
   ├─ Workspace files link to each other
   └─ Change folder has all artifacts

5. ARCHIVE CHANGE FOLDER
   ├─ Ensure all files present: plan.md, decisions.md, review.md, qa-report.md, handoff.json
   ├─ Mark plan.md status: "Done"
   └─ Folder stays in ai-workspace/changes/ for history

6. VERIFY
   ├─ AGENTS.md ≤ 100 lines
   ├─ No duplication: AGENTS.md summarizes, workspace details
   ├─ All cross-links valid (AGENTS.md → workspace, workspace ↔ workspace)
   └─ Context index current
```

---

## AGENTS.md Update Patterns

### Adding Store Actions

```markdown
### Pinia Stores

| Store      | Key Actions                                                            |
| ---------- | ---------------------------------------------------------------------- |
| `dietPlan` | `fetchPlanForDate()`, `fetchLogs()`, `toggleConsumed()`, `saveNotes()` |
| `foodItem` | `searchFoods()`, `createCustomFood()`                                  |
```

### Adding Gotcha

```markdown
## Gotchas (Always Relevant)

... 10. `diet_plan_logs` unique on `(mentee_id, food_item_id, log_date)` — prevents duplicate consumption entries
```

### Adding Command

````markdown
### Commands

```bash
pnpm dev | build | generate | preview | lint | typecheck
supabase start | stop | db push | migration new | db reset | db query
npx playwright test | test --ui | test --debug
pnpm test:unit --run | test:integration --run
```
````

### Adding File to Watch

```markdown
## Files to Watch (Update Context When These Change)

- `supabase/migrations/*.sql` → update `ai-workspace/database/`
- `app/utils/bodyFat.ts` — formula changes affect all BFP
- `app/utils/image.ts` — compression params
- `app/utils/foodMacros.ts` — macro calculation logic
- `app/stores/stats.ts` — transactional logic
- `app/stores/foodItem.ts` — food search & custom food logic
- `app/stores/dietPlan.ts` — mentee plan tracking logic
- `app/components/diet-plan/FoodSelector.vue` — autocomplete component
- `app/components/diet-plan/CustomFoodModal.vue` — custom food modal
- `app/composables/useFoodCache.ts` — IndexedDB caching
- `app/types/database.ts` — regenerate after migration
- `.agents/skills/*.md` — update when workflows change
```

---

## Workspace Update Patterns

### tables.md — New Table Entry

```markdown
## `diet_plan_logs`

Mentee consumption tracking per date.

| Column         | Type          | Constraints                                       | Default             | Description           |
| -------------- | ------------- | ------------------------------------------------- | ------------------- | --------------------- |
| `id`           | `uuid`        | PK                                                | `gen_random_uuid()` | Unique log ID         |
| `mentee_id`    | `uuid`        | NOT NULL, FK → `profiles(id)` CASCADE             | —                   | Mentee user           |
| `diet_plan_id` | `uuid`        | NOT NULL, FK → `diet_plans(id)` CASCADE           | —                   | Plan reference        |
| `food_item_id` | `uuid`        | NOT NULL, FK → `diet_plan_food_items(id)` CASCADE | —                   | Food item             |
| `log_date`     | `date`        | NOT NULL                                          | —                   | Date of consumption   |
| `consumed`     | `boolean`     | NOT NULL                                          | `false`             | Whether consumed      |
| `consumed_at`  | `timestamptz` | —                                                 | —                   | Timestamp when marked |
| `created_at`   | `timestamptz` | NOT NULL                                          | `now()`             |                       |
| `updated_at`   | `timestamptz` | NOT NULL                                          | `now()`             |                       |

**Indexes:** PK on `id`, FKs, unique on `(mentee_id, food_item_id, log_date)`

**RLS Policies:** See [rls-policies.md](./rls-policies.md#diet_plan_logs)
```

### rls-policies.md — New Policy Entry

```markdown
## `diet_plan_logs`

| Policy                        | Command  | Role            | Condition                                                                                      |
| ----------------------------- | -------- | --------------- | ---------------------------------------------------------------------------------------------- |
| `diet_plan_logs_mentee_crud`  | `ALL`    | `authenticated` | `auth.uid() = mentee_id`                                                                       |
| `diet_plan_logs_coach_select` | `SELECT` | `authenticated` | `EXISTS (SELECT 1 FROM diet_plans dp WHERE dp.id = diet_plan_id AND dp.coach_id = auth.uid())` |
```

### stores/foodItem.md — New Store Doc

````markdown
# Food Item Store (`useFoodItemStore`)

## State

- `searchResults: FoodItemSearchResult[]` — Current search results
- `searchCache: Map<string, { data, timestamp }>` — In-memory cache with TTL
- `loading: boolean` — Search in progress
- `error: string | null` — Last error message

## Getters

| Getter      | Returns          | Description        |
| ----------- | ---------------- | ------------------ |
| `isLoading` | `boolean`        | `loading` state    |
| `lastError` | `string \| null` | Last error message |

## Actions

| Action             | Params                   | Returns                           | Description                                                 |
| ------------------ | ------------------------ | --------------------------------- | ----------------------------------------------------------- |
| `searchFoods`      | `query: string`          | `Promise<FoodItemSearchResult[]>` | Searches food_items with ILIKE, debounced 300ms, cached 24h |
| `createCustomFood` | `input: CustomFoodInput` | `Promise<FoodItemSearchResult>`   | Inserts food as `source='custom'`, clears cache             |
| `clearCache`       | —                        | `void`                            | Clears in-memory search cache                               |

## Types

```typescript
interface FoodItemSearchResult {
  id: string;
  name: string;
  calories_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fiber_g_per_100g: number;
  source: "usda" | "custom";
}

interface CustomFoodInput {
  name: string;
  calories_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fiber_g_per_100g: number;
}
```
````

## Patterns

- **Debounced search**: 300ms debounce via `setTimeout` in `handleSearch()`
- **In-memory cache**: Map with 24h TTL, keyed by normalized query
- **Cache invalidation**: `createCustomFood()` clears entire cache
- **Error handling**: Try/catch with `error` state, logs to console, re-throws
- **Loading state**: `loading` true during async operations
- **Auth check**: `createCustomFood()` verifies `supabase.auth.getUser()`

## Usage

```typescript
const store = useFoodItemStore();

// Search
const results = await store.searchFoods("chicken");

// Create custom food
const food = await store.createCustomFood({
  name: "Whey Isolate",
  calories_per_100g: 370,
  protein_g_per_100g: 90,
  carbs_g_per_100g: 3,
  fat_g_per_100g: 1,
  fiber_g_per_100g: 0,
});

// Access cached results
const cached = store.searchResults;
```

## Composables

- `useFoodCache()` — IndexedDB caching via `@vueuse/integrations/useIDBKeyval`
- `useDebounce(fn, delay)` — Debounce utility

## Testing

- Unit: `tests/unit/foodItemStore.test.ts` (4 tests, mock Supabase)
- Integration: `tests/integration/foodItemStore.test.ts` (TODO)
- E2E: `tests/food-database.spec.ts` (search, custom food, RLS)

## RLS Enforcement

- **SELECT**: All authenticated users (policy: `food_items_select_all_authenticated`)
- **INSERT**: Coach only (policy: `food_items_insert_coach`)
- **UPDATE/DELETE**: Creator only (policies: `food_items_update_creator`, `food_items_delete_creator`)

Verified in unit tests with mock auth contexts.

```

---

## Change Folder Final State

```

ai-workspace/changes/<issue-id>-<slug>/
├── plan.md # Status: Done
├── decisions.md # Resolved decisions
├── review.md # Single file with round history
├── qa-report.md # QA PASS with summary
├── handoff.json # Final handoff state
└── notes.md # Optional scratchpad

```

---

## Verification Before Complete

- [ ] AGENTS.md ≤ 100 lines
- [ ] No duplication: AGENTS.md summarizes, workspace details
- [ ] All cross-links valid (AGENTS.md → workspace, workspace ↔ workspace)
- [ ] Context index in AGENTS.md current
- [ ] Change folder has all artifacts
- [ ] plan.md status = "Done"

---

## Adapting to Your Project

1. Copy to `.agents/skills/maintain-context/SKILL.md`
2. Configure in AGENTS.md:
   - Workspace structure (folders, files)
   - Quick ref sections relevant to your project
   - Doc update triggers specific to your stack
3. Reference from AGENTS.md index

---

## Usage in Agent Session

```

User: "Update context after Diet Plan feature (issue #4)"

Agent:

1. READS: qa-report.md (PASS), review.md (APPROVED), handoff.json (what was implemented)
2. UPDATES AGENTS.md:
   - Adds dietPlan, foodItem stores to Pinia Stores table
   - Adds gotcha #10 about diet_plan_logs unique constraint
   - Adds test:unit, test:integration commands
3. UPDATES WORKSPACE:
   - tables.md: adds diet_plans, diet_plan_meals, diet_plan_food_items, diet_plan_logs, diet_plan_notes
   - rls-policies.md: adds policies for 5 new tables
   - relationships.md: updates FK diagram
   - migrations.md: adds 20261031120000_diet_plan_schema.sql entry
   - stores/dietPlan.md: new store doc with actions
   - stores/foodItem.md: new store doc with actions
4. VERIFIES: AGENTS.md < 100 lines, cross-links valid
5. ARCHIVES: ai-workspace/changes/4-food-database-selector/ complete
6. REPORTS: "Context updated. AGENTS.md + workspace docs current. Change folder archived. Feature complete."

```

```
