# C4 Level 2 — Container

Shows the high-level technical building blocks and how they communicate.

```mermaid
flowchart TB
    %% Styling classes
    classDef browser fill:#aed6f1,stroke:#3498db,stroke-width:2px,color:#000
    classDef spa fill:#d5f5e3,stroke:#27ae60,stroke-width:2px,color:#000
    classDef supabase fill:#f9d79b,stroke:#e67e22,stroke-width:2px,color:#000
    classDef storage fill:#d7bde2,stroke:#8e44ad,stroke-width:2px,color:#000
    classDef hosting fill:#f5b7b1,stroke:#e74c3c,stroke-width:2px,color:#000
    classDef local fill:#f2f3f4,stroke:#7f8c8d,stroke-width:2px,color:#000

    %% User
    User[("End User<br/>(Mentee / Coach)")]:::browser

    %% Browser / SPA container
    subgraph Browser["User's Browser (Chrome/Safari/etc.)"]
        direction TB
        SPA["Apex Reps SPA<br/>Nuxt 4 · Vue 3 · Pinia<br/>(client-side, ssr: false)"]
        IDB[("(IndexedDB)<br/>food search cache<br/>24h TTL")]:::local
        SW[("(Service Worker)<br/>/sw.js — PWA shell<br/>+ install prompt")]:::local
    end
    class SPA spa

    %% Supabase platform
    subgraph Supabase["Supabase Platform (BaaS)"]
        direction TB
        Auth["Supabase Auth<br/>(GoTrue)<br/>email/password sign-in"]:::supabase
        DB["Supabase Database<br/>(PostgreSQL)<br/>RLS on all tables"]:::supabase
        Realtime["Supabase Realtime<br/>(not actively used)"]
    end

    %% Storage
    Storage["Supabase Storage<br/>bucket: progress_photos<br/>(private, path-prefix isolation)"]:::storage

    %% Hosting
    Hosting["GitHub Pages<br/>static hosting<br/>app.fitmahima.in"]:::hosting

    %% Relationships
    User -->|"Loads app over HTTPS"| Hosting
    Hosting -->|"Serves static JS/CSS/assets"| SPA
    SPA -->|"signInWithPassword,<br/>getSession, getUser"| Auth
    SPA -->|"SELECT/INSERT/UPSERT<br/>over REST (PostgREST)"| DB
    SPA -->|"upload / createSignedUrl / remove"| Storage
    Auth -.->|"issues JWT (access_token)"| SPA
    DB -.->|"returns rows (RLS-filtered)"| SPA
    Storage -.->|"returns signed URLs / objects"| SPA

    SPA -.->|"read/write cached search results"| IDB
    SPA -.->|"register / cache shell"| SW

    linkStyle default stroke-width:2px,fill:none,stroke:#333
    linkStyle 6,7,8 stroke:#e67e22,stroke-dasharray: 5 5
```

## Container responsibilities

| Container             | Technology             | Responsibility                                                                                                                      |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Pages**      | Static site hosting    | Builds (`nuxt generate`) and serves the prerendered SPA at `app.fitmahima.in`.                                                      |
| **Apex Reps SPA**     | Nuxt 4 / Vue 3 / Pinia | UI, state management, data fetching, validation (Zod), image compression, BFP calculation, routing.                                 |
| **Supabase Auth**     | GoTrue                 | Email/password authentication, session management, JWT issuance.                                                                    |
| **Supabase Database** | PostgreSQL             | All application data (profiles, stats, photos, subscriptions, plans, food_items, diet_plans, …). RLS enforces per-user/role access. |
| **Supabase Storage**  | Object storage         | Private `progress_photos` bucket for progress images.                                                                               |
| **IndexedDB**         | Browser local          | `useFoodCache` — 24h TTL cache of food search results for offline use.                                                              |
| **Service Worker**    | `/sw.js`               | PWA offline shell + install prompt (composable `usePWA`).                                                                           |

## Data flow (typical check-in)

1. Browser loads SPA from GitHub Pages.
2. SPA calls Supabase Auth → session restored via JWT.
3. User submits check-in form (`/check-in`).
4. `statsStore.saveStatsAndPhotos()`:
   - Calculates BFP client-side (`bodyFat.ts`).
   - Compresses photos client-side (`image.ts`).
   - Inserts `stats` row → gets `statId`.
   - Uploads each photo to Supabase Storage (`progress_photos` bucket).
   - Inserts `photos` row per angle.
   - On any failure: rolls back stat row + removes uploaded objects.

## Security boundary

RLS policies live in the database, not the client. The SPA cannot bypass them — every request carries the user's JWT and Supabase evaluates policies server-side. See `ai-workspace/database/rls-policies.md`.
