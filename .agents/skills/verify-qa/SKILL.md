---
name: verify-qa
description: "Black-box QA verification. Agent drives the application like a real user through agent-browser (headed Chrome via CDP) — clicking, typing, navigating — and verifies behavior end-to-end. Does NOT write test scripts. Fourth step: plan-feature → implement-task → review-code → verify-qa → maintain-context. Reads handoff.json + review.md, outputs qa-report.md."
---

# Verify QA Skill

## Purpose

**Black-box QA verification** — test the application from the outside like a real QA engineer. **Fourth step** in workflow. Runs the app, executes user workflows, verifies API, checks database. No test code writing.

**Browser tool:** `agent-browser` (https://agent-browser.dev) — a headed Chrome automation CLI for AI agents. Returns a compact accessibility tree with deterministic element refs (`@e1`, `@e2`, …), so the agent inspects exactly what a user sees, with low token cost.

**Human-Readable Output:** QA reports use clear workflow tables, plain-language observations, severity-ranked bugs, and cross-verification matrices. No raw logs or machine formats. A human can triage findings in minutes.

## When to Use

- After `review-code` approves (review.md exists with APPROVED)
- Before `maintain-context` (final docs update)
- When implementation is complete and code-reviewed

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
```

## Inputs (Read)

- `review.md` — approval decision, known non-blocking issues
- `handoff.json` — scope.in (what to test), scope.out (what to skip), acceptance criteria
- AGENTS.md — dev commands, test users, environment config

**Never reads:** `plan.md`, `REQUIREMENTS.md` — only `handoff.json` is canonical.

## Anti-Loop Guardrails

| Guardrail           | Rule                                                          |
| ------------------- | ------------------------------------------------------------- |
| **Single pass**     | Execute workflows once, document findings                     |
| **No code changes** | verify-qa NEVER modifies code                                 |
| **Bugs → issues**   | Failed workflows → GitHub issues, not code fixes              |
| **Exit criteria**   | All critical workflows PASS → qa-report.md → maintain-context |
| **Timebox**         | 60 min per feature                                            |

### Supporting Schemas (Local)

| Schema                                   | Purpose                          |
| ---------------------------------------- | -------------------------------- |
| `./schemas/handoff.schema.json`          | Validates handoff.json structure |
| `./schemas/decision_request.schema.json` | Validates decision requests      |

**Definition of QA Pass:**

```
✅ All critical workflows PASS (from handoff.json scope.in)
✅ API endpoints return correct status/shape
✅ RLS policies enforced
✅ Database state matches UI/API
✅ No blocking bugs (critical/major severity)
```

Minor UX issues → follow-up issues, don't block.

---

## Fast-Fail Configuration (Required)

### agent-browser setup (one-time)

```bash
# Install Chrome (first time only; cached after)
npx agent-browser install
```

### Launch a headed Chrome session against the dev server

```bash
# agent-browser opens a real Chrome window connected to your dev server
npx agent-browser open http://localhost:3000

# The daemon persists between commands — no need to re-open per action
```

**Why agent-browser instead of Playwright:**

- Real Chrome via Chrome DevTools Protocol (CDP), not a headless test runner
- Compact accessibility-tree snapshots (~200-400 tokens) instead of full DOM (~3000-5000 tokens)
- Deterministic element refs (`@e5`, `@e12`) — click/type by ref, no flaky CSS selectors
- Stateful session: the daemon keeps Chrome alive between commands
- Headed browsers are exempt from the default idle timeout (good for interactive QA)
- Built-in screenshots, video, network, and storage inspection

**agent-browser commands used in QA:**

| Command                                   | Purpose                                                 |
| ----------------------------------------- | ------------------------------------------------------- |
| `npx agent-browser open <url>`            | Open Chrome to a URL (starts session)                   |
| `npx agent-browser snapshot`              | Get accessibility tree with refs — "what the user sees" |
| `npx agent-browser click @ref`            | Click a button/link/input by ref                        |
| `npx agent-browser type @ref "text"`      | Type into a focused input by ref                        |
| `npx agent-browser screenshot <file>.png` | Capture full-page screenshot as evidence                |
| `npx agent-browser close`                 | End the session                                         |

---

## QA Engineer Workflow (Interactive — Drive Like a User)

```
1. START ENVIRONMENT
   ├─ Start database (supabase start / docker compose up)
   ├─ Seed test data (run SQL from handoff.json, call seed API)
   ├─ Start dev server (pnpm dev)
   └─ Verify server responds (curl http://localhost:3000)

2. LAUNCH HEADLESS-CHROME SESSION (agent-browser)
   └─ npx agent-browser open http://localhost:3000
   └─ npx agent-browser snapshot   (confirm page loaded)

3. EXECUTE WORKFLOWS (Black-Box — from handoff.json scope.in)
   ├─ snapshot → identify refs for the elements a user would interact with
   ├─ type @ref / click @ref as a user would (login → feature → verify)
   ├─ snapshot after each key step — inspect the accessibility tree
   ├─ Follow happy path exactly as a user would
   ├─ Follow edge cases (empty states, errors, invalid input, back/refresh)
   ├─ Test permissions (coach vs mentee, auth vs unauth)
   ├─ Explore off-script: click unexpected buttons, navigate mid-flow, refresh
   ├─ screenshot as evidence at key steps and on failures
   └─ Test API directly (curl POST/GET/PATCH/DELETE) for data integrity

4. VERIFY EXPECTATIONS
   ├─ UI: elements visible, data correct, navigation works (from snapshots)
   ├─ API: status codes, response shape, data integrity (curl)
   ├─ State: database reflects changes, RLS enforced (supabase / psql)
   └─ Cross-check: UI matches API matches DB

5. DOCUMENT FINDINGS → qa-report.md
   ├─ Pass/Fail/Skipped per workflow
   ├─ Screenshots for failures and key steps
   ├─ Steps to reproduce bugs (as a user would experience them)
   └─ Update ai-workspace/changes/<id>/qa-report.md

6. CLOSE SESSION
   └─ npx agent-browser close
```

### What "drive like a user" means with agent-browser

- **Do not** write `.spec.ts` test files with `expect()` assertions.
- **Do** use `snapshot` to see what's on screen, then `click @ref` / `type @ref` to interact — exactly like a user clicking/typing.
- **Do** run `snapshot` after each workflow step so you can visually inspect the result via the accessibility tree.
- **Do** explore off-script: try invalid dates, click "Cancel", hit browser back, refresh mid-form, switch users — report UX friction you notice.
- **Do** take screenshots as evidence: `npx agent-browser screenshot qa-<workflow>-<step>.png`.

### Example: reproducing a bug like a user would

```bash
# 1. Open the app
npx agent-browser open http://localhost:3000

# 2. See the login form (snapshot shows Email @e5, Password @e6, Continue @e3)
npx agent-browser snapshot

# 3. Log in as coach
npx agent-browser type @e5 "coach2@example.com"
npx agent-browser type @e6 "testpassword123"
npx agent-browser click @e3

# 4. Navigate to the feature
npx agent-browser click @<diet-plans-link-ref>
npx agent-browser snapshot   # inspect what renders

# 5. Interact with form fields
npx agent-browser type @<plan-name-ref> "My Test Plan"
npx agent-browser click @<save-btn-ref>
npx agent-browser snapshot   # did the plan appear? any error?

# 6. Screenshot evidence
npx agent-browser screenshot qa-coach-create-plan.png
```

---

## Tools: agent-browser (Browser Testing)

### Start Interactive Session

```bash
# One-time: install Chrome
npx agent-browser install

# Each QA session: open the dev server
npx agent-browser open http://localhost:3000
```

### Interactive commands (type directly, no test file)

```bash
# See what's on the page (accessibility tree with refs)
npx agent-browser snapshot

# Interact like a user
npx agent-browser type @e5 "coach2@example.com"
npx agent-browser click @e3

# Capture evidence
npx agent-browser screenshot qa-dashboard.png

# End session
npx agent-browser close
```

**Never write** `.spec.ts` files or run `npx playwright test` for QA verification. The goal is human-like exploration, not encoded assertions.

---

## Tools: curl / HTTP Client (API Testing)

### Auth Flow

```bash
# 1. Login (Supabase Auth)
curl -X POST 'http://localhost:54321/auth/v1/token?grant_type=password' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"testpassword123"}'

# Response: { "access_token": "...", "refresh_token": "...", ... }

# 2. Use token for authenticated requests
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get profile
curl -X GET 'http://localhost:54321/rest/v1/profiles?id=eq.<user-id>' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H "Authorization: Bearer $TOKEN"

# Create food item (coach only)
curl -X POST 'http://localhost:54321/rest/v1/food_items' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=representation' \
  -d '{"name":"Test Food","calories_per_100g":100,"protein_g_per_100g":10,"carbs_g_per_100g":5,"fat_g_per_100g":2,"fiber_g_per_100g":1,"source":"custom"}'

# Search food items
curl -X GET 'http://localhost:54321/rest/v1/food_items?name=ilike.*chicken*&select=*' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H "Authorization: Bearer $TOKEN"
```

### Test RLS (Critical)

```bash
# As mentee — should ONLY see own data
curl -X GET 'http://localhost:54321/rest/v1/diet_plans?mentee_id=eq.<mentee-id>' \
  -H "Authorization: Bearer $MENTEE_TOKEN"

# As coach — should see mentee's plans
curl -X GET 'http://localhost:54321/rest/v1/diet_plans?coach_id=eq.<coach-id>' \
  -H "Authorization: Bearer $COACH_TOKEN"

# Cross-tenant — should FAIL (403 or empty)
curl -X GET 'http://localhost:54321/rest/v1/diet_plans?mentee_id=eq.<other-mentee-id>' \
  -H "Authorization: Bearer $MENTEE_TOKEN"
```

---

## Core Workflows to Verify (From handoff.json scope.in)

### Auth Workflows

| Workflow         | Steps                             | Expected                       |
| ---------------- | --------------------------------- | ------------------------------ |
| Login happy path | Open /login → fill creds → submit | Redirect to /, welcome message |
| Invalid creds    | Wrong password                    | Error toast, stay on /login    |
| Protected route  | Visit / without auth              | Redirect to /login             |
| Session persist  | Login → refresh → visit /         | Still logged in                |
| Logout           | Click logout → visit /            | Redirect to /login             |

### Diet Plan: Coach Workflows

| Workflow         | Steps                                                                     | Expected                               |
| ---------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| List mentees     | Login as coach → /coach/diet-plans                                        | Cards for each mentee with active plan |
| Create plan      | Click "Create Plan" → fill form → add meals → add foods via search → save | Plan appears in list, mentee can view  |
| Edit plan        | Click "Edit" → modify meals/items → save                                  | Changes reflected                      |
| Search foods     | Type in food selector → see autocomplete results                          | USDA + custom foods appear             |
| Add custom food  | Click "Add Custom" → fill macros → save → search again                    | New food appears in results            |
| View mentee logs | Click "View Logs" for date                                                | See consumed checkboxes, notes         |

### Diet Plan: Mentee Workflows

| Workflow       | Steps                                        | Expected                         |
| -------------- | -------------------------------------------- | -------------------------------- |
| View today     | Login as mentee → /diet-plan                 | Progress bars show 0/planned     |
| Check off item | Click checkbox on food item                  | Bar updates incrementally        |
| Navigate dates | Click prev/next day                          | Correct plan loads for that date |
| Add notes      | Type in notes textarea → blur                | Note persists on reload          |
| Offline mode   | Disconnect network → check items → reconnect | Changes sync, no data loss       |

### Check-in Workflows (Existing)

| Workflow      | Steps                                                        | Expected                                         |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| Full check-in | /check-in → fill 4 measurements → upload left photo → submit | Toast success, redirect to /, new stat in charts |
| Validation    | Submit without left photo                                    | Error, cannot submit                             |
| Photo compare | Dashboard → select earlier date                              | Two photos side by side                          |

---

## Verification Checklist (Per Workflow)

### UI Verification (from agent-browser snapshots)

- [ ] Page loads without console errors
- [ ] Expected elements visible (headings, inputs, buttons) — confirmed via snapshot refs
- [ ] Data displays correctly (names, numbers, dates)
- [ ] Interactions work (click, type, select, navigate) — confirmed via agent-browser
- [ ] Loading states show during async operations
- [ ] Error states show user-friendly messages
- [ ] Empty states show helpful guidance
- [ ] Responsive on mobile viewport

### API Verification

- [ ] Status code correct (200, 201, 400, 401, 403, 404, 500)
- [ ] Response shape matches expected schema
- [ ] Data integrity (FKs valid, calculated fields correct)
- [ ] RLS enforced (403 or filtered for unauthorized)
- [ ] Rate limits / pagination work

### Database Verification

```bash
# Check actual DB state
supabase db shell
# Or: psql postgresql://postgres:postgres@localhost:54322/postgres

# Verify inserts
SELECT * FROM diet_plans WHERE mentee_id = '<id>';
SELECT * FROM diet_plan_logs WHERE mentee_id = '<id>' AND log_date = '2026-01-15';
SELECT * FROM food_items WHERE source = 'custom' AND created_by = '<coach-id>';
```

### Cross-Verification

| Source           | Should Match                         |
| ---------------- | ------------------------------------ |
| UI progress bars | Sum of checked items in API response |
| API response     | Database records                     |
| Coach view       | Mentee's actual data                 |
| Offline cache    | Server state after sync              |

---

## QA Report Output (Required)

**Location:** `ai-workspace/changes/<issue-id>-<slug>/qa-report.md`

**Format:**

```markdown
# QA Report: <Issue Title>

**Date:** <ISO timestamp>
**Environment:** local dev (supabase + pnpm dev)
**Browser:** agent-browser (headed Chrome via CDP)
**Test User:** test@example.com (mentee) / coach@example.com (coach)
**Commit:** <sha>
**Review:** review.md (APPROVED)

---

## Workflows Tested

### Coach: Create Diet Plan

**Status:** PASS / FAIL
**Steps:**

1. Login as coach (agent-browser type @email, type @password, click @continue)
2. Navigate to /coach/diet-plans
3. Click "Create Plan"
4. Select mentee "Test Mentee"
5. Fill: name="Test Plan", start=2026-01-15, end=2026-01-21
6. Add meal "Breakfast" → search "chicken" → select "Chicken breast, raw" → 150g
7. Add meal "Lunch" → search "rice" → select "White rice, raw" → 200g
8. Save

**Observations:**

- Food search returned 5 results in <200ms ✅
- Macros auto-calculated correctly (150g chicken = 247 cal, 46.5g protein) ✅
- Plan appears in list with status "Active" ✅
- Mentee can view plan at /diet-plan ✅

**Screenshots:** qa-coach-create-plan.png

---

### Mentee: Track Consumption

**Status:** PASS / FAIL
**Steps:**

1. Login as mentee
2. Navigate to /diet-plan (today 2026-01-15)
3. Verify progress bars: Calories 0/647, Protein 0/56.5, Carbs 0/46, Fat 0/14.2, Fiber 0/2.6
4. Check "Chicken breast, raw - 150g" checkbox
5. Verify bars update: Calories 247/647, Protein 46.5/56.5, ...
6. Navigate to 2026-01-16 → verify different plan loads
7. Add notes "Felt good today" → blur → reload → note persists

**Observations:**

- Progress bars animate smoothly ✅
- Date navigation preserves scroll position ❌ (minor UX)
- Notes auto-save works ✅

**Screenshots:** qa-mentee-tracking.png

---

## API Tests (curl)

| Endpoint                | Method | Auth   | Status | Response Valid | Notes               |
| ----------------------- | ------ | ------ | ------ | -------------- | ------------------- |
| /rest/v1/food_items     | GET    | mentee | 200    | ✅             | 156 items returned  |
| /rest/v1/food_items     | POST   | mentee | 403    | ✅             | RLS blocks insert   |
| /rest/v1/food_items     | POST   | coach  | 201    | ✅             | Custom food created |
| /rest/v1/diet_plans     | GET    | mentee | 200    | ✅             | Only own plans      |
| /rest/v1/diet_plan_logs | PATCH  | mentee | 200    | ✅             | Consumed toggled    |

---

## RLS Verification

| Policy                      | Test                | Result    |
| --------------------------- | ------------------- | --------- |
| food_items coach insert     | POST as mentee      | 403 ✅    |
| diet_plans mentee select    | GET as other mentee | 0 rows ✅ |
| diet_plan_logs coach read   | GET as coach        | 200 ✅    |
| diet_plan_notes mentee CRUD | POST/PATCH as coach | 403 ✅    |

---

## Outcome Verification

| Criterion                          | Status            |
| ---------------------------------- | ----------------- |
| All acceptance criteria (scope.in) | PASS/FAIL         |
| Zero console errors in test run    | PASS/FAIL         |
| Zero TypeScript errors             | PASS/FAIL         |
| Build succeeds                     | PASS/FAIL         |
| Manual workflow (if testable)      | PASS/FAIL/SKIPPED |

---

## Bugs Found

| ID      | Severity | Workflow    | Steps to Reproduce | Expected          | Actual                  |
| ------- | -------- | ----------- | ------------------ | ----------------- | ----------------------- |
| BUG-001 | Medium   | Date nav    | Click next day     | Scroll to top     | Stays scrolled          |
| BUG-002 | Low      | Food search | Type "chic"        | "Chicken" results | No results until "cken" |

---

## Skipped Workflows (from scope.out)

| Workflow            | Reason                                              |
| ------------------- | --------------------------------------------------- |
| Mentee offline sync | Not user-facing (API only), verified via unit tests |

---

## Non-Blocking Issues from review-code

| Issue # | Category       | Status               |
| ------- | -------------- | -------------------- |
| #123    | N2 Performance | Logged, not verified |
| #124    | N5 DRY         | Logged, not verified |

---

## Summary

- **Workflows tested:** 8
- **Passed:** 7
- **Failed:** 1 (minor UX)
- **Skipped:** 1 (not in scope)
- **API endpoints verified:** 12
- **RLS policies verified:** 8
- **Blocking issues:** 0
- **Follow-up issues:** 2 (#BUG-001, #BUG-002)

**Overall:** READY FOR MERGE (with follow-up issues)
```

---

## Agent Usage Pattern

```
User: "QA verify the Diet Plan feature (issue #4)"

Agent:
1. READS: review.md (APPROVED), handoff.json (scope, acceptance criteria)
2. STARTS ENV: supabase start → pnpm dev → wait for ready
3. SEEDS DATA: runs SQL for test coach + mentee users
4. OPENS CHROME SESSION: npx agent-browser open http://localhost:3000
5. EXECUTES WORKFLOWS (drive like a user, snapshot to inspect):
   - snapshot → find refs → type @ref / click @ref as a user would
   - Login as coach → /coach/diet-plans → create plan → verify (snapshot + screenshot)
   - Login as mentee → /diet-plan → view plan → check items → verify bars
   - Explore edge cases: back/refresh mid-flow, invalid dates, wrong user
   - snapshot after each step to confirm UI matches intent
   - Test API directly (curl) for each endpoint + RLS
   - Check DB (supabase db shell) → verify records match UI
6. CROSS-VERIFIES: UI bars = API sums = DB records
7. CLOSES SESSION: npx agent-browser close
8. WRITES QA REPORT: ai-workspace/changes/4-food-database-selector/qa-report.md
   - Screenshots embedded as evidence
   - Pass/fail per workflow, steps to reproduce bugs
9. REPORTS: "QA complete. X/Y workflows pass. Z minor UX issues. N follow-up issues. Ready for maintain-context."
```

---

## Handoff to maintain-context

**maintain-context reads:**

- `qa-report.md` — final verification status
- `handoff.json` — what was implemented, decisions
- `review.md` — code quality approval

**maintain-context does:**

- Updates AGENTS.md quick refs (stores, commands, gotchas)
- Updates ai-workspace/ domain docs (tables, RLS, relationships)
- Archives change folder

---

## Key Difference: QA vs Test Automation

| QA Engineer (This Skill)               | Test Automation                |
| -------------------------------------- | ------------------------------ |
| Drives headed Chrome via agent-browser | Writes `.spec.ts` test files   |
| Snapshots to visually inspect          | Runs assertions in CI          |
| Explores edge cases manually           | Encodes known happy paths      |
| Verifies "does it feel right?"         | Verifies "does it match spec?" |
| Finds unknown UX bugs                  | Prevents known regressions     |
| Output: qa-report.md + screenshots     | Output: test-results.xml       |
| **Complements** automation             | **Complements** QA             |

---

## Adapting to Your Project

1. Copy to `.agents/skills/verify-qa/SKILL.md`
2. Configure in AGENTS.md:
   - Dev server command + port
   - Database startup command
   - Test user credentials (or seed script reference)
   - API base URL + auth method
   - Key workflows for your domain
3. Add to ai-workspace/changes/README.md:
   - QA report template reference

```

Let me verify the file was written correctly.
<tool_call>
<function=shell>
```
