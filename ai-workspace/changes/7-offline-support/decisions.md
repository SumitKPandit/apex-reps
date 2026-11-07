# Decisions — Issue #7: Offline Support (PWA in scope)

Status: RESOLVED (user confirmed D1–D3; PWA added to scope, D4 resolved below)

---

### Decision D1: Sync queue implementation location — RESOLVED

**Choice:** Option A — new dedicated composable `app/composables/useSyncQueue.ts`.

**Rationale:** Single responsibility (write queue vs read cache), easier to unit test in isolation, keeps `useFoodCache.ts` focused on the read cache. Confirmed by user.

**Affects:** `app/composables/useSyncQueue.ts`, `app/stores/foodItem.ts`

---

### Decision D2: Mutations to queue for background sync — RESOLVED

**Choice:** Option A — `createCustomFood` only.

**Rationale:** Matches the IndexedDB food-cache focus of this issue, minimal surface area, easy to verify. Diet plan log sync deferred to a follow-up. Confirmed by user.

**Affects:** `app/stores/foodItem.ts`, `app/composables/useSyncQueue.ts`

---

### Decision D3: Offline UI behavior in `FoodSelector` — RESOLVED

**Choice:** Option A — allow add from cache (cached-results badge + offline chip).

**Rationale:** Best offline UX for a PWA; users can browse cached foods and add custom foods offline (queued for sync). Confirmed by user.

**Affects:** `app/components/diet-plan/FoodSelector.vue`

---

### Decision D4: PWA implementation approach — RESOLVED

**Context:** The app has no PWA artifacts. It's a Nuxt SPA (`ssr: false`) deployed statically to GitHub Pages. Options:

1. **Option A (recommended) — manual `public/manifest.json` + `public/sw.js` + `usePWA.ts` composable.** No extra build dependencies, full control over precaching/offline fallback, straightforward to host on GitHub Pages, easy to reason about and test.
2. Option B — `vite-plugin-pwa`. Auto-generates manifest + SW, but adds a build-step dependency and less transparent precaching behavior.
3. Option C — `@nuxtjs/pwa` module. Heavier, less actively maintained for Nuxt 4, more magic.

**Choice:** Option A — manual manifest + service worker + `usePWA.ts` composable.

**Rationale:** KISS, no new build deps, GitHub Pages friendly, full control, minimal and transparent.

**Affects:** `public/manifest.json`, `public/sw.js`, `app/composables/usePWA.ts`, app layout/entry (SW registration + manifest link)

---

### Scope change (user-directed)

**PWA moved from OUT of scope to IN scope.** Rationale: offline support is only usable if the app is installable as a PWA. Added Task 2 (manifest + SW + registration). Background Sync API (`sync` event when app closed) remains out of scope; app-level flush on reconnect covers the open-app case.
