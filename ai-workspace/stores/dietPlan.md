# Diet Plan Store (`useDietPlanStore`)

## State

- `currentPlan: DietPlanWithMeals \| null` — Active plan for selected date
- `logs: Record<string, DietPlanLog>` — Consumption logs keyed by foodItemId
- `notes: Record<string, string>` — Daily notes keyed by date
- `loading: boolean` — Fetch in progress
- `error: string \| null` — Last error message

## Getters

| Getter      | Returns          | Description        |
| ----------- | ---------------- | ------------------ |
| `isLoading` | `boolean`        | `loading` state    |
| `lastError` | `string \| null` | Last error message |

## Actions

| Action             | Params                              | Returns                        | Description                                               |
| ------------------ | ----------------------------------- | ------------------------------ | --------------------------------------------------------- |
| `fetchPlanForDate` | `date: string`                      | `Promise<void>`                | Loads plan with meals + items + macros for date           |
| `fetchLogs`        | `date: string`                      | `Promise<void>`                | Loads consumption logs for date                           |
| `fetchNotes`       | `date: string`                      | `Promise<void>`                | Loads daily notes for date                                |
| `toggleConsumed`   | `itemId: string, consumed: boolean` | `Promise<void>`                | Toggles consumption, syncs to Supabase                    |
| `saveNotes`        | `date: string, notes: string`       | `Promise<void>`                | Saves daily notes                                         |
| `clearPlan`        | —                                   | `void`                         | Clears all plan state                                     |
| `fetchMentees`     | —                                   | `Promise<Profile[]>`           | Coach's mentees (`role='mentee' AND coach_id=auth.uid()`) |
| `fetchCoachPlans`  | —                                   | `Promise<DietPlanWithMeals[]>` | Plans with meals + items for coach's mentees              |
| `createPlan`       | `data: CreatePlanInput`             | `Promise<void>`                | Transactional insert: diet_plan + meals + food_items      |
| `updatePlan`       | `id: string, data: UpdatePlanInput` | `Promise<void>`                | Replaces meals/items on existing plan                     |
| `deletePlan`       | `id: string`                        | `Promise<void>`                | Cascades deletes meals + food_items                       |
| `fetchPlanForEdit` | `id: string`                        | `Promise<DietPlanWithMeals>`   | Loads full plan structure for editing                     |

## Types

```typescript
interface DietPlanFoodItem {
  id: string;
  food_item_id: string;
  quantity_g: number;
  macros: CalculatedMacros;
  foodItem?: {
    id: string;
    name: string;
    calories_per_100g: number;
    protein_g_per_100g: number;
    carbs_g_per_100g: number;
    fat_g_per_100g: number;
    fiber_g_per_100g: number;
  };
}

interface DietPlanMeal {
  id: string;
  name: string;
  display_order: number;
  items: DietPlanFoodItem[];
}

interface DietPlanWithMeals {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  meals: DietPlanMeal[];
}

interface DietPlanLog {
  id: string;
  food_item_id: string;
  consumed: boolean;
  consumed_at: string | null;
}
```

## Patterns

- **Optimistic UI**: `toggleConsumed()` updates local state immediately, syncs to Supabase
- **Error rollback**: On Supabase error, local state not reverted (UI shows error toast)
- **Parallel fetches**: `fetchPlanForDate` triggers `fetchLogs` and `fetchNotes` sequentially
- **Date-based keys**: Logs and notes keyed by date string (`YYYY-MM-DD`)
- **Macro integration**: Uses `CalculatedMacros` from `foodMacros` utilities

## Usage

```typescript
const store = useDietPlanStore();

// Load plan for today
await store.fetchPlanForDate("2026-01-15");

// Check off a food item
await store.toggleConsumed("food-item-id", true);

// Save notes
await store.saveNotes("2026-01-15", "Felt great today!");

// Access data
const totalCalories = store.currentPlan?.meals
  .flatMap((m) => m.items)
  .reduce((sum, i) => sum + i.macros.calories, 0);
const consumed = store.logs["item-id"]?.consumed;
```

## Testing

- Unit: `tests/unit/dietPlanStore.test.ts` (TODO)
- Integration: `tests/integration/dietPlanStore.test.ts` (TODO)
- E2E: `tests/food-database.spec.ts` (mentee tracking workflow)

## RLS Enforcement

- **SELECT (mentee)**: Own plans only (`diet_plans_mentee_select`)
- **ALL (coach)**: CRUD on mentee plans (`diet_plans_coach_crud`)
- **Logs (mentee)**: CRUD own logs (`diet_plan_logs_mentee_crud`)
- **Logs (coach)**: Read mentee logs (`diet_plan_logs_coach_select`)
- **Notes (mentee)**: CRUD own notes (`diet_plan_notes_mentee_crud`)
- **Notes (coach)**: Read mentee notes (`diet_plan_notes_coach_select`)

## Related Components

- `FoodSelector.vue` — Autocomplete food search for coach plan creation
- `CustomFoodModal.vue` — Modal for adding custom foods
- `DietPlanMealCard.vue` — Meal display with food items (TODO)
- `DietPlanProgressBars.vue` — Macro progress visualization (TODO)
