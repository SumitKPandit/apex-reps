import { defineStore } from "pinia";
import { getSupabase } from "@/utils/supabase";
import { useFoodCache } from "@/composables/useFoodCache";
import { useOnlineStatus } from "@/composables/useOnlineStatus";
import { useSyncQueue } from "@/composables/useSyncQueue";
import type { FoodItemSearchResult, CustomFoodInput } from "@/types/food";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SEARCH_LIMIT = 20;

// Lazy accessors for the IndexedDB cache and online status. Composables are
// resolved on first use (inside actions) rather than at module load, which
// keeps vitest's hoisted mocks initializing before they are invoked.
let cache: ReturnType<typeof useFoodCache> | null = null;
let onlineStatus: ReturnType<typeof useOnlineStatus> | null = null;

function getCache() {
  if (!cache) cache = useFoodCache();
  return cache;
}

function getOnline() {
  if (!onlineStatus) onlineStatus = useOnlineStatus();
  return onlineStatus;
}

let syncQueue: ReturnType<typeof useSyncQueue> | null = null;

function getSyncQueue() {
  if (!syncQueue) syncQueue = useSyncQueue();
  return syncQueue;
}

export const useFoodItemStore = defineStore("foodItem", {
  state: () => ({
    searchResults: [] as FoodItemSearchResult[],
    searchCache: new Map<
      string,
      { data: FoodItemSearchResult[]; timestamp: number }
    >(),
    loading: false,
    error: null as string | null,
    searchFromCache: false,
  }),

  getters: {
    isLoading: (state) => state.loading,
    lastError: (state) => state.error,
  },

  actions: {
    async searchFoods(query: string): Promise<FoodItemSearchResult[]> {
      const trimmed = query.trim();
      if (!trimmed) {
        this.searchResults = [];
        return [];
      }

      const cacheKey = `search:${trimmed.toLowerCase()}`;

      // 1. In-memory cache (fastest).
      const mem = this.searchCache.get(cacheKey);
      if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) {
        this.searchFromCache = false;
        this.searchResults = mem.data;
        return mem.data;
      }

      // 2. Persistent IndexedDB cache (works offline, survives reload).
      const indexed = await getCache().get<FoodItemSearchResult[]>(trimmed);
      if (indexed) {
        this.searchFromCache = true;
        this.searchCache.set(cacheKey, { data: indexed, timestamp: Date.now() });
        this.searchResults = indexed;
        return indexed;
      }

      // No cached copy: requires network.
      if (!getOnline().isOnline.value) {
        this.searchFromCache = false;
        this.searchResults = [];
        return [];
      }

      this.loading = true;
      this.error = null;

      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("food_items")
          .select(
            "id, name, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, source",
            { count: "exact" },
          )
          .ilike("name", `%${trimmed}%`)
          .order("name")
          .limit(SEARCH_LIMIT);

        if (error) throw new Error(error.message);

        const results: FoodItemSearchResult[] = (data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          calories_per_100g: item.calories_per_100g,
          protein_g_per_100g: item.protein_g_per_100g,
          carbs_g_per_100g: item.carbs_g_per_100g,
          fat_g_per_100g: item.fat_g_per_100g,
          fiber_g_per_100g: item.fiber_g_per_100g,
          source: item.source as "usda" | "custom",
        }));

        // Persist to IndexedDB and in-memory cache.
        await getCache().set(trimmed, results);
        this.searchCache.set(cacheKey, { data: results, timestamp: Date.now() });
        this.searchFromCache = false;
        this.searchResults = results;
        return results;
      } catch (err) {
        // Network failure: serve any IndexedDB copy as a graceful fallback.
        const stale = await getCache().get<FoodItemSearchResult[]>(trimmed);
        if (stale) {
          this.searchFromCache = true;
          this.searchCache.set(cacheKey, { data: stale, timestamp: Date.now() });
          this.searchResults = stale;
          return stale;
        }
        const message = err instanceof Error ? err.message : "Search failed";
        this.error = message;
        console.error("Food search error:", err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async createCustomFood(
      input: CustomFoodInput,
    ): Promise<FoodItemSearchResult> {
      this.loading = true;
      this.error = null;

      try {
        const supabase = getSupabase();

        // Offline: queue the mutation for background sync and return
        // optimistically so the UI keeps working without a network.
        if (!getOnline().isOnline.value) {
          let createdBy = "";
          try {
            const { data: user } = await supabase.auth.getUser();
            createdBy = user.user?.id ?? "";
          } catch {
            // Auth read failed while offline; queue still proceeds and the
            // flush will retry once we're back online and authenticated.
          }
          const itemId = await getSyncQueue().enqueue({
            type: "createCustomFood",
            payload: { ...input, created_by: createdBy },
          });

          const optimistic: FoodItemSearchResult = {
            id: `offline-${itemId}`,
            name: input.name,
            calories_per_100g: input.calories_per_100g,
            protein_g_per_100g: input.protein_g_per_100g,
            carbs_g_per_100g: input.carbs_g_per_100g,
            fat_g_per_100g: input.fat_g_per_100g,
            fiber_g_per_100g: input.fiber_g_per_100g,
            source: "custom",
          };
          this.searchResults = [optimistic, ...this.searchResults];
          this.error = null;
          return optimistic;
        }

        // Online: normal path — insert to Supabase.
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) throw new Error("Not authenticated");

        const { data, error } = await supabase
          .from("food_items")
          .insert({
            name: input.name,
            calories_per_100g: input.calories_per_100g,
            protein_g_per_100g: input.protein_g_per_100g,
            carbs_g_per_100g: input.carbs_g_per_100g,
            fat_g_per_100g: input.fat_g_per_100g,
            fiber_g_per_100g: input.fiber_g_per_100g,
            source: "custom",
            created_by: user.user.id,
          })
          .select(
            "id, name, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, source",
          )
          .single();

        if (error) throw new Error(error.message);

        const result: FoodItemSearchResult = {
          id: data.id,
          name: data.name,
          calories_per_100g: data.calories_per_100g,
          protein_g_per_100g: data.protein_g_per_100g,
          carbs_g_per_100g: data.carbs_g_per_100g,
          fat_g_per_100g: data.fat_g_per_100g,
          fiber_g_per_100g: data.fiber_g_per_100g,
          source: data.source as "usda" | "custom",
        };

        // Invalidate all caches since new item may match existing queries.
        this.searchCache.clear();
        await getCache().clear();

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create food";
        this.error = message;
        console.error("Create custom food error:", err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    /**
     * Replay queued offline mutations to Supabase. Call when back online.
     */
    async flushSyncQueue(): Promise<void> {
      const supabase = getSupabase();
      await getSyncQueue().flush(async (item) => {
        if (item.type !== "createCustomFood") return;
        const { name, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, created_by } =
          item.payload as CustomFoodInput & { created_by: string };
        const { error } = await supabase
          .from("food_items")
          .insert({
            name,
            calories_per_100g,
            protein_g_per_100g,
            carbs_g_per_100g,
            fat_g_per_100g,
            fiber_g_per_100g,
            source: "custom",
            created_by,
          });
        if (error) throw new Error(error.message);
      });
      // Refresh in-memory results so newly synced custom foods appear.
      this.searchCache.clear();
      await getCache().clear();
    },

    clearCache() {
      this.searchCache.clear();
    },
  },
});
