# C4 Model Diagrams — Apex Reps

These diagrams document the **Apex Reps** codebase using the [C4 model](https://c4model.com/) — a lightweight approach for visualising software architecture.

## Diagram levels

| Level | Diagram                                  | Purpose                                                                    |
| ----- | ---------------------------------------- | -------------------------------------------------------------------------- |
| **1** | [System Context](./01-system-context.md) | Who uses the system and what external systems it depends on                |
| **2** | [Container](./02-container.md)           | The high-level technical building blocks (SPA, Supabase, Storage, Hosting) |
| **3** | [Component](./03-component.md)           | Components inside the SPA container (pages, stores, composables, utils)    |
| **4** | [Code](./04-code.md)                     | Low-level detail for key stores and utilities                              |

## How to read these

- **Solid lines** = synchronous / request-response interactions
- **Dashed lines** = asynchronous, offline, or background interactions (e.g., IndexedDB, Service Worker)
- All diagrams are written in Mermaid and render in GitHub, VS Code, and most Markdown viewers.

## Source of truth

These diagrams were reverse-engineered from the codebase (Nuxt 4 SPA, Pinia stores, Supabase client, migrations, and `ai-workspace/database/` docs). If the code changes, update the matching diagram.
