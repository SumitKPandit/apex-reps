# C4 Level 4 — Code

Low-level detail for the most important stores and utilities. These are the files most likely to change (per `AGENTS.md` "Files to Watch").

## 4a. Stats store — `app/stores/stats.ts`

```mermaid
flowchart TB
    classDef action fill:#aed6f1,stroke:#3498db,stroke-width:2px,color:#000
    classDef util fill:#d5f5e3,stroke:#27ae60,stroke-width:2px,color:#000
    classDef db fill:#f9d79b,stroke:#e67e22,stroke-width:2px,color:#000
    classDef storage fill:#d7bde2,stroke:#8e44ad,stroke-width:2px,color:#000
    classDef guard fill:#f5b7b1,stroke:#e74c3c,stroke-width:2px,color:#000

    subgraph Save["saveStatsAndPhotos(stats, photos)"]
        A1["require left photo<br/>angle === 'left'"]:::guard
        A2["insertStat() → statId"]:::action
        A3["for each photo:<br/>uploadPhoto() → path"]:::action
        A4["insertPhotoRecord(statId, path)"]:::action
        A5["rollbackStat() on error:<br/>delete stat + remove objects"]:::action
    end

    subgraph Helpers["Private helpers"]
        H1["insertStat(userId, stats, profileStore)<br/>· bfp = calculateBodyFatPercentage()<br/>· INSERT stats RETURNING id"]:::action
        H2["uploadPhoto(userId, statId, photo)<br/>· compressImage(file)<br/>· storage.upload(path)"]:::action
        H3["insertPhotoRecord(...)<br/>· INSERT photos"]:::action
        H4["rollbackStat(...)<br/>· storage.remove(paths)<br/>· DELETE stats WHERE id"]:::action
    end

    subgraph External["External"]
        DB[("Supabase DB<br/>stats / photos")]:::db
        ST[("Supabase Storage<br/>progress_photos")]:::storage
        BF["utils/bodyFat.ts"]:::util
        IMG["utils/image.ts"]:::util
        CONST["utils/constants.ts"]:::util
        PROF["stores/profile.ts<br/>sex · height"]:::util
    end

    Save --> H1
    Save --> H3
    Save -.->|"on failure"| A5

    H1 --> BF
    H1 --> DB
    H1 --> PROF
    H2 --> IMG
    H2 --> CONST
    H2 --> ST
    H3 --> DB
    H4 --> ST
    H4 --> DB

    linkStyle default stroke-width:1.5px,fill:none,stroke:#555
```

**State:** `stats[]`, `leftPhotoCheckins[]` (deduped by `stat_id`, signed URLs with 7-day expiry).
**Getters:** `weightChartData`, `waistChartData`, `bfpChartData` (sorted ascending by `created_at`).

---

## 4b. Diet plan store — `app/stores/dietPlan.ts` (mentee side)

```mermaid
flowchart TB
    classDef action fill:#aed6f1,stroke:#3498db,stroke-width:2px,color:#000
    classDef db fill:#f9d79b,stroke:#e67e22,stroke-width:2px,color:#000
    classDef state fill:#d5f5e3,stroke:#27ae60,stroke-width:2px,color:#000

    subgraph Mentee["Mentee actions"]
        M1["fetchPlanForDate(date)<br/>· diet_plans (start ≤ date ≤ end)<br/>· diet_plan_meals + items + food_items<br/>· fetchLogs(date)<br/>· fetchNotes(date)"]:::action
        M2["toggleConsumed(foodItemId, consumed)<br/>· upsert diet_plan_logs<br/>(onConflict mentee_id, food_item_id, log_date)"]:::action
        M3["saveNotes(date, notes)<br/>· upsert diet_plan_notes<br/>(onConflict mentee_id, diet_plan_id, log_date)"]:::action
    end

    subgraph State["Client state"]
        S1["currentPlan: DietPlanWithMeals\|null"]:::state
        S2["logs: Record<foodItemId, DietPlanLog>"]:::state
        S3["notes: Record<date, string>"]:::state
    end

    subgraph DB[("Supabase DB")]
        D1[("diet_plans")]
        D2[("diet_plan_meals")]
        D3[("diet_plan_food_items")]
        D4[("food_items")]
        D5[("diet_plan_logs")]
        D6[("diet_plan_notes")]
    end

    M1 --> D1 & D2 & D3 & D4
    M1 --> S1 & S2 & S3
    M2 --> D5
    M2 --> S2
    M3 --> D6
    M3 --> S3

    linkStyle default stroke-width:1.5px,fill:none,stroke:#555
```

**Key rule:** `diet_plans` is unique on `(mentee_id, start_date)` — one active plan per mentee per date. `diet_plan_logs` unique on `(mentee_id, food_item_id, log_date)`.

---

## 4c. Diet plan store — `app/stores/dietPlan.ts` (coach side)

