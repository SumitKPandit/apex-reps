# Food Item Store (`useFoodItemStore`)

## State

- `searchResults: FoodItemSearchResult[]` — Current search results
- `searchCache: Map<string, { data, timestamp }>` — In-memory cache with TTL
- `loading: boolean` — Search in progress
- `error: string | null` — Last error message

## Getters

| Getter      | Returns          | Description        |
| ----------- | ---------------- | ------------------ |
| `isLoading` | `boolean`        | `loading` state    |
| `lastError` | `string \| null` | Last error message |

## Actions

| Action             | Params                   | Returns                           | Description                                                 |
| ------------------ | ------------------------ | --------------------------------- | ----------------------------------------------------------- |
| `searchFoods`      | `query: string`          | `Promise<FoodItemSearchResult[]>` | Searches food_items with ILIKE, debounced 300ms, cached 24h |
| `createCustomFood` | `input: CustomFoodInput` | `Promise<FoodItemSearchResult>`   | Inserts food as `source='custom'`, clears cache             |
| `clearCache`       | —                        | `void`                            | Clears in-memory search cache                               |

## Types

```typescript
interface FoodItemSearchResult {
  id: string;
  name: string;
  calories_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fiber_g_per_100g: number;
  source: "usda" | "custom";
}

interface CustomFoodInput {
  name: string;
  calories_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fiber_g_per_100g: number;
}
```

## Patterns

- **Debounced search**: 300ms debounce via `setTimeout` in `handleSearch()`
- **In-memory cache**: Map with 24h TTL, keyed by normalized query
- **Cache invalidation**: `createCustomFood()` clears entire cache
- **Error handling**: Try/catch with `error` state, logs to console, re-throws
- **Loading state**: `loading` true during async operations
- **Auth check**: `createCustomFood()` verifies `supabase.auth.getUser()`

## Usage

```typescript
const store = useFoodItemStore();

// Search
const results = await store.searchFoods("chicken");

// Create custom food
const food = await store.createCustomFood({
  name: "Whey Isolate",
  calories_per_100g: 370,
  protein_g_per_100g: 90,
  carbs_g_per_100g: 3,
  fat_g_per_100g: 1,
  fiber_g_per_100g: 0,
});

// Access cached results
const cached = store.searchResults;
```

## Composables

- `useFoodCache()` — IndexedDB caching via `@vueuse/integrations/useIDBKeyval`
- `useDebounce(fn, delay)` — Debounce utility

## Testing

- Unit: `tests/unit/foodItemStore.test.ts` (4 tests, mock Supabase)
- Integration: `tests/integration/foodItemStore.test.ts` (TODO)
- E2E: `tests/food-database.spec.ts` (search, custom food, RLS)

## RLS Enforcement

- **SELECT**: All authenticated users (policy: `food_items_select_all_authenticated`)
- **INSERT**: Coach only (policy: `food_items_insert_coach`)
- **UPDATE/DELETE**: Creator only (policies: `food_items_update_creator`, `food_items_delete_creator`)

Verified in unit tests with mock auth contexts.
