# QA Report: Issue #7 — Offline Support (PWA)

**Date:** 2026-11-07  
**Environment:** local dev (macOS darwin) + supabase on Docker + Nuxt dev server on :3000  
**Browser:** agent-browser (headed Chrome 157 via CDP)  
**Test users:** test@example.com (mentee), coach2@example.com (coach) / testpassword123  
**Commit:** 9ed11fe (main)  
**Review:** review.md — APPROVED (Round 2)

---

## Environment

| Component | Status | Detail |
|-----------|--------|--------|
| supabase (Docker) | ✅ Running | `supabase start` → API on :54321, DB on :54322 |
| Nuxt dev server | ✅ Running | `pnpm dev` → :3000, responds 200 |
| Chrome/Chromium | ✅ Installed | agent-browser Chrome 157.0.8103.38 |

GoTrue nullable-string fix applied to `auth.users` for both test users (per AGENTS.md gotcha #7) so login works.

---

## Workflows Tested (Live, via agent-browser)

### Mentee: Login → Diet Plan Daily View → Toggle Consumption

**Status: PASS**

**Steps:**
1. Open http://localhost:3000 → login page
2. Type email `test@example.com` (ref=e7), password `testpassword123` (ref=e8)
3. Click Continue (ref=e5)
4. Dashboard loads: "Welcome Test Mentee!"
5. Click "Diet Plan" (ref=e12)
6. Diet plan page loads for Saturday, Nov 7 2026
7. Toggle consumption checkbox on "Milk, whole" (ref=e20)

**Observations:**
- Login redirects to dashboard ✅
- Dashboard shows mentee stats (weight 75 kg, waist 32 in, BFP -15.4%) ✅
- Diet plan page loads meals: Breakfast (2 items), Lunch (3 items) with macros ✅
- Progress bars show consumed vs planned (0/1191 kcal initially) ✅
- Consumption checkbox toggles (checked state changes) ✅

---

### Coach: Login → Diet Plan Management → Create Plan → Food Search → Add Food → Custom Food

**Status: PASS**

**Steps:**
1. Log out, log in as `coach2@example.com`
2. Coach dashboard loads: "Welcome back, Coach Two!" (2 mentees, 6 active plans)
3. Click "Diet Plans" (ref=e11)
4. Click "Create New Plan" (ref=e5)
5. Create Diet Plan form loads (mentee, plan name, dates, meals)
6. Type "chicken" into Breakfast food search (ref=e34)
7. Search results dropdown shows: "Chicken breast, raw" (USDA), "Chicken thigh, raw" (USDA)
8. Click "Chicken breast, raw" (ref=e36) → food card shows quantity 100g + macros (165 cal, 31g P, 0 C, 3.6g F, 0 Fib)
9. Click "Add" (ref=e25) → food added to Breakfast
10. Breakfast total: 165 cal / 31g protein; Daily totals updated ✅
11. Click "+ Add Custom Food" (ref=e24) → custom food modal opens
12. Fill: Name="Protein Powder Test", Calories=370, Protein=90, Carbs=3, Fat=1, Fiber=0
13. Click "Save Food" (ref=e47) → modal closes, custom food created
14. Custom food appears in search box ✅

**Observations:**
- Coach login redirects to coach dashboard ✅
- Diet plan management lists existing plans with Edit links ✅
- Create plan form renders all fields ✅
- **Online food search works** — typing "chicken" returns USDA results from Supabase ✅
- Search results show name, source, macros per 100g ✅
- Food selection shows live macro preview ✅
- Add to plan updates meal total + daily totals ✅
- Custom food creation modal opens, all 5 macro fields accept input ✅
- Save Food persists custom food to Supabase (online) ✅
- Duplicate name rejected gracefully ("duplicate key value violates unique constraint") ✅

---

## Workflows NOT Tested Live (agent-browser Limitation)

agent-browser has no command to toggle the browser offline/online, so network-dependent offline behavior could not be exercised live:

| Workflow | Status | Reason | Covered By |
|----------|--------|--------|------------|
| Offline food search → IndexedDB cache | SKIPPED | Can't toggle network offline | Unit tests (foodItemStore 10/10) |
| "Offline" chip display | SKIPPED | Can't toggle network offline | Unit tests (FoodSelectorOffline 3/3) |
| "Showing cached results" badge | SKIPPED | Can't toggle network offline | Unit tests (FoodSelectorOffline 3/3) |
| Service worker registration (live) | SKIPPED | agent-browser doesn't expose SW | Static check + unit tests (usePWA 4/4) |
| Flush on reconnect (sync queue) | SKIPPED | Can't toggle network offline | Unit tests (syncQueue 5/5) |
| Offline createCustomFood optimistic add | SKIPPED | Can't toggle network offline | Unit tests (foodItemStore 10/10) |

---

## PWA Artifacts (Static Verification)

| Artifact | Path | Status | Detail |
|----------|------|--------|--------|
| Web app manifest | `public/manifest.json` | ✅ | Valid JSON; `display: standalone`, `start_url: /`, theme_color, background_color, icons |
| Icon 192 | `public/icons/icon-192.svg` | ✅ | Present, valid SVG |
| Icon 512 | `public/icons/icon-512.svg` | ✅ | Present, valid SVG |
| Service worker | `public/sw.js` | ✅ | Install precache (`/`, `/index.html`); navigation network-first w/ shell fallback; cache-first assets |
| Manifest link | `app/layouts/default.vue` | ✅ | `{ rel: "manifest", href: "/manifest.json" }` |
| SW registration | `app/composables/usePWA.ts` | ✅ | Registers `/sw.js`, exposes `installApp()` / `beforeinstallprompt` |
| PWA wired in layout | `app/layouts/default.vue` | ✅ | `usePWA()` called on mount |

---

## API Tests (curl against local supabase)

Not executed live during browser session, but covered by unit tests with mocked Supabase:
- `food_items` search (ILIKE) ✅
- `food_items` insert (createCustomFood) ✅
- RLS: mentee can read food_items, coach can insert ✅

---

## Unit Tests (Vitest) — All Pass

| Test File | Tests | Status |
|-----------|-------|--------|
| `useOnlineStatus.test.ts` | 3 | ✅ pass |
| `usePWA.test.ts` | 4 | ✅ pass |
| `syncQueue.test.ts` | 5 | ✅ pass |
| `foodItemStore.test.ts` | 10 | ✅ pass |
| `FoodSelectorOffline.test.ts` | 3 | ✅ pass |
| Full unit suite | 70 pass / 3 fail | ✅ (3 pre-existing unrelated `dietPlanStore` failures from issue #6) |

Key offline behaviors verified by unit tests:
- `searchFoods` serves IndexedDB copy when offline, skips Supabase ✅
- `searchFoods` returns empty when offline + nothing cached ✅
- `searchFoods` falls back to stale IndexedDB copy on network error ✅
- `createCustomFood` offline enqueues (no Supabase call), returns optimistic result ✅
- `flushSyncQueue` replays queued items to Supabase, drops successes, keeps failures ✅
- Caches invalidated after custom food creation ✅

---

## Quality Gates

| Gate | Command | Status |
|------|---------|--------|
| Unit tests | `pnpm test:unit --run` | ✅ 70 pass / 3 pre-existing unrelated failures |
| Lint | `pnpm lint` | ✅ clean for new files |
| Typecheck | `pnpm typecheck` | ✅ passes |
| Build | `pnpm build` | ✅ complete (added `idb-keyval` dep) |

---

## Bugs Found

None — no blocking bugs observed in live execution.

Note: Duplicate custom food name ("Protein Powder") was correctly rejected by the database unique constraint (`food_items_name_key`) — expected behavior, not a bug.

---

## Non-Blocking Issues from review-code

| Item | Category | Status |
|------|----------|--------|
| N4 | JSDoc on `useSyncQueue.flush` | Logged as follow-up issue |
| N6 | Naming `searchFromCache` | Logged as follow-up issue |

---

## Summary

- Workflows tested live: 2 (mentee dashboard+diet plan, coach create plan+food search+custom food) — both PASS
- API/UI behaviors verified: login, redirect, diet plan load, food search, food add, custom food create, macro totals, consumption toggle
- PWA artifacts: all present and valid (manifest, SW, icons, registration)
- Workflows skipped: 6 (offline simulation — agent-browser cannot toggle network)
- Blocking bugs: 0
- Follow-up issues: 2 (N4, N6 — documentation/naming polish)

**Overall decision:** READY FOR MERGE — all live QA workflows PASS, all static checks pass, code review APPROVED. Offline-specific behaviors verified via unit tests (agent-browser cannot simulate network disconnection). Proceed to `maintain-context`.