```mermaid
flowchart TB
    classDef action fill:#aed6f1,stroke:#3498db,stroke-width:2px,color:#000
    classDef db fill:#f9d79b,stroke:#e67e22,stroke-width:2px,color:#000
    classDef guard fill:#f5b7b1,stroke:#e74c3c,stroke-width:2px,color:#000

    subgraph Coach["Coach actions (useSupabase(true) — user JWT)"]
        C1["fetchMentees()<br/>· profiles WHERE role='mentee' AND coach_id = me"]:::action
        C2["fetchCoachPlans()<br/>· diet_plans WHERE coach_id = me<br/>+ meals + items + food_items"]:::action
        C3["fetchPlanForEdit(planId)<br/>· WHERE coach_id = me"]:::action
        C4["createPlan(input)<br/>· Zod validation (planInputSchema)<br/>· INSERT diet_plans → planId<br/>· INSERT diet_plan_meals → mealIds<br/>· INSERT diet_plan_food_items<br/>· rollback on failure<br/>DELETE meals, DELETE plan"]:::action
        C5["updatePlan(planId, input)<br/>· UPDATE diet_plans (coach_id = me)<br/>· DELETE + re-INSERT meals + items"]:::action
        C6["deletePlan(planId)<br/>· DELETE diet_plans WHERE coach_id = me<br/>(cascades to meals, items, logs, notes)"]:::action
        C7["fetchPlansForMentee(menteeId)<br/>· lightweight list for date-range blocking"]:::action
    end

    subgraph DB[("Supabase DB (RLS: coach_id = auth.uid())")]
        DP[("diet_plans")]
        DM[("diet_plan_meals")]
        DFI[("diet_plan_food_items")]
        FI[("food_items")]
        P[("profiles")]
    end

    C1 --> P
    C2 & C3 & C4 & C5 & C6 & C7 --> DP
    C4 & C5 --> DM & DFI
    C4 & C5 --> FI

    linkStyle default stroke-width:1.5px,fill:none,stroke:#555
    linkStyle 4,5,6 stroke:#e67e22,stroke-width:2px
```

---

## 4d. Food item store — `app/stores/foodItem.ts`

```mermaid
flowchart TB
    classDef action fill:#aed6f1,stroke:#3498db,stroke-width:2px,color:#000
    classDef db fill:#f9d79b,stroke:#e67e22,stroke-width:2px,color:#000
    classDef cache fill:#d5f5e3,stroke:#27ae60,stroke-width:2px,color:#000
    classDef guard fill:#f5b7b1,stroke:#e74c3c,stroke-width:2px,color:#000

    subgraph Search["searchFoods(query)"]
        S1["in-memory cache (searchCache Map, 24h TTL)"]:::cache
        S2["IndexedDB cache (useFoodCache)"]:::cache
        S3["network: food_items ILIKE %query% LIMIT 20"]:::db
        S4["fallback: stale IndexedDB copy"]:::cache
    end

    subgraph Create["createCustomFood(input)"]
        C1["supabase.auth.getUser()<br/>guard: not authenticated"]:::guard
        C2["INSERT food_items (source='custom',<br/>created_by = user.id)"]:::db
        C3["clear all caches"]:::cache
    end

    subgraph External["External"]
        DB[("Supabase DB<br/>food_items")]:::db
        IDB[("IndexedDB<br/>food-search-cache")]:::cache
    end

    S1 -.->|"hit"| Search
    S2 -.->|"hit"| Search
    S3 --> DB
    S4 -.-> IDB
    C2 --> DB
    C3 --> IDB

    linkStyle default stroke-width:1.5px,fill:none,stroke:#555
```

---

## 4e. Auth store — `app/stores/auth.ts`

```mermaid
flowchart TB
    classDef action fill:#aed6f1,stroke:#3498db,stroke-width:2px,color:#000
    classDef ext fill:#f5b7b1,stroke:#e74c3c,stroke-width:2px,color:#000

    A1["fetchSession()<br/>· getUser() + getSession()<br/>· set isAuthenticated, userId, user, accessToken"]:::action
    A2["login(email, password)<br/>· signInWithPassword<br/>· fetchSession()<br/>· role-based redirect<br/>  coach → /coach, else → /"]:::action
    A3["logout()<br/>· signOut()<br/>· clear state → /login"]:::action

    A1 & A2 & A3 --> Supabase[("Supabase Auth<br/>(GoTrue)")]:::ext

    linkStyle default stroke-width:1.5px,fill:none,stroke:#555
```

---

## 4f. Supabase client util — `app/utils/supabase.ts`

```mermaid
flowchart TB
    classDef util fill:#aed6f1,stroke:#3498db,stroke-width:2px,color:#000
    classDef ext fill:#f5b7b1,stroke:#e74c3c,stroke-width:2px,color:#000

    G1["getSupabase(useUserToken = false)<br/>· singleton client (no token)<br/>· if useUserToken: attaches<br/>  Authorization: Bearer <accessToken>"]:::util

    G1 --> Supabase[("Supabase Platform<br/>REST + Storage API")]:::ext

    linkStyle default stroke-width:1.5px,fill:none,stroke:#555
```

**Token strategy:** `useUserToken=true` is used for coach/mentee write operations (RLS evaluates `auth.uid()` from the JWT). `useUserToken=false` (anonymous) is used for public reads (`food_items`, `plans`).

---

## 4g. Body fat calculation — `app/utils/bodyFat.ts`

US Navy method, calculated **client-side** and stored in `stats.bfp`:

```
male:   86.01 × log10(waist − neck) − 70.041 × log10(height) + 36.76
female: 163.205 × log10(waist + hip − neck) − 97.684 × log10(height) − 78.387
```

- Throws if `height ≤ 0`.
- Throws if `waist ≤ neck` (male) or `waist + hip − neck ≤ 0` (female).
- Requires profile `sex` + `height` (both NOT NULL in `profiles`).

---

## 4h. Image compression — `app/utils/image.ts`

- `createImageBitmap` → canvas resize (max 1000px longest edge) → JPEG quality 0.82.
- Returns original file if compression doesn't reduce size or APIs unavailable.
- Used by `statsStore.uploadPhoto()` before `storage.upload()`.
