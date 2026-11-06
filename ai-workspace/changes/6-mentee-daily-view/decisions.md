# Decisions — Issue #6: Mentee Daily View

| # | Decision | Choice | Rationale | Affects |
|---|---|---|---|---|
| 1 | Bottom nav visibility | Mobile-only (hidden on desktop) | Bottom nav only on mobile viewport sizes; desktop keeps existing top header nav (Diet Plan link). Follows mobile-first pattern. | `app/components/BottomNav.vue`, `app/layouts/default.vue` |
| 1b | Bottom nav tabs | Dashboard + Check-in + Diet Plan (3 tabs) | Matches issue's "new bottom nav tab"; covers the three main mentee flows; KISS — no profile tab needed yet | `app/components/BottomNav.vue`, `app/layouts/default.vue` |
| 2 | Date picker | HTML5 `<input type="date">` (native) | No new dependencies, works natively on mobile (opens platform calendar), simple `min`/`max` for plan date range constraint | `app/pages/diet-plan.vue` |
| 3 | Collapsible meals | Simple Vue transition (`v-show` + CSS) | KISS — no UI library dependency, minimal bundle impact, easy to test | `app/pages/diet-plan.vue` |
| 4 | Component test stack | Vitest + @vue/test-utils (existing config) | Already configured in `vitest.config.ts`; consistent with existing store unit tests | `tests/unit/dietPlanPage.test.ts` |

**Decided by:** plan-feature skill (user confirmed options 1–3 via Q&A; option 4 is existing config)

**Notes:**
- Store layer (`dietPlan.ts`) already fully implements mentee actions — no store changes needed for issue #6.
- Existing `tests/unit/dietPlanStore.test.ts` already covers store actions; no additional store tests needed.
- Optimistic UI on `toggleConsumed` already implemented (local state updates synchronously with Supabase upsert).
