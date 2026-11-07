# Plan — Issue #7: Offline Support (IndexedDB Cache, Background Sync + PWA)

**Goal:** Make Apex Reps installable and usable offline as a PWA: the app shell loads without network, food search is served from an IndexedDB cache when offline, custom foods can be added offline and sync on reconnect, and the UI shows offline/cached state.

**Scope (in):**

- PWA: web app manifest (`manifest.json`), service worker (`sw.js`) for shell precaching + offline fallback, registration via composable.
- `useOnlineStatus` composable for online/offline detection.
- Wire `useFoodCache` (IndexedDB, already exists) into `foodItem` store so `searchFoods` results persist across reloads and are served when offline.
- Background sync queue: IndexedDB-persisted queue for `createCustomFood`; enqueue while offline, flush on reconnect.
- Offline UI in `FoodSelector` (cached-results badge + offline chip, add from cache).
- Unit tests for all of the above; run all quality gates; no regressions.

**Scope (out):**

- Background Sync API (`sync` event) when app is closed — app-level flush on reconnect covers the open-app case; defer true background sync to a follow-up.
- Full offline-first diet plan editing (diet plan reads/writes).
- E2E Playwright tests (Issue #8).

---

## Codebase Investigation

| Pattern / Artifact                                                                                       | Location                                    | Reuse For                      |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------ |
| `useFoodCache` composable (IndexedDB via `@vueuse/integrations useIDBKeyval`, 24h TTL, graceful failure) | `app/composables/useFoodCache.ts`           | Persistent food search cache   |
| In-memory `searchCache` Map + `searchFoods` / `createCustomFood`                                         | `app/stores/foodItem.ts`                    | Extend to read/write IndexedDB |
| `FoodSelector` calls `store.searchFoods` on debounced input; shows loading + error                       | `app/components/diet-plan/FoodSelector.vue` | Add offline/cached UI          |
| Store unit test pattern (mock `@/utils/supabase`, `setActivePinia(createPinia())`)                       | `tests/unit/foodItemStore.test.ts`          | Template for new unit tests    |
| Vitest config (jsdom, `tests/**/*.test.ts`)                                                              | `vitest.config.ts`                          | Test runner setup              |
| `getSupabase()` helper                                                                                   | `app/utils/supabase.ts`                     | Supabase client for writes     |
| `nuxt.config.ts` — `ssr: false`, static-ready for GitHub Pages; `nitro.prerender` only `/`               | `nuxt.config.ts`                            | PWA deployment target          |
| No existing manifest, service worker, workbox, or PWA module                                             | —                                           | PWA is greenfield              |

**Placement decisions:**

| New Code                     | Expected Location                                                                                                                            | Reason                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Web app manifest             | `public/manifest.json`                                                                                                                       | Static asset, served at root for GitHub Pages                      |
| Service worker               | `public/sw.js`                                                                                                                               | Static asset, controls shell + offline fallback                    |
| PWA registration composable  | `app/composables/usePWA.ts`                                                                                                                  | Register SW, expose install prompt; co-located with `useFoodCache` |
| `useOnlineStatus` composable | `app/composables/useOnlineStatus.ts`                                                                                                         | Reactive online/offline state                                      |
| Sync queue                   | `app/composables/useSyncQueue.ts`                                                                                                            | Single responsibility; IndexedDB-persisted queue                   |
| Offline cache integration    | `app/stores/foodItem.ts`                                                                                                                     | Existing store; follow its action pattern                          |
| Offline UI in selector       | `app/components/diet-plan/FoodSelector.vue`                                                                                                  | Existing component; minimal additions                              |
| Unit tests                   | `tests/unit/usePWA.test.ts`, `useOnlineStatus.test.ts`, `foodItemStore.test.ts` (extend), `syncQueue.test.ts`, `FoodSelectorOffline.test.ts` | Follow existing test file naming                                   |

---

## Test Plan (Test-First)

| Test Type      | Scope                                                                                   | Written By     | Verified By   |
| -------------- | --------------------------------------------------------------------------------------- | -------------- | ------------- |
| Unit           | `useOnlineStatus` — online/offline state, SSR-safe                                      | implement-task | quality gates |
| Unit           | `usePWA` — SW registration, install prompt                                              | implement-task | quality gates |
| Unit           | `foodItemStore.searchFoods` reads/writes IndexedDB cache, serves cached results offline | implement-task | quality gates |
| Unit           | Sync queue — enqueue `createCustomFood` offline, flush on reconnect                     | implement-task | quality gates |
| Unit/Component | `FoodSelector` shows cached results + offline chip when offline                         | implement-task | quality gates |

---

## Tasks

### Task 1: Add `useOnlineStatus` composable + unit test — DONE

**Type:** composable  
**Depends on:** none  
**Gate Level:** strict  
**Description:** Create `app/composables/useOnlineStatus.ts` exposing a reactive `isOnline` (wired to `navigator.onLine` + `online`/`offline` events, SSR-safe). Add `tests/unit/useOnlineStatus.test.ts`.  
**Files:** created `app/composables/useOnlineStatus.ts`; created `tests/unit/useOnlineStatus.test.ts`  
**Test first:** Unit test for online/offline toggling.  
**Verification:** `isOnline` flips on `online`/`offline` events; safe under SSR (no window).  
**Test results:** 3/3 pass.  
**Quality gates:** lint clean; typecheck passes; build complete; unit suite 52 pass / 3 fail (3 pre-existing unrelated dietPlanStore failures).

### Task 2: PWA manifest + service worker + registration + unit test — DONE

**Type:** pwa  
**Depends on:** none  
**Gate Level:** strict  
**Description:** Add `public/manifest.json` (name, icons, start_url, display: standalone) and `public/sw.js` (precache app shell, offline fallback route). Create `app/composables/usePWA.ts` to register the SW and expose the install prompt. Add `tests/unit/usePWA.test.ts`. Update `app/layouts/default.vue` or `app/app.vue` to register on mount and add manifest link to `app/head` equivalent.  
**Files:** create `public/manifest.json`; create `public/sw.js`; create `app/composables/usePWA.ts`; create `tests/unit/usePWA.test.ts`; modify layout/app to register SW + manifest link  
**Test first:** Unit test that SW registers (mock serviceWorker) and install prompt is exposed.  
**Verification:** Manifest valid; SW registers; app loads offline (shell served from cache); install prompt available.  
**Rollback:** Remove public files, composable, and layout registration.

### Task 3: Wire IndexedDB cache into `foodItem.store` + unit test — DONE

**Type:** store  
**Depends on:** Task 1  
**Gate Level:** standard  
**Description:** Extend `searchFoods` to (a) check IndexedDB via `useFoodCache.get` before Supabase when offline/cache miss, (b) write successful results to `useFoodCache.set`. Serve stale/valid cached results when offline.  
**Files:** modified `app/stores/foodItem.ts`; rewrote `tests/unit/foodItemStore.test.ts`  
**Test first:** Unit test that offline search returns cached IndexedDB results and does not call Supabase.  
**Verification:** Cached results persist across reload; offline search returns cache; network error falls back to cache gracefully.  
**Test results:** 8/8 new tests pass.  
**Quality gates:** lint clean; typecheck passes; build complete (added `idb-keyval` dep required by `@vueuse/integrations` `useIDBKeyval`); unit suite 60 pass / 3 fail (3 pre-existing unrelated dietPlanStore failures).

### Task 4: Background sync queue for `createCustomFood` + unit test — DONE

**Type:** store/composable  
**Depends on:** Task 1  
**Gate Level:** standard  
**Description:** Add an IndexedDB-persisted sync queue (`useSyncQueue.ts`). When `createCustomFood` is called while offline, enqueue the payload and return optimistically; flush the queue (replay to Supabase) when `isOnline` becomes true.  
**Files:** created `app/composables/useSyncQueue.ts`; created `tests/unit/syncQueue.test.ts`; modified `app/stores/foodItem.ts` (offline enqueue + `flushSyncQueue` action); extended `tests/unit/foodItemStore.test.ts`  
**Test first:** Unit test that offline create enqueues and reconnect flushes to Supabase.  
**Verification:** Offline `createCustomFood` succeeds without network; on reconnect the item is inserted.  
**Test results:** syncQueue 5/5 pass; foodItemStore 10/10 pass (2 new offline tests).  
**Quality gates:** lint clean; typecheck passes; build complete; unit suite 67 pass / 3 fail (3 pre-existing unrelated dietPlanStore failures).

### Task 5: Offline UI in `FoodSelector` + component test — DONE

**Type:** component  
**Depends on:** Task 3, Task 4  
**Gate Level:** standard  
**Description:** Show an "offline" chip when `isOnline` is false (via `useOnlineStatus`) and a "Showing cached results" badge when `store.searchFromCache` is true. Added `searchFromCache` tracking to `foodItem.store` (IndexedDB hit / stale fallback = true; network/in-memory/empty = false).  
**Files:** modified `app/components/diet-plan/FoodSelector.vue` (offline chip + cached badge); modified `app/stores/foodItem.ts` (searchFromCache state); created `tests/unit/FoodSelectorOffline.test.ts`  
**Test first:** Component test for offline chip + cached badge.  
**Verification:** Offline chip shows when disconnected; cached badge shows when served from IndexedDB.  
**Test results:** 3/3 pass.  
**Quality gates:** lint clean (only pre-existing warnings); typecheck passes; build complete; unit suite 70 pass / 3 fail (3 pre-existing unrelated dietPlanStore failures).

### Task 6: Run quality gates + verify no regressions — DONE

**Type:** verification  
**Depends on:** Tasks 1–5  
**Gate Level:** light  
**Description:** Run `test:unit`, `lint`, `typecheck`, `format:check`, `build`. Confirm no regressions vs main.  
**Verification:** All gates pass; `test:unit` 70 pass / 3 fail (3 pre-existing unrelated dietPlanStore failures noted in issue #6 handoff).  
**Rollback:** N/A (verification only).

---

## Risks & Rollback

| Risk                                                  | Likelihood | Impact | Mitigation                                                 | Rollback                               |
| ----------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------- | -------------------------------------- |
| IndexedDB unavailable (private browsing) breaks cache | Medium     | Medium | `useFoodCache` already fails gracefully (try/catch → null) | Store falls back to Supabase/in-memory |
| SW precache stale after deploy                        | Medium     | Low    | Version/cache-bust `sw.js`; users reload on new version    | Unregister SW, redeploy                |
| Sync queue duplicate `createCustomFood` on flush      | Low        | Medium | Guard by idempotency; rely on Supabase `name` uniqueness   | Clear queue, surface error             |
| PWA install not offered on some browsers              | Low        | Low    | Manifest + beforeinstallprompt handled gracefully          | N/A                                    |

---

## Decisions (resolved — see decisions.md)

- D1: Sync queue → dedicated `useSyncQueue.ts` composable ✅
- D2: Mutations to queue → `createCustomFood` only ✅
- D3: Offline UI → allow add from cache (badge + chip) ✅
- D4: PWA approach → manual `public/manifest.json` + `public/sw.js` + `usePWA.ts` composable (no extra build deps, full control, GitHub Pages friendly) ✅
