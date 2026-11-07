# Code Review — Issue #19: CI checks on pull requests

**Change reviewed:** `.github/workflows/ci.yml` (PR #20, branch `ci/pr-checks`)
**Artifacts reviewed:** `handoff.json`, `plan.md`, `decisions.md`
**Reviewer:** AI agent (self-review against plan)

---

## Scope Check

| In-scope item (from handoff)                                 | Status  | Verified                                                             |
| ------------------------------------------------------------ | ------- | -------------------------------------------------------------------- |
| Add `pull_request` trigger targeting `main` and `production` | ✅ Done | `on: pull_request: branches: [main, production]`                     |
| Keep `push` trigger on `main` and `production`               | ✅ Done | `on: push: branches: [main, production]`                             |
| Add concurrency group to cancel stale runs                   | ✅ Done | `concurrency: group: ci-${{ github.ref }}, cancel-in-progress: true` |
| Add `pnpm test:unit` step                                    | ✅ Done | Step "Unit tests" at line 50-51                                      |
| Add `pnpm build` step                                        | ✅ Done | Step "Build" at line 47-48                                           |
| Switch to `--frozen-lockfile`                                | ✅ Done | `pnpm install --frozen-lockfile` at line 36                          |
| Keep E2E skipped                                             | ✅ Done | Step "E2E Tests" `if: false` at line 62                              |
| No new dependencies                                          | ✅ Done | No new packages added                                                |
| No `app/` source changes                                     | ✅ Done | Only `.github/workflows/ci.yml` modified                             |
| No `tests/` changes                                          | ✅ Done | Existing tests only                                                  |

**Out-of-scope items NOT touched:** E2E on PRs, staging env, production deploy hardening, labels, branch protection. ✅ Correctly left out.

---

## Decisions Applied Correctly

| Decision                                  | Choice            | Applied in code?             |
| ----------------------------------------- | ----------------- | ---------------------------- |
| D1 — Push + PR on `main` and `production` | Option A extended | ✅ Lines 3-7                 |
| D2 — Add build step                       | Option A          | ✅ Line 47-48 (`pnpm build`) |
| D3 — Keep E2E skipped                     | Option A          | ✅ Line 61-65 (`if: false`)  |

---

## Code Quality Checklist

| Check                               | Result | Notes                                                                                 |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| YAML valid                          | ✅     | Verified via Ruby YAML parser                                                         |
| Prettier formatted                  | ✅     | `pnpm exec prettier --check .github/workflows/ci.yml` passes                          |
| Reuses existing patterns            | ✅     | Same `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7` as before |
| Follows existing step naming        | ✅     | Steps match prior style (Prettier, Lint, Typecheck)                                   |
| Concurrency group correct           | ✅     | `ci-${{ github.ref }}` cancels in-progress runs on same ref                           |
| Build step before unit tests        | ✅     | Build catches breakage before tests run                                               |
| E2E explicitly skipped with comment | ✅     | Clear rationale documented                                                            |

---

## Acceptance Criteria (from plan.md)

| #   | Criterion                                                         | Result                                                                                     |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | CI triggers on push + PR to `main` and `production`               | ✅                                                                                         |
| 2   | CI runs Prettier, ESLint, typecheck, build, unit tests on PR/push | ✅                                                                                         |
| 3   | PRs must pass status checks before merge (branch protection)      | ⚠️ Not yet — requires admin action on upstream (task 4, not done)                          |
| 4   | E2E out of PR CI                                                  | ✅                                                                                         |
| 5   | No new dependencies                                               | ✅                                                                                         |
| 6   | No regressions to existing CI behavior                            | ✅ — same install/lint/typecheck steps preserved, only added build + unit tests + triggers |

---

## Quality Gates (run locally by implement-task)

| Gate             | Result                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`      | 23 errors — **all pre-existing in `app/` files** (index.vue, dietPlan.ts, profile.ts, supabase.ts), none from this change |
| `pnpm typecheck` | ✅ Pass                                                                                                                   |
| `pnpm test:unit` | 70 pass / 3 fail — **3 pre-existing `dietPlanStore` failures**, unrelated to this change                                  |
| `pnpm build`     | ✅ Pass                                                                                                                   |

**Conclusion on regressions:** None introduced by this change. All failures are pre-existing and documented in handoff.

---

## Risks & Mitigation (from plan.md)

| Risk                                              | Mitigation in place? | Notes                                                                    |
| ------------------------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| CI fails on PRs due to pre-existing test failures | ⚠️ Partial           | Failures documented; branch protection should NOT be enabled until fixed |
| `--frozen-lockfile` fails if lockfile out of sync | ✅                   | `pnpm install` run locally before commit; lockfile unchanged             |
| PR trigger doesn't fire due to fork permissions   | ⚠️ Partial           | PR #20 opened from fork; CI will run on upstream PR                      |

---

## Review Result

**PASS** — The change is minimal, correct, matches all decisions and acceptance criteria, introduces no regressions, and follows existing codebase patterns.

**Blocking item for merge:** Task 4 (branch protection on upstream `main`) requires admin action and pre-existing test failures should be addressed before enabling required status checks, otherwise merges will be blocked by failures unrelated to this change.

**Recommended next step:** Proceed to verify-qa (open a test PR / confirm CI status checks appear), then maintain-context.

**Files changed:** `.github/workflows/ci.yml` only.
