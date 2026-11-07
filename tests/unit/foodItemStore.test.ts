import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useFoodItemStore } from "@/stores/foodItem";

// --- vi.hoisted runs BEFORE vi.mock factories are evaluated, so these mocks
// are available to the hoisted factory functions below. The store resolves
// useFoodCache() / useOnlineStatus() lazily (inside actions), so mocks are
// initialized before the store is instantiated in each test. ---
const mocked = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
  online: { value: true },
}));

vi.mock("@/composables/useFoodCache", () => ({
  useFoodCache: () => ({
    get: mocked.get,
    set: mocked.set,
    clear: mocked.clear,
  }),
}));

vi.mock("@/composables/useOnlineStatus", () => ({
  useOnlineStatus: () => ({ isOnline: mocked.online }),
}));

const mockFrom = vi.fn();
const mockAuthGetUser = vi.fn();

vi.mock("@/utils/supabase", () => ({
  getSupabase: () => ({
    from: mockFrom,
    auth: {
      getUser: mockAuthGetUser,
    },
  }),
}));

const mockEnqueue = vi.fn().mockResolvedValue("sync-item-1");
const mockFlush = vi.fn().mockResolvedValue(undefined);

vi.mock("@/composables/useSyncQueue", () => ({
  useSyncQueue: () => ({ enqueue: mockEnqueue, flush: mockFlush }),
}));

// Create a proper chainable mock for Supabase that is thenable
const createChain = (
  data: Record<string, unknown>[],
  error: Error | null = null,
  count = 1,
) => {
  const result = { data, error, count };
  const chain = {
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then: vi.fn((resolve) => Promise.resolve(result).then(resolve)),
  };
  return chain;
};

