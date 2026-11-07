# Decisions — Issue #19: CI checks on pull requests

## D1: Run CI on `push` and `pull_request` on `main` and `production`

**Status:** resolved  
**Choice:** Option A extended — `on: push` branches: `[main, production]` + `on: pull_request` branches: `[main, production]`. CI runs on both branches for push and PR events.

**Rationale:** Keeps existing behavior while adding PR checks on both main and production branches.

**Affects:** `.github/workflows/ci.yml`

---

## D2: Add a build step (`pnpm build`) to CI?

**Status:** resolved  
**Choice:** Option A — add `pnpm build` as a CI step.

**Rationale:** Fast feedback, build is static and quick; catches build breakage before merge.

**Affects:** `.github/workflows/ci.yml`

---

## D3: Run E2E (Playwright) on PRs?

**Status:** resolved  
**Choice:** Option A — keep E2E skipped (`if: false`).

**Rationale:** E2E requires Supabase; run on staging/deploy instead (issue #10/#8).

**Affects:** `.github/workflows/ci.yml`

---

## Summary

| Decision                            | Choice            | Status   |
| ----------------------------------- | ----------------- | -------- |
| D1 — Push + PR on main & production | Option A extended | resolved |
| D2 — Build step                     | Option A          | resolved |
| D3 — E2E on PRs                     | Option A          | resolved |
