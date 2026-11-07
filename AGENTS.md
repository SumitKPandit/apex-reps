# AGENTS.md — Project Memory

## Project

**Apex Reps** — Client-side fitness tracker (Nuxt 4 SPA, Supabase, GitHub Pages)

## Rules (Always Apply)

- **Minimal responses** — Fewest words needed. No fluff.
- **Update context in same session** as code changes.
- **Never assume** — If unsure, ask. Never decide without asking.
- **Human-readable artifacts** — All generated files (code, docs, reports, plans, handoffs) must be clear, well-structured, and comprehensible to humans. No machine-optimized or opaque formats.

## Coding Standards (Persist Across Sessions)

1. **TDD** — Write meaningful E2E/integration tests first, then implement
2. **No regressions** — Run existing tests before/after changes; guard existing flows
3. **Minimal/KISS/YAGNI/DRY/SOLID** — Reuse existing patterns (stores, components, utils), no over-engineering
4. **Readable/maintainable** — Clear types, small functions, consistent with codebase style
5. **Boy scout** — Improve touched files (types, comments, refactors where safe)
6. **No surprises** — Changes localized to feature area, follow existing conventions

## Context Index

| Domain                         | Reference                                |
| ------------------------------ | ---------------------------------------- |
| Database schema                | `ai-workspace/database/tables.md`        |
| RLS policies                   | `ai-workspace/database/rls-policies.md`  |
| Storage                        | `ai-workspace/database/storage.md`       |
| Migrations                     | `ai-workspace/database/migrations.md`    |
| Relationships                  | `ai-workspace/database/relationships.md` |
| C4 architecture diagrams       | `docs/c4/` (Levels 1–4)                  |
| **Workflow Skills** (in order) | `.agents/skills/`                        |
| 1. Plan feature                | `plan-feature`                           |
| 2. Implement task              | `implement-task`                         |
| 3. Review code                 | `review-code`                            |
| 4. Verify QA                   | `verify-qa`                              |
| 5. Maintain context            | `maintain-context`                       |

## Quick Refs (Always Needed)

### Pinia Stores

| Store          | Key Actions                                                            |
| -------------- | ---------------------------------------------------------------------- |
| `auth`         | `fetchSession()`, `login()`, `logout()`                                |
| `profile`      | `fetchProfile()`, `fetchMyMentees()`                                   |
| `stats`        | `fetchAllStats()`, `fetchLeftPhotos()`, `saveStatsAndPhotos()`         |
| `subscription` | `fetchActiveSubscription()`                                            |
| `plan`         | `fetchPlan(planId)`                                                    |
| `dietPlan`     | `fetchPlanForDate()`, `fetchLogs()`, `toggleConsumed()`, `saveNotes()`, `fetchMentees()`, `fetchCoachPlans()`, `createPlan()`, `updatePlan()`, `deletePlan()`, `fetchPlanForEdit()`, `fetchPlansForMentee()` |
| `foodItem`     | `searchFoods()`, `createCustomFood()`, `flushSyncQueue()`              |

### Commands

```bash
pnpm dev | build | generate | preview | lint | typecheck | test:unit | test:integration
supabase start | stop | db push | migration new | db reset | db query
npx playwright test | test --ui | test --debug
```

### GitHub CLI (gh)

```bash
gh issue list | view <num> | create
gh pr list | view <num> | create | merge | checkout
gh repo view | clone | fork
gh auth status | login | logout
gh workflow run | list | view
gh release create | list | view
```

**Common workflows:**

- Create issue: `gh issue create --title "Title" --body "Body" --label "bug,feature"`
- Create PR: `gh pr create --title "Title" --body "Body" --base main`
- View PR checks: `gh pr checks <num>`
- Merge PR: `gh pr merge <num> --squash --delete-branch`

### Env

| Var            | Source                  |
| -------------- | ----------------------- |
| `SUPABASE_URL` | `.env` / GitHub Secrets |
| `SUPABASE_KEY` | `.env` / GitHub Secrets |

### Quality Gates (All Must Pass)

| Check             | Command                       |
| ----------------- | ----------------------------- |
| Unit tests        | `pnpm test:unit --run`        |
| Integration tests | `pnpm test:integration --run` |
| E2E tests         | `pnpm test:e2e`               |
| Lint              | `pnpm lint`                   |
| Typecheck         | `pnpm typecheck`              |
| Format            | `pnpm format:check`           |
| Build             | `pnpm build`                  |

## Gotchas (Always Relevant)

1. Stats/photos immutable — no UPDATE/DELETE policies
2. `photos.user_id` redundant — enables direct RLS
3. Storage policies bucket-level — isolation via path prefix
4. BFP calculated client-side, stored in `stats.bfp`
5. Profile `sex`/`height` required for BFP
6. Left photo required (Zod + store validation)
7. **Local Supabase GoTrue**: `auth.users` nullable string cols must be non-NULL or login fails with "converting NULL to string is unsupported"
8. `food_items` macros per 100g; `diet_plan_food_items` stores calculated macros at creation
9. `diet_plans` unique on `(mentee_id, start_date)` — one active plan per mentee per date
10. `diet_plan_logs` unique on `(mentee_id, food_item_id, log_date)` — prevents duplicate consumption entries

## Files to Watch (Update Context When These Change)

- `supabase/migrations/*.sql` → update `ai-workspace/database/`
- `app/utils/bodyFat.ts` — formula changes affect all BFP
- `app/utils/image.ts` — compression params
- `app/utils/foodMacros.ts` — macro calculation logic
- `app/stores/stats.ts` — transactional logic
- `app/stores/foodItem.ts` — food search & custom food logic
- `app/stores/dietPlan.ts` — mentee plan tracking logic + coach CRUD actions
- `app/stores/profile.ts` — coach mentee fetching
- `app/utils/supabase.ts` — Supabase client creation, auth token handling
- `app/components/diet-plan/FoodSelector.vue` — autocomplete component
- `app/components/diet-plan/CustomFoodModal.vue` — custom food modal
- `app/components/BottomNav.vue` — mobile-only bottom navigation (Dashboard, Check-in, Diet Plan tabs)
- `app/composables/useFoodCache.ts` — IndexedDB caching
- `app/composables/useOnlineStatus.ts` — online/offline detection
- `app/composables/usePWA.ts` — service worker registration + install prompt
- `app/composables/useSyncQueue.ts` — IndexedDB sync queue for offline mutations
- `app/types/database.ts` — regenerate after migration
- `.agents/skills/*.md` — update when workflows change

## Detailed Context (Read When Working On Domain)

| Task                    | Read                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| Database work           | `ai-workspace/database/tables.md`, `relationships.md`, `rls-policies.md` |
| Auth/RLS                | `ai-workspace/database/rls-policies.md`                                  |
| Storage/photos          | `ai-workspace/database/storage.md`                                       |
| Store changes           | `ai-workspace/stores/` (if exists) or store source                       |
| **1. Plan feature**     | Skill: `plan-feature`                                                    |
| **2. Implement task**   | Skill: `implement-task`                                                  |
| **3. Review code**      | Skill: `review-code`                                                     |
| **4. Verify QA**        | Skill: `verify-qa`                                                       |
| **5. Maintain context** | Skill: `maintain-context`                                                |

## Test Users (Local Dev)

| Email              | Password           | Role    |
| ------------------ | ------------------ | ------- |
| test@example.com   | testpassword123    | mentee  |
| coach2@example.com | testpassword123    | coach   |
| mentee2@example.com| testpassword123    | mentee  |

Run SQL in `ai-workspace/database/migrations.md` after `supabase db reset`.

## Last Updated

2026-11-07
