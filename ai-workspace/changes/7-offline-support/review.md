# Code Review: Issue #7 — Offline Support (PWA)

**Reviewer:** implement-task agent (self-review)  
**Date:** 2026-11-06  
**PR/Task:** Issue #7 — Offline Support (PWA)  
**Commit:** 9ed11fe (main)  
**Rounds:** 2

---

## Checklist

| # | Category | Check | Pass | File:Line | Notes |
|---|----------|-------|------|-----------|-------|
| B1 | Intent Clarity | Names reveal purpose | ✅ | — | `useOnlineStatus`, `useSyncQueue`, `usePWA`, `flushSyncQueue`, `searchFromCache` — all self-describing |
| B2 | Type Safety | No `any`, explicit types | ✅ | — | `QueueItem`, `InstallPromptEvent`, explicit return types; typecheck passes |
| B3 | Error Handling | try/catch + logging + state | ✅ | — | All async wrapped; `this.error` set; `console.error`; optimistic offline path |
| B4 | Loading/Empty States | Loading + empty handled | ✅ | — | `loading` flag; offline chip; cached badge; empty results |
| B5 | Side Effects | No hidden mutations | ✅ | — | Optimistic update is intentional; stores own state |
| B6 | Resource Cleanup | Listeners/timers cleaned | ✅ | `app/composables/useOnlineStatus.ts` | Fixed round 2: returns `stop()` that removes `online`/`offline` listeners |
| B7 | Pattern Consistency | Follows project patterns | ✅ | — | Store/composable/layout conventions match AGENTS.md |
| B8 | No Dead Code | No commented/unused code | ✅ | — | No `console.log`, `TODO`, `FIXME`, or unused imports |
| B9 | Security | No injection/secrets | ✅ | — | Parameterized Supabase queries; no raw SQL |
| B10 | Accessibility | Semantic HTML/labels | ✅ | — | FoodSelector retains existing ARIA; chip/badge are presentational |

---

## Findings

### Strengths

- Clean separation of concerns: online status, sync queue, PWA registration, and store logic each in their own composable (D1 respected).
- Lazy composable accessors in `foodItem.store` avoid vitest hoisting/TDZ issues — thoughtful testing consideration.
- Graceful degradation everywhere: IndexedDB unavailable → memory-only; network failure → stale cache fallback; offline → optimistic create + queue.
- Live QA confirmed: food search, food add, custom food create all work end-to-end against real Supabase.

### Issues

**B6 FAIL — `useOnlineStatus` event listeners never removed** (`app/composables/useOnlineStatus.ts:28-29`)

`window.addEventListener("online", handleOnline)` and `("offline", handleOffline)` are registered but never removed. The composable returns only `{ isOnline }` with no cleanup mechanism. For a SPA session this is a minor leak (listeners die with the page), but it violates the B6 resource-cleanup standard and would compound if the composable is ever called multiple times.

**Expected fix:** Return an unsubscribe/stop function (e.g. `{ isOnline, stop }`) that calls `window.removeEventListener(...)`, and have callers invoke it on unmount. Alternatively guard with `onUnmounted` if used inside a component setup.

---

## Decision Compliance

| Decision | Choice | Followed? | Notes |
|----------|--------|-----------|-------|
| D1 | `useSyncQueue.ts` dedicated composable | ✅ | Created; single-responsibility write queue |
| D2 | `createCustomFood` only queued | ✅ | `flushSyncQueue` handles `createCustomFood` type |
| D3 | Offline UI allows add from cache | ✅ | Offline chip + "Showing cached results" badge |
| D4 | Manual manifest + SW + `usePWA.ts` | ✅ | `public/manifest.json`, `public/sw.js`, registration in default layout |

---

## Non-Blocking Items (N1–N7) — Logged as Follow-up Issues

| Item | Category | File:Line | Details | Action |
|------|----------|-----------|---------|--------|
| N4 | Documentation | `app/composables/useSyncQueue.ts` | No JSDoc on `flush` replay contract | Issue: add JSDoc to public composable methods |
| N6 | Naming Polish | `app/stores/foodItem.ts:43` | `searchFromCache` name is clear but slightly vague | Issue optional; acceptable as-is |

Non-blocking items never block approval. Logged above for tracking; no GitHub issues created in this session.

---

## Decision

**Round 1:** CHANGES_REQUESTED — B6 (event listener cleanup in `useOnlineStatus`) needed a fix.

**Round 2:** APPROVED — All blocking checklist items pass (B6 fixed: `stop()` returned to remove `online`/`offline` listeners; unit tests 3/3, lint clean, typecheck passes, build complete).

**Non-blocking:** N4 (JSDoc on `useSyncQueue.flush`), N6 (naming `searchFromCache`) — logged above, tracked as follow-up issues, do not block.

**Acceptance criteria:** MET (handoff.json scope.in complete: PWA manifest + SW, useOnlineStatus, IndexedDB cache wired to store, sync queue, offline UI, unit tests, quality gates).

**Next action:** APPROVED → proceed to verify-qa (black-box QA).
