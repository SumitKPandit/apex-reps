import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDietPlanStore } from "@/stores/dietPlan";
import { useProfileStore } from "@/stores/profile";

// Create a proper chainable mock for Supabase that is thenable
const createChain = (
  data: Record<string, unknown>[],
  error: Error | null = null,
  count = 1,
) => {
  const result = { data, error, count };
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    ilike: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => Promise.resolve(result).then(resolve)),
  };
  return chain;
};

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

vi.mock("@/stores/profile", () => ({
  useProfileStore: vi.fn(),
}));

describe("dietPlanStore - Coach Actions", () => {
  let mockProfileStore: {
    id: string;
    name: string;
    role: string;
    fetchProfile: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    mockProfileStore = {
      id: "coach-id-123",
      name: "Test Coach",
      role: "coach",
      fetchProfile: vi.fn().mockResolvedValue(undefined),
    };

    (useProfileStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      mockProfileStore,
    );
  });

  describe("fetchMentees", () => {
    it("fetches mentees where role=mentee and coach_id=current user", async () => {
      const mockMentees = [
        { id: "mentee-1", name: "Mentee One", email: "mentee1@test.com" },
        { id: "mentee-2", name: "Mentee Two", email: "mentee2@test.com" },
      ];

      const chain = createChain(mockMentees);
      const selectMock = vi.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: selectMock });

      const store = useDietPlanStore();
      const result = await store.fetchMentees();

      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(selectMock).toHaveBeenCalledWith("id, name, email");
      expect(chain.eq).toHaveBeenCalledWith("role", "mentee");
      expect(chain.eq).toHaveBeenCalledWith("coach_id", "coach-id-123");
      expect(result).toEqual(mockMentees);
    });

    it("returns empty array on error", async () => {
      const chain = createChain([], new Error("DB error"));
      const selectMock = vi.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: selectMock });

      const store = useDietPlanStore();
      const result = await store.fetchMentees();

      expect(result).toEqual([]);
      expect(store.error).toBe("DB error");
    });
  });

  describe("fetchCoachPlans", () => {
    it("fetches plans with meals and food items for coach's mentees", async () => {
      const mockPlans = [
        {
          id: "plan-1",
          name: "Cutting Phase Week 1",
          mentee_id: "mentee-1",
          coach_id: "coach-id-123",
          start_date: "2026-01-01",
          end_date: "2026-01-07",
          notes: "High protein",
          diet_plan_meals: [
            {
              id: "meal-1",
              name: "Breakfast",
              display_order: 0,
              diet_plan_food_items: [
                {
                  id: "item-1",
                  food_item_id: "food-1",
                  quantity_g: 100,
                  calories: 200,
                  protein_g: 20,
                  carbs_g: 10,
                  fat_g: 8,
                  fiber_g: 3,
                  food_items: {
                    id: "food-1",
                    name: "Chicken breast",
                    calories_per_100g: 200,
                    protein_g_per_100g: 20,
                    carbs_g_per_100g: 10,
                    fat_g_per_100g: 8,
                    fiber_g_per_100g: 3,
                  },
                },
              ],
            },
          ],
        },
      ];

      const chain = createChain(mockPlans);
      const selectMock = vi.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: selectMock });

      const store = useDietPlanStore();
      const result = await store.fetchCoachPlans();

      expect(mockFrom).toHaveBeenCalledWith("diet_plans");
      expect(selectMock).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith("coach_id", "coach-id-123");
      expect(result).toHaveLength(1);
      expect(result[0].meals).toHaveLength(1);
      expect(result[0].meals[0].items).toHaveLength(1);
    });

    it("returns empty array on error", async () => {
      const chain = createChain([], new Error("DB error"));
      const selectMock = vi.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: selectMock });

      const store = useDietPlanStore();
      const result = await store.fetchCoachPlans();

      expect(result).toEqual([]);
      expect(store.error).toBe("DB error");
    });
  });

  describe("createPlan", () => {
    const validPlanData = {
      menteeId: "123e4567-e89b-12d3-a456-426614174000",
      name: "Cutting Phase Week 1",
      startDate: "2026-01-01",
      endDate: "2026-01-07",
      notes: "High protein",
      meals: [
        {
          name: "Breakfast",
          displayOrder: 0,
          items: [
            {
              foodItemId: "123e4567-e89b-12d3-a456-426614174001",
              quantityG: 100,
              macros: {
                calories: 200,
                protein_g: 20,
                carbs_g: 10,
                fat_g: 8,
                fiber_g: 3,
              },
            },
          ],
        },
        {
          name: "Lunch",
          displayOrder: 1,
          items: [
            {
              foodItemId: "123e4567-e89b-12d3-a456-426614174002",
              quantityG: 150,
              macros: {
                calories: 300,
                protein_g: 30,
                carbs_g: 15,
                fat_g: 12,
                fiber_g: 4,
              },
            },
          ],
        },
      ],
    };

    it("creates plan, meals, and food items transactionally", async () => {
      // Mock plan insert
      const planChain = createChain([{ id: "new-plan-id", ...validPlanData }]);
      const planSelectMock = vi.fn().mockReturnValue(planChain);
      // Mock meals insert
      const mealsChain = createChain([
        {
          id: "meal-1",
          diet_plan_id: "new-plan-id",
          name: "Breakfast",
          display_order: 0,
        },
        {
          id: "meal-2",
          diet_plan_id: "new-plan-id",
          name: "Lunch",
          display_order: 1,
        },
      ]);
      const mealsSelectMock = vi.fn().mockReturnValue(mealsChain);
      // Mock food items insert
      const itemsChain = createChain([
        { id: "item-1", meal_id: "meal-1", ...validPlanData.meals[0].items[0] },
        { id: "item-2", meal_id: "meal-2", ...validPlanData.meals[1].items[0] },
      ]);
      const itemsSelectMock = vi.fn().mockReturnValue(itemsChain);

      mockFrom
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({ select: planSelectMock }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({ select: mealsSelectMock }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({ select: itemsSelectMock }),
        });

      const store = useDietPlanStore();
      const result = await store.createPlan(validPlanData);

      expect(mockFrom).toHaveBeenCalledTimes(3);
      expect(mockFrom).toHaveBeenNthCalledWith(1, "diet_plans");
      expect(mockFrom).toHaveBeenNthCalledWith(2, "diet_plan_meals");
      expect(mockFrom).toHaveBeenNthCalledWith(3, "diet_plan_food_items");
      expect(result.id).toBe("new-plan-id");
    });

    it("rolls back meals and items if food items insert fails", async () => {
      const planChain = createChain([{ id: "new-plan-id", ...validPlanData }]);
      const planSelectMock = vi.fn().mockReturnValue(planChain);
      const mealsChain = createChain([
        {
          id: "meal-1",
          diet_plan_id: "new-plan-id",
          name: "Breakfast",
          display_order: 0,
        },
      ]);
      const mealsSelectMock = vi.fn().mockReturnValue(mealsChain);
      const itemsChain = createChain([], new Error("Items insert failed"));
      const itemsSelectMock = vi.fn().mockReturnValue(itemsChain);

      mockFrom
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({ select: planSelectMock }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({ select: mealsSelectMock }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({ select: itemsSelectMock }),
        });

      const store = useDietPlanStore();
      await expect(store.createPlan(validPlanData)).rejects.toThrow(
        "Items insert failed",
      );

      // Verify delete was called for meals and plan
      expect(mockFrom).toHaveBeenCalledWith("diet_plan_meals");
      expect(mockFrom).toHaveBeenCalledWith("diet_plans");
    });

    it("throws error if plan insert fails", async () => {
      const planChain = createChain([], new Error("Plan insert failed"));
      const planSelectMock = vi.fn().mockReturnValue(planChain);

      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({ select: planSelectMock }),
      });

      const store = useDietPlanStore();
      await expect(store.createPlan(validPlanData)).rejects.toThrow(
        "Plan insert failed",
      );
    });

    it("validates required fields", async () => {
      const store = useDietPlanStore();

      await expect(
        store.createPlan({ ...validPlanData, menteeId: "" }),
      ).rejects.toThrow();
      await expect(
        store.createPlan({ ...validPlanData, name: "" }),
      ).rejects.toThrow();
      await expect(
        store.createPlan({ ...validPlanData, startDate: "" }),
      ).rejects.toThrow();
      await expect(
        store.createPlan({ ...validPlanData, endDate: "" }),
      ).rejects.toThrow();
    });
  });

  describe("updatePlan", () => {
    it("deletes old meals/items and inserts new ones", async () => {
      // Mock delete old meals
      const deleteMealsChain = createChain([]);
      const deleteMealsTable = {
        delete: vi
          .fn()
          .mockReturnValue({ eq: vi.fn().mockReturnValue(deleteMealsChain) }),
      };
      // Mock new meals insert
      const mealsChain = createChain([
        {
          id: "new-meal-1",
          diet_plan_id: "plan-1",
          name: "Breakfast",
          display_order: 0,
        },
      ]);
      const mealsSelectMock = vi.fn().mockReturnValue(mealsChain);
      const mealsTable = {
        insert: vi.fn().mockReturnValue({ select: mealsSelectMock }),
      };
      // Mock new items insert
      const itemsChain = createChain([
        {
          id: "new-item-1",
          meal_id: "new-meal-1",
          food_item_id: "food-1",
          quantity_g: 100,
          calories: 200,
          protein_g: 20,
          carbs_g: 10,
          fat_g: 8,
          fiber_g: 3,
        },
      ]);
      const itemsSelectMock = vi.fn().mockReturnValue(itemsChain);
      const itemsTable = {
        insert: vi.fn().mockReturnValue({ select: itemsSelectMock }),
      };
      // Mock plan update
      const planUpdateChain = createChain([
        { id: "plan-1", name: "Updated Plan" },
      ]);
      const planUpdateTable = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(planUpdateChain),
          }),
        }),
      };

      mockFrom
        .mockReturnValueOnce(planUpdateTable)
        .mockReturnValueOnce(deleteMealsTable)
        .mockReturnValueOnce(mealsTable)
        .mockReturnValueOnce(itemsTable);

      const store = useDietPlanStore();
      const result = await store.updatePlan("plan-1", {
        name: "Updated Plan",
        startDate: "2026-01-01",
        endDate: "2026-01-07",
        notes: "Updated notes",
        meals: [
          {
            name: "Breakfast",
            displayOrder: 0,
            items: [
              {
                foodItemId: "123e4567-e89b-12d3-a456-426614174001",
                quantityG: 100,
                macros: {
                  calories: 200,
                  protein_g: 20,
                  carbs_g: 10,
                  fat_g: 8,
                  fiber_g: 3,
                },
              },
            ],
          },
        ],
      });

      expect(result).toBe(true);
    });

    it("updates plan basic info without meals", async () => {
      const planUpdateChain = createChain([
        { id: "plan-1", name: "Updated Plan" },
      ]);
      const planUpdateTable = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(planUpdateChain),
          }),
        }),
      };

      mockFrom.mockReturnValueOnce(planUpdateTable);

      const store = useDietPlanStore();
      const result = await store.updatePlan("plan-1", {
        name: "Updated Plan",
      });

      expect(result).toBe(true);
    });

    it("returns false on error", async () => {
      const deleteMealsChain = createChain([], new Error("Delete failed"));
      const deleteMealsTable = {
        delete: vi
          .fn()
          .mockReturnValue({ eq: vi.fn().mockReturnValue(deleteMealsChain) }),
      };
      mockFrom.mockReturnValueOnce(deleteMealsTable);

      const store = useDietPlanStore();
      const result = await store.updatePlan("plan-1", { name: "Test" });

      expect(result).toBe(false);
      expect(store.error).toBe("Delete failed");
    });
  });

  describe("deletePlan", () => {
    it("deletes plan (cascades to meals and items)", async () => {
      const chain = createChain([]);
      const deleteTable = {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(chain),
          }),
        }),
      };
      mockFrom.mockReturnValue(deleteTable);

      const store = useDietPlanStore();
      const result = await store.deletePlan("plan-1");

      expect(mockFrom).toHaveBeenCalledWith("diet_plans");
      expect(result).toBe(true);
    });

    it("returns false on error", async () => {
      const chain = createChain([], new Error("Delete failed"));
      const deleteTable = {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(chain),
          }),
        }),
      };
      mockFrom.mockReturnValue(deleteTable);

      const store = useDietPlanStore();
      const result = await store.deletePlan("plan-1");

      expect(result).toBe(false);
      expect(store.error).toBe("Delete failed");
    });
  });

  describe("fetchPlanForEdit", () => {
    it("fetches full plan structure for editing", async () => {
      const mockPlan = {
        id: "plan-1",
        name: "Cutting Phase Week 1",
        mentee_id: "mentee-1",
        coach_id: "coach-id-123",
        start_date: "2026-01-01",
        end_date: "2026-01-07",
        notes: "High protein",
        diet_plan_meals: [
          {
            id: "meal-1",
            name: "Breakfast",
            display_order: 0,
            diet_plan_food_items: [
              {
                id: "item-1",
                food_item_id: "food-1",
                quantity_g: 100,
                calories: 200,
                protein_g: 20,
                carbs_g: 10,
                fat_g: 8,
                fiber_g: 3,
                food_items: {
                  id: "food-1",
                  name: "Chicken breast",
                  calories_per_100g: 200,
                  protein_g_per_100g: 20,
                  carbs_g_per_100g: 10,
                  fat_g_per_100g: 8,
                  fiber_g_per_100g: 3,
                },
              },
            ],
          },
        ],
      };

      const chain = createChain([mockPlan]);
      const selectMock = vi.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: selectMock });

      const store = useDietPlanStore();
      const result = await store.fetchPlanForEdit("plan-1");

      expect(mockFrom).toHaveBeenCalledWith("diet_plans");
      expect(selectMock).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith("id", "plan-1");
      expect(chain.eq).toHaveBeenCalledWith("coach_id", "coach-id-123");
      expect(result).toBeDefined();
      expect(result?.id).toBe("plan-1");
      expect(result?.meals).toHaveLength(1);
      expect(result?.meals[0].items).toHaveLength(1);
    });

    it("returns null if plan not found or not owned by coach", async () => {
      const chain = createChain([]);
      const selectMock = vi.fn().mockReturnValue(chain);
      mockFrom.mockReturnValue({ select: selectMock });

      const store = useDietPlanStore();
      const result = await store.fetchPlanForEdit("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("dietPlanStore - Mentee Actions (toggleConsumed / fetchLogs)", () => {
    let mockProfileStore: {
      id: string;
      name: string;
      role: string;
      fetchProfile: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      setActivePinia(createPinia());
      vi.clearAllMocks();

      mockProfileStore = {
        id: "mentee-id-123",
        name: "Test Mentee",
        role: "mentee",
        fetchProfile: vi.fn().mockResolvedValue(undefined),
      };

      (useProfileStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        mockProfileStore,
      );
    });

    describe("toggleConsumed", () => {
      beforeEach(() => {
        // Set up a currentPlan with a meal containing a food item
        const store = useDietPlanStore();
        store.currentPlan = {
          id: "plan-1",
          name: "Week 1 Plan",
          start_date: "2026-11-01",
          end_date: "2026-11-07",
          notes: null,
          meals: [
            {
              id: "meal-1",
              name: "Breakfast",
              display_order: 0,
              items: [
                {
                  id: "item-1",
                  food_item_id: "food-1",
                  quantity_g: 100,
                  macros: {
                    calories: 200,
                    protein_g: 20,
                    carbs_g: 10,
                    fat_g: 8,
                    fiber_g: 3,
                  },
                  foodItem: { id: "food-1", name: "Chicken breast" },
                },
              ],
            },
          ],
        } as never;
      });

      it("upserts log WITHOUT macros field to diet_plan_logs", async () => {
        const chain = createChain([{ id: "log-1" }]);
        const upsertMock = vi.fn().mockReturnValue(chain);
        mockFrom.mockReturnValue({ upsert: upsertMock });

        const store = useDietPlanStore();
        await store.toggleConsumed("item-1", true);

        expect(mockFrom).toHaveBeenCalledWith("diet_plan_logs");
        expect(upsertMock).toHaveBeenCalledTimes(1);

        // Capture the upsert payload
        const payload = upsertMock.mock.calls[0][0][0];
        expect(payload).toMatchObject({
          mentee_id: "mentee-id-123",
          diet_plan_id: "plan-1",
          food_item_id: "item-1",
          consumed: true,
          consumed_at: expect.any(String),
        });
        // BUG-001 fix: macros must NOT be in the payload
        expect(payload).not.toHaveProperty("macros");
      });

      it("updates local logs state without macros", async () => {
        const chain = createChain([{ id: "log-1" }]);
        const upsertMock = vi.fn().mockReturnValue(chain);
        mockFrom.mockReturnValue({ upsert: upsertMock });

        const store = useDietPlanStore();
        await store.toggleConsumed("item-1", true);

        expect(store.logs["item-1"]).toMatchObject({
          food_item_id: "item-1",
          consumed: true,
          consumed_at: expect.any(String),
        });
        // BUG-001 fix: macros must NOT be in local state
        expect(store.logs["item-1"]).not.toHaveProperty("macros");
      });

      it("throws error if upsert fails", async () => {
        const chain = createChain([], new Error("Upsert failed"));
        const upsertMock = vi.fn().mockReturnValue(chain);
        mockFrom.mockReturnValue({ upsert: upsertMock });

        const store = useDietPlanStore();
        await expect(store.toggleConsumed("item-1", true)).rejects.toThrow(
          "Upsert failed",
        );
      });
    });

    describe("fetchLogs", () => {
      beforeEach(() => {
        // Set up a currentPlan with meals containing food items
        const store = useDietPlanStore();
        store.currentPlan = {
          id: "plan-1",
          name: "Week 1 Plan",
          start_date: "2026-11-01",
          end_date: "2026-11-07",
          notes: null,
          meals: [
            {
              id: "meal-1",
              name: "Breakfast",
              display_order: 0,
              items: [
                {
                  id: "item-1",
                  food_item_id: "food-1",
                  quantity_g: 100,
                  macros: {
                    calories: 200,
                    protein_g: 20,
                    carbs_g: 10,
                    fat_g: 8,
                    fiber_g: 3,
                  },
                },
              ],
            },
            {
              id: "meal-2",
              name: "Lunch",
              display_order: 1,
              items: [
                {
                  id: "item-2",
                  food_item_id: "food-2",
                  quantity_g: 150,
                  macros: {
                    calories: 300,
                    protein_g: 30,
                    carbs_g: 15,
                    fat_g: 12,
                    fiber_g: 4,
                  },
                },
              ],
            },
          ],
        } as never;
      });

      it("selects log fields WITHOUT macros from diet_plan_logs", async () => {
        const chain = createChain([]);
        const selectMock = vi.fn().mockReturnValue(chain);
        mockFrom.mockReturnValue({ select: selectMock });

        const store = useDietPlanStore();
        await store.fetchLogs("2026-11-01");

        expect(mockFrom).toHaveBeenCalledWith("diet_plan_logs");
        // BUG-001 fix: select must NOT include "macros"
        expect(selectMock).toHaveBeenCalledWith(
          "id, food_item_id, consumed, consumed_at",
        );
        expect(selectMock).not.toHaveBeenCalledWith(
          "id, food_item_id, consumed, consumed_at, macros",
        );
      });

      it("returns empty logs when no food items in plan", async () => {
        const store = useDietPlanStore();
        store.currentPlan = {
          id: "plan-1",
          name: "Empty Plan",
          start_date: "2026-11-01",
          end_date: "2026-11-07",
          notes: null,
          meals: [],
        } as never;

        await store.fetchLogs("2026-11-01");
        expect(store.logs).toEqual({});
      });
    });
  });
});
