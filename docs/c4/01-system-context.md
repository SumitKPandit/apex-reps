# C4 Level 1 — System Context

Shows the **Apex Reps** system, the people who use it, and the external systems it depends on.

```mermaid
flowchart TB
    %% Styling classes
    classDef person fill:#f9d79b,stroke:#e67e22,stroke-width:2px,color:#000
    classDef system fill:#aed6f1,stroke:#3498db,stroke-width:2px,color:#000
    classDef external fill:#d5f5e3,stroke:#27ae60,stroke-width:2px,color:#000
    classDef hosting fill:#f5b7b1,stroke:#e74c3c,stroke-width:2px,color:#000

    %% People
    Mentee[("Mentee")]:::person
    Coach[("Coach")]:::person

    %% The system
    subgraph ApexReps["Apex Reps — Fitness Tracker (Nuxt 4 SPA)"]
        direction TB
        System["Web application<br/>(client-side, no backend)"]
    end
    class System system

    %% External systems
    Supabase["Supabase<br/>(Auth · Database · Storage)"]:::external
    Storage["Supabase Storage<br/>bucket: progress_photos"]:::external
    Browser["User's Browser<br/>(IndexedDB · Service Worker)"]:::external
    Hosting["GitHub Pages<br/>static hosting<br/>app.fitmahima.in"]:::hosting

    %% Relationships
    Metee -->|"Uses (sign in, check-in,<br/>dashboard, diet plan)"| System
    Coach -->|"Uses (sign in, manage mentees,<br/>create/edit diet plans)"| System

    System -->|"HTTPS: auth, DB queries,<br/>realtime, storage API"| Supabase
    Supabase -->|"Object storage<br/>(upload/download signed URLs)"| Storage
    System -->|"Serves static assets"| Hosting
    Hosting -->|"Delivers SPA to"| Browser
    Browser -->|"Loads & runs"| System
    System -.->|"Offline cache: food search<br/>(IndexedDB via useFoodCache)"| Browser
    System -.->|"PWA shell + install prompt<br/>(Service Worker /sw.js)"| Browser

    %% Layout hints
    linkStyle default stroke-width:2px,fill:none,stroke:#333
```

## Summary

| Element          | Description                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mentee**       | End client of Mahima Srivastava. Logs body measurements + progress photos, views trends, tracks assigned diet plan.                                   |
| **Coach**        | Mahima Srivastava (or staff). Creates/edits/deletes diet plans for mentees, views mentee progress.                                                    |
| **Apex Reps**    | Single-page application (Nuxt 4, `ssr: false`) with no custom backend. All data lives in Supabase.                                                    |
| **Supabase**     | Backend-as-a-service providing Auth (GoTrue), PostgreSQL database, and object storage. Reached directly from the browser via `@supabase/supabase-js`. |
| **GitHub Pages** | Static site host for the production build (`nuxt generate`). Custom domain `app.fitmahima.in`.                                                        |

## Key boundaries

- **No backend code in this repo.** The SPA talks directly to Supabase; Row Level Security (RLS) enforces access control at the database layer.
- **Auth cookies/tokens** live in the browser; every Supabase call carries the user's JWT (see `app/utils/supabase.ts`).
- **Photos** are stored in a private Supabase bucket and read via short-lived signed URLs (7-day expiry).
- **Offline support** is limited to food-search caching in IndexedDB and a PWA service-worker shell — check-ins and diet-plan writes require network.