describe("foodItemStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocked.online.value = true;
  });

  it("searchFoods returns empty array when query is empty", async () => {
    const store = useFoodItemStore();
    const results = await store.searchFoods("");
    expect(results).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mocked.get).not.toHaveBeenCalled();
  });

  it("searchFoods calls Supabase with ILIKE filter on IndexedDB miss", async () => {
    const mockData = [
      {
        id: "1",
        name: "Chicken breast, raw",
        calories_per_100g: 165,
        protein_g_per_100g: 31,
        carbs_g_per_100g: 0,
        fat_g_per_100g: 3.6,
        fiber_g_per_100g: 0,
        source: "usda",
      },
    ];

    const chain = createChain(mockData);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(chain),
    });
    // IndexedDB miss → fall through to Supabase.
    mocked.get.mockResolvedValue(null);

    const store = useFoodItemStore();
    const results = await store.searchFoods("chicken");

    expect(mockFrom).toHaveBeenCalledWith("food_items");
    expect(chain.ilike).toHaveBeenCalledWith("name", "%chicken%");
    expect(mocked.get).toHaveBeenCalledWith("chicken");
    // Result written to IndexedDB cache.
    expect(mocked.set).toHaveBeenCalledWith("chicken", results);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Chicken breast, raw");
  });

  it("searchFoods serves IndexedDB copy when online and skips Supabase", async () => {
    const cached = [
      {
        id: "cached-1",
        name: "Cached almonds",
        calories_per_100g: 579,
        protein_g_per_100g: 21,
        carbs_g_per_100g: 22,
        fat_g_per_100g: 50,
        fiber_g_per_100g: 12,
        source: "usda",
      },
    ];
    mocked.get.mockResolvedValue(cached);

    const store = useFoodItemStore();
    const results = await store.searchFoods("almonds");

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mocked.get).toHaveBeenCalledWith("almonds");
    expect(results).toEqual(cached);
  });

  it("searchFoods serves IndexedDB copy offline and skips Supabase", async () => {
    mocked.online.value = false;
    const cached = [
      {
        id: "cached-2",
        name: "Cached oats",
        calories_per_100g: 389,
        protein_g_per_100g: 17,
        carbs_g_per_100g: 66,
        fat_g_per_100g: 7,
        fiber_g_per_100g: 10,
        source: "usda",
      },
    ];
    mocked.get.mockResolvedValue(cached);

    const store = useFoodItemStore();
    const results = await store.searchFoods("oats");

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mocked.get).toHaveBeenCalledWith("oats");
    expect(results).toEqual(cached);
  });

  it("searchFoods returns empty offline when nothing is cached", async () => {
    mocked.online.value = false;
    mocked.get.mockResolvedValue(null);

    const store = useFoodItemStore();
    const results = await store.searchFoods("nothing");

    expect(mockFrom).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });

  it("searchFoods caches results in memory", async () => {
    const mockData = [
      {
        id: "1",
        name: "Chicken breast, raw",
        calories_per_100g: 165,
        protein_g_per_100g: 31,
        carbs_g_per_100g: 0,
        fat_g_per_100g: 3.6,
        fiber_g_per_100g: 0,
        source: "usda",
      },
    ];

    const chain = createChain(mockData);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(chain),
    });
    mocked.get.mockResolvedValue(null);

    const store = useFoodItemStore();
    await store.searchFoods("chicken");
    await store.searchFoods("chicken");

    // Second call should use in-memory cache, so mockFrom called once.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("createCustomFood inserts to Supabase and invalidates caches", async () => {
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-id" } },
      error: null,
    });

    const insertChain = createChain([
      {
        id: "new-id",
        name: "Whey isolate",
        calories_per_100g: 370,
        protein_g_per_100g: 90,
        carbs_g_per_100g: 3,
        fat_g_per_100g: 1,
        fiber_g_per_100g: 0,
        source: "custom",
        created_by: "user-id",
      },
    ]);

    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(insertChain),
      }),
    });

    const store = useFoodItemStore();
    const input = {
      name: "Whey isolate",
      calories_per_100g: 370,
      protein_g_per_100g: 90,
      carbs_g_per_100g: 3,
      fat_g_per_100g: 1,
      fiber_g_per_100g: 0,
    };

    const result = await store.createCustomFood(input);

    expect(result.name).toBe("Whey isolate");
    expect(result.source).toBe("custom");
    expect(mockFrom).toHaveBeenCalledWith("food_items");
    // Both caches invalidated after creating a custom food.
    expect(mocked.clear).toHaveBeenCalled();
  });

  it("searchFoods falls back to stale IndexedDB copy on network error", async () => {
    const stale = [
      {
        id: "stale-1",
        name: "Stale peanut butter",
        calories_per_100g: 588,
        protein_g_per_100g: 25,
        carbs_g_per_100g: 20,
        fat_g_per_100g: 50,
        fiber_g_per_100g: 6,
        source: "usda",
      },
    ];
    // First IndexedDB check: miss (no fresh copy). Supabase fails. Catch:
    // second IndexedDB check returns stale copy → served as fallback.
    mocked.get.mockResolvedValueOnce(null).mockResolvedValueOnce(stale);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error("network down")),
          }),
        }),
      }),
    });

    const store = useFoodItemStore();
    const results = await store.searchFoods("peanut butter");

    expect(results).toEqual(stale);
  });

  it("createCustomFood offline enqueues instead of calling Supabase", async () => {
    mocked.online.value = false;
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-id" } },
      error: null,
    });
    mockEnqueue.mockResolvedValue("sync-item-1");

    const store = useFoodItemStore();
    const input = {
      name: "Whey isolate",
      calories_per_100g: 370,
      protein_g_per_100g: 90,
      carbs_g_per_100g: 3,
      fat_g_per_100g: 1,
      fiber_g_per_100g: 0,
    };

    const result = await store.createCustomFood(input);

    // No Supabase insert while offline.
    expect(mockFrom).not.toHaveBeenCalled();
    // Queued for background sync.
    expect(mockEnqueue).toHaveBeenCalledWith({
      type: "createCustomFood",
      payload: { ...input, created_by: "user-id" },
    });
    // Optimistic result returned with a temp id.
    expect(result.id).toBe("offline-sync-item-1");
    expect(result.name).toBe("Whey isolate");
    expect(result.source).toBe("custom");
    expect(store.searchResults[0].id).toBe("offline-sync-item-1");
  });

  it("flushSyncQueue replays queued items to Supabase", async () => {
    mocked.online.value = true;
    // Simulate the sync queue flushing one queued item through the replay.
    mockFlush.mockImplementation(async (replay) => {
      await replay({
        type: "createCustomFood",
        payload: {
          name: "Whey isolate",
          calories_per_100g: 370,
          protein_g_per_100g: 90,
          carbs_g_per_100g: 3,
          fat_g_per_100g: 1,
          fiber_g_per_100g: 0,
          created_by: "user-id",
        },
      });
    });

    const insertChain = createChain([
      {
        id: "synced-id",
        name: "Whey isolate",
        calories_per_100g: 370,
        protein_g_per_100g: 90,
        carbs_g_per_100g: 3,
        fat_g_per_100g: 1,
        fiber_g_per_100g: 0,
        source: "custom",
        created_by: "user-id",
      },
    ]);
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(insertChain),
      }),
    });

    const store = useFoodItemStore();
    await store.flushSyncQueue();

    expect(mockFlush).toHaveBeenCalled();
    // The flush replay inserted to Supabase.
    expect(mockFrom).toHaveBeenCalledWith("food_items");
    expect(mockFrom().insert).toHaveBeenCalledWith({
      name: "Whey isolate",
      calories_per_100g: 370,
      protein_g_per_100g: 90,
      carbs_g_per_100g: 3,
      fat_g_per_100g: 1,
      fiber_g_per_100g: 0,
      source: "custom",
      created_by: "user-id",
    });
  });
});
