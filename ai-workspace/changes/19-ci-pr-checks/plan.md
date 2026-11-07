# Plan — Issue #19: CI checks on pull requests

**Goal:** Run CI checks (Prettier, ESLint, Nuxt typecheck, Vitest unit tests) on every pull request to `main` so broken or unreviewed code cannot be merged.

**Issue:** https://github.com/mahima5srivastava/apex-reps/issues/19  
**Mode:** config  
**Branch to merge into:** `main`

---

## Acceptance Criteria

1. `.github/workflows/ci.yml` triggers on `push` and `pull_request` targeting `main` and `production`.
2. On every PR/push to `main` or `production`, CI runs: Prettier check, ESLint lint, Nuxt typecheck, `pnpm build`, Vitest unit tests.
3. PRs must pass all status checks before merge (GitHub branch protection — configure on upstream).
4. E2E tests remain out of PR CI (require Supabase — tracked in #10/#8).
5. No new dependencies added.
6. No regressions to existing CI behavior.

---

## Codebase Investigation

### Relevant Files

| File                           | Role                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- |
| `.github/workflows/ci.yml`     | CI workflow — currently `on: push` only, no `pull_request`             |
| `.github/workflows/deploy.yml` | Production deploy on `production` branch (unchanged by this issue)     |
| `package.json`                 | Scripts: `lint`, `typecheck`, `test:unit`, `test:integration`, `build` |
| `pnpm-lock.yaml`               | Lockfile used with `--frozen-lockfile` in CI                           |

### Existing Patterns Reused

| Pattern                                                          | Location              | Reuse For                                   |
| ---------------------------------------------------------------- | --------------------- | ------------------------------------------- |
| `pnpm/action-setup@v6` + `actions/setup-node@v7` + `cache: pnpm` | `ci.yml` lines 18–26  | Install step (already present)              |
| `pnpm exec prettier --check .`                                   | `ci.yml` line 31      | Prettier check (already present)            |
| `pnpm run lint`                                                  | `ci.yml` line 34      | ESLint (already present)                    |
| `pnpm run typecheck`                                             | `ci.yml` lines 36–37  | Nuxt typecheck (already present)            |
| `pnpm test:unit`                                                 | `package.json` script | Vitest unit tests (needs to be added to CI) |
| `actions/cache@v4` for Playwright                                | `ci.yml` lines 39–45  | Cache pattern (not needed for unit tests)   |

### Files to Modify

- `.github/workflows/ci.yml` — add `pull_request` trigger, concurrency group, unit-test step, `--frozen-lockfile`

### Files NOT Touched

- `.github/workflows/deploy.yml` — production deploy, out of scope for #19
- `app/` source code — no code changes needed
- `tests/` — no new tests needed (existing unit tests just need to run in CI)

---

## Decisions

### Decision D1: Run CI on `push` to `main` as well as PRs?

**Context:** Currently `ci.yml` has `on: push` (all branches). Issue #19 wants PR checks.

**Options:**

1. **Option A (recommended):** `on: push` branches: `[main]` + `on: pull_request` branches: `[main]`. Runs CI on both main pushes and PRs.
2. Option B: `on: pull_request` only. Removes CI on direct pushes to main.

**Recommendation:** Option A — keeps existing behavior for main branch while adding PR checks.

**Your call:** [ ]

---

### Decision D2: Add a build step (`pnpm build`) to CI?

**Context:** `ci.yml` currently has prettier, lint, typecheck, unit tests. No build step. `deploy.yml` runs `nuxt generate` (equivalent to build) but only for production deploys.

**Options:**

1. **Option A (recommended):** Add `pnpm build` (or `pnpm exec nuxt generate`) as a CI step. Catches build breakage before merge.
2. Option B: Skip build in CI; rely on deploy workflow to catch it.

**Recommendation:** Option A — fast feedback, build is static and quick.

**Your call:** [ ]

---

### Decision D3: Run E2E (Playwright) on PRs?

**Context:** E2E requires a running Supabase instance, which isn't available in PR CI. Already skipped via `if: false` in current `ci.yml`.

**Options:**

1. **Option A (recommended):** Keep E2E skipped in PR CI. Run E2E on staging/deploy (issue #10/#8).
2. Option B: Add mocked Supabase for E2E on PRs — significant effort, out of scope.

**Recommendation:** Option A — matches existing `if: false` skip and keeps PR CI fast.

**Your call:** [ ]

---

## Test Plan

| Test Type          | Scope                                                           | Written By     | Verified By                    |
| ------------------ | --------------------------------------------------------------- | -------------- | ------------------------------ |
| **Unit**           | Existing Vitest suite runs in CI via `pnpm test:unit`           | N/A (existing) | implement-task (quality gates) |
| **Integration**    | None — out of scope for CI config change                        | —              | —                              |
| **QA (black-box)** | Open a PR, confirm status checks appear and pass/fail correctly | verify-qa      | verify-qa (qa-report.md)       |

**QA checklist (verify-qa):**

- [ ] Open a PR to `main` → CI workflow triggers
- [ ] Prettier check runs on PR
- [ ] ESLint lint runs on PR
- [ ] Nuxt typecheck runs on PR
- [ ] Vitest unit tests run on PR
- [ ] Failing check blocks merge (status = failure)
- [ ] Passing check allows merge (status = success)
- [ ] Concurrency cancels stale runs on same PR

---

## Tasks

### Task 1: Update `.github/workflows/ci.yml` for PR triggers

**Type:** config  
**Depends on:** none  
**Gate Level:** strict

**Description:** Add `push` and `pull_request` triggers targeting `main` and `production`, add `concurrency` group, add build step (`pnpm build`) and unit-test step (`pnpm test:unit`), switch to `--frozen-lockfile`, keep E2E skipped.

**Files to modify:**

- `.github/workflows/ci.yml`

**Test first:** N/A (config change — verified by running quality gates locally + opening a test PR)

**Verification:**

- YAML valid (verified via parser)
- `pnpm lint` passes
- `pnpm typecheck` passes
- `pnpm test:unit` passes (existing suite, no regressions)
- `pnpm build` passes locally

**Rollback:** Revert `.github/workflows/ci.yml` to previous version.

---

### Task 2: Run quality gates on the CI change

**Type:** test  
**Depends on:** Task 1  
**Gate Level:** strict

**Description:** Run `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build` locally to confirm no regressions before committing.

**Verification:** All quality gates pass.

**Rollback:** Revert Task 1 changes.

---

### Task 3: Commit and open PR to upstream

**Type:** process  
**Depends on:** Task 2  
**Gate Level:** light

**Description:** Commit `.github/workflows/ci.yml` to your fork (`SumitKPandit/apex-reps`), open PR to `mahima5srivastava/apex-reps:main`, link issue #19.

**Verification:** PR is open and CI workflow file is present in the PR diff.

**Rollback:** Close PR without merging.

---

### Task 4: Configure branch protection on upstream (post-merge)

**Type:** process  
**Depends on:** Task 3 (merge)  
**Gate Level:** light

**Description:** On `mahima5srivastava/apex-reps`, enable branch protection for `main` requiring the CI status checks to pass before merge.

**Verification:** `main` branch protection requires CI checks.

**Rollback:** Disable branch protection.

**Note:** This requires admin access to upstream — you handle this directly.

---

## Risks & Rollback

| Risk                                                                            | Likelihood | Impact | Mitigation                                                         | Rollback                                |
| ------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------ | --------------------------------------- |
| CI fails on PRs due to pre-existing failures (e.g., 3 dietPlanStore unit tests) | Medium     | Medium | Verify failures are pre-existing before enabling branch protection | Disable branch protection, fix failures |
| `--frozen-lockfile` fails if lockfile out of sync                               | Low        | Medium | Run `pnpm install` locally to update lockfile before commit        | Revert to `pnpm install`                |
| PR trigger doesn't fire due to fork permissions                                 | Low        | Medium | Test with a real PR from fork                                      | Keep `push`-only trigger temporarily    |

---

## Out of Scope (explicitly)

- E2E Playwright tests on PRs (requires Supabase — issue #8/#10)
- Staging deployment environment (issue #10)
- Production deploy hardening / zero-downtime migrations (issue #9)
- New labels `ci`, `pr`, `quality-gates` on upstream (create manually — I lack label-create permission on upstream)

---

## Artifacts

| File           | Purpose                                     |
| -------------- | ------------------------------------------- |
| `plan.md`      | This file — scope, tasks, test plan, risks  |
| `decisions.md` | Resolved decisions (D1, D2, D3)             |
| `handoff.json` | Machine-readable handoff for implement-task |

**Phase:** plan  
**Next step:** implement-task reads `handoff.json` to execute Task 1.
