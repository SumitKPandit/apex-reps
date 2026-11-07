import { defineStore } from "pinia";
import { getSupabase } from "@/utils/supabase";
import { useProfileStore } from "@/stores/profile";
import type { CalculatedMacros } from "@/utils/foodMacros";
import { z } from "zod";

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

// Coach-facing types
interface CoachMentee {
  id: string;
  name: string;
}

interface CoachPlanSummary {
  id: string;
  name: string;
  mentee_id: string;
  mentee_name: string;
  coach_id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  meals: DietPlanMeal[];
}

interface CreatePlanInput {
  menteeId: string;
  name: string;
  startDate: string;
  endDate: string;
  notes?: string;
  meals: {
    name: string;
    displayOrder: number;
    items: {
      foodItemId: string;
      quantityG: number;
      macros: CalculatedMacros;
    }[];
  }[];
}

interface UpdatePlanInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  meals?: {
    name: string;
    displayOrder: number;
    items: {
      foodItemId: string;
      quantityG: number;
      macros: CalculatedMacros;
    }[];
  }[];
}

// Validation schema for plan input
const planInputSchema = z.object({
  menteeId: z.string().uuid("Invalid mentee ID"),
  name: z
    .string()
    .min(1, "Plan name is required")
    .max(100, "Plan name too long"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format"),
  notes: z.string().optional(),
  meals: z
    .array(
      z.object({
        name: z.string().min(1, "Meal name is required"),
        displayOrder: z.number().int().min(0),
        items: z
          .array(
            z.object({
              foodItemId: z.string().uuid("Invalid food item ID"),
              quantityG: z.number().positive("Quantity must be positive"),
              macros: z.object({
                calories: z.number().int().min(0),
                protein_g: z.number().min(0),
                carbs_g: z.number().min(0),
                fat_g: z.number().min(0),
                fiber_g: z.number().min(0),
              }),
            }),
          )
          .min(1, "Each meal must have at least one food item"),
      }),
    )
    .min(1, "At least one meal is required"),
});

export const useDietPlanStore = defineStore("dietPlan", {
  state: () => ({
    currentPlan: null as DietPlanWithMeals | null,
    logs: {} as Record<string, DietPlanLog>,
    notes: {} as Record<string, string>,
    loading: false,
    error: null as string | null,
    // Coach state
    coachMentees: [] as CoachMentee[],
    coachPlans: [] as CoachPlanSummary[],
  }),

  getters: {
    isLoading: (state) => state.loading,
    lastError: (state) => state.error,
  },

  actions: {
    async fetchPlanForDate(date: string) {
      this.loading = true;
      this.error = null;

      try {
        const profileStore = useProfileStore();
        if (!profileStore.id) {
          await profileStore.fetchProfile();
        }
        if (!profileStore.id) throw new Error("Profile not found");

        const supabase = getSupabase();

        // Get the active plan for this date
        const { data: plan, error: planError } = await supabase
          .from("diet_plans")
          .select("id, name, start_date, end_date, notes")
          .eq("mentee_id", profileStore.id)
          .lte("start_date", date)
          .gte("end_date", date)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (planError) throw new Error(planError.message);

        if (!plan) {
          this.currentPlan = null;
          this.logs = {};
          this.notes = {};
          return;
        }

        // Get meals with food items
        const { data: meals, error: mealsError } = await supabase
          .from("diet_plan_meals")
          .select(
            `
            id,
            name,
            display_order,
            diet_plan_food_items (
              id,
              food_item_id,
              quantity_g,
              calories,
              protein_g,
              carbs_g,
              fat_g,
              fiber_g,
              food_items (
                id,
                name,
                calories_per_100g,
                protein_g_per_100g,
                carbs_g_per_100g,
                fat_g_per_100g,
                fiber_g_per_100g
              )
            )
          `,
          )
          .eq("diet_plan_id", plan.id)
          .order("display_order");

        if (mealsError) throw new Error(mealsError.message);

        // Transform meals
        const transformedMeals: DietPlanMeal[] = (meals ?? []).map((meal) => ({
          id: meal.id,
          name: meal.name,
          display_order: meal.display_order,
          items: (meal.diet_plan_food_items ?? []).map((item) => ({
            id: item.id as string,
            food_item_id: item.food_item_id as string,
            quantity_g: item.quantity_g as number,
            macros: {
              calories: item.calories as number,
              protein_g: item.protein_g as number,
              carbs_g: item.carbs_g as number,
              fat_g: item.fat_g as number,
              fiber_g: item.fiber_g as number,
            },
            foodItem: item.food_items
              ? {
                  id: item.food_items.id as string,
                  name: item.food_items.name as string,
                  calories_per_100g: item.food_items
                    .calories_per_100g as number,
                  protein_g_per_100g: item.food_items
                    .protein_g_per_100g as number,
                  carbs_g_per_100g: item.food_items.carbs_g_per_100g as number,
                  fat_g_per_100g: item.food_items.fat_g_per_100g as number,
                  fiber_g_per_100g: item.food_items.fiber_g_per_100g as number,
                }
              : undefined,
          })),
        }));

        this.currentPlan = {
          id: plan.id,
          name: plan.name,
          start_date: plan.start_date,
          end_date: plan.end_date,
          notes: plan.notes,
          meals: transformedMeals,
        };

        // Fetch logs for this date
        await this.fetchLogs(date);

        // Fetch notes for this date
        await this.fetchNotes(date);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load plan";
        this.error = message;
        console.error("Fetch plan error:", err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchLogs(date: string) {
      if (!this.currentPlan) return;

      try {
        const profileStore = useProfileStore();
        const supabase = getSupabase();

        // Get all food item IDs from the plan
        const foodItemIds = this.currentPlan.meals.flatMap((meal) =>
          meal.items.map((item) => item.id),
        );

        if (foodItemIds.length === 0) {
          this.logs = {};
          return;
        }

        const { data, error } = await supabase
          .from("diet_plan_logs")
          .select("id, food_item_id, consumed, consumed_at")
          .eq("mentee_id", profileStore.id)
          .eq("diet_plan_id", this.currentPlan.id)
          .eq("log_date", date)
          .in("food_item_id", foodItemIds);

        if (error) throw new Error(error.message);

        const typedData = (data ?? []) as unknown as Array<{
          id: string;
          food_item_id: string;
          consumed: boolean;
          consumed_at: string | null;
        }>;

        this.logs = typedData.reduce(
          (acc, log) => {
            acc[log.food_item_id] = log;
            return acc;
          },
          {} as Record<string, DietPlanLog>,
        );
      } catch (err) {
        console.error("Fetch logs error:", err);
      }
    },

    async fetchNotes(date: string) {
      if (!this.currentPlan) return;

      try {
        const profileStore = useProfileStore();
        const supabase = getSupabase();

        const { data, error } = await supabase
          .from("diet_plan_notes")
          .select("notes")
          .eq("mentee_id", profileStore.id)
          .eq("diet_plan_id", this.currentPlan.id)
          .eq("log_date", date)
          .maybeSingle();

        if (error) throw new Error(error.message);

        if (data?.notes) {
          this.notes[date] = data.notes;
        } else {
          this.notes[date] = "";
        }
      } catch (err) {
        console.error("Fetch notes error:", err);
      }
    },

    async toggleConsumed(foodItemId: string, consumed: boolean) {
      if (!this.currentPlan) return;

      try {
        const profileStore = useProfileStore();
        const supabase = getSupabase();

        const { error } = await supabase.from("diet_plan_logs").upsert(
          [
            {
              mentee_id: profileStore.id,
              diet_plan_id: this.currentPlan.id,
              food_item_id: foodItemId,
              log_date: new Date().toISOString().split("T")[0] ?? "",
              consumed,
              consumed_at: consumed ? new Date().toISOString() : null,
            },
          ],
          { onConflict: "mentee_id, food_item_id, log_date" },
        );

        if (error) throw new Error(error.message);

        // Update local state
        this.logs[foodItemId] = {
          ...this.logs[foodItemId],
          id: this.logs[foodItemId]?.id || crypto.randomUUID(),
          food_item_id: foodItemId,
          consumed,
          consumed_at: consumed ? new Date().toISOString() : null,
        };
      } catch (err) {
        console.error("Toggle consumed error:", err);
        throw err;
      }
    },

    async saveNotes(date: string, notes: string) {
      if (!this.currentPlan) return;

      try {
        const profileStore = useProfileStore();
        const supabase = getSupabase();

        const { error } = await supabase.from("diet_plan_notes").upsert({
          mentee_id: profileStore.id,
          diet_plan_id: this.currentPlan.id,
          log_date: date,
          notes,
        });

        if (error) throw new Error(error.message);

        this.notes[date] = notes;
      } catch (err) {
        console.error("Save notes error:", err);
        throw err;
      }
    },

    clearPlan() {
      this.currentPlan = null;
      this.logs = {};
      this.notes = {};
    },

    // ===== Coach Actions =====

    /**
     * Fetch mentees assigned to the current coach
     */
    async fetchMentees(): Promise<CoachMentee[]> {
      this.loading = true;
      this.error = null;

      try {
        const profileStore = useProfileStore();
        if (!profileStore.id) {
          await profileStore.fetchProfile();
        }
        if (!profileStore.id) throw new Error("Profile not found");

        const supabase = getSupabase(true);

        const { data, error } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("role", "mentee")
          .eq("coach_id" as any, profileStore.id);

        if (error) throw new Error(error.message);

        const typedData = (data ?? []) as unknown as Array<{
          id: string;
          name: string;
        }>;

        this.coachMentees = typedData.map((m) => ({
          id: m.id,
          name: m.name,
        }));

        return this.coachMentees;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch mentees";
        this.error = message;
        console.error("Fetch mentees error:", err);
        return [];
      } finally {
        this.loading = false;
      }
    },

    /**
     * Fetch all plans for the current coach's mentees
     */
    async fetchCoachPlans(): Promise<CoachPlanSummary[]> {
      this.loading = true;
      this.error = null;

      try {
        const profileStore = useProfileStore();
        if (!profileStore.id) {
          await profileStore.fetchProfile();
        }
        if (!profileStore.id) throw new Error("Profile not found");

        const supabase = getSupabase(true);

        const { data, error } = await supabase
          .from("diet_plans")
          .select(
            `
            id,
            name,
            mentee_id,
            coach_id,
            start_date,
            end_date,
            notes,
            diet_plan_meals (
              id,
              name,
              display_order,
              diet_plan_food_items (
                id,
                food_item_id,
                quantity_g,
                calories,
                protein_g,
                carbs_g,
                fat_g,
                fiber_g,
                food_items (
                  id,
                  name,
                  calories_per_100g,
                  protein_g_per_100g,
                  carbs_g_per_100g,
                  fat_g_per_100g,
                  fiber_g_per_100g
                )
              )
            )
          `,
          )
          .eq("coach_id", profileStore.id)
          .order("start_date", { ascending: false });

        if (error) throw new Error(error.message);

        const typedData = (data ?? []) as Array<{
          id: string;
          name: string;
          mentee_id: string;
          coach_id: string;
          start_date: string;
          end_date: string;
          notes: string | null;
          diet_plan_meals: Array<{
            id: string;
            name: string;
            display_order: number;
            diet_plan_food_items: Array<{
              id: string;
              food_item_id: string;
              quantity_g: number;
              calories: number;
              protein_g: number;
              carbs_g: number;
              fat_g: number;
              fiber_g: number;
              food_items: {
                id: string;
                name: string;
                calories_per_100g: number;
                protein_g_per_100g: number;
                carbs_g_per_100g: number;
                fat_g_per_100g: number;
                fiber_g_per_100g: number;
              } | null;
            }>;
          }>;
        }>;

        const transformedPlans: CoachPlanSummary[] = typedData.map((plan) => {
          const meals: DietPlanMeal[] = (plan.diet_plan_meals ?? []).map(
            (meal) => ({
              id: meal.id,
              name: meal.name,
              display_order: meal.display_order,
              items: (meal.diet_plan_food_items ?? []).map((item) => ({
                id: item.id as string,
                food_item_id: item.food_item_id as string,
                quantity_g: item.quantity_g as number,
                macros: {
                  calories: item.calories as number,
                  protein_g: item.protein_g as number,
                  carbs_g: item.carbs_g as number,
                  fat_g: item.fat_g as number,
                  fiber_g: item.fiber_g as number,
                },
                foodItem: item.food_items
                  ? {
                      id: item.food_items.id as string,
                      name: item.food_items.name as string,
                      calories_per_100g: item.food_items
                        .calories_per_100g as number,
                      protein_g_per_100g: item.food_items
                        .protein_g_per_100g as number,
                      carbs_g_per_100g: item.food_items
                        .carbs_g_per_100g as number,
                      fat_g_per_100g: item.food_items.fat_g_per_100g as number,
                      fiber_g_per_100g: item.food_items
                        .fiber_g_per_100g as number,
                    }
                  : undefined,
              })),
            }),
          );

          return {
            id: plan.id,
            name: plan.name,
            mentee_id: plan.mentee_id,
            mentee_name: "",
            coach_id: plan.coach_id,
            start_date: plan.start_date,
            end_date: plan.end_date,
            notes: plan.notes,
            meals,
          };
        });

        this.coachPlans = transformedPlans;
        return this.coachPlans;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch plans";
        this.error = message;
        console.error("Fetch coach plans error:", err);
        return [];
      } finally {
        this.loading = false;
      }
    },

    /**
     * Create a new diet plan with meals and food items
     * Transactional: if any step fails, rolls back previous inserts
     */
    async createPlan(input: CreatePlanInput): Promise<{ id: string }> {
      // Validate input
      const validation = planInputSchema.safeParse(input);
      if (!validation.success) {
        const message =
          validation.error.flatten().formErrors.join(", ") ||
          "Validation failed";
        throw new Error(message);
      }

      this.loading = true;
      this.error = null;

      let planId: string | null = null;
      let mealIds: string[] = [];
      let supabase: ReturnType<typeof getSupabase> | null = null;

      try {
        const profileStore = useProfileStore();
        if (!profileStore.id) {
          await profileStore.fetchProfile();
        }
        if (!profileStore.id) throw new Error("Profile not found");

        supabase = getSupabase(true);

        // 1. Insert diet plan
        const { data: plan, error: planError } = await supabase
          .from("diet_plans")
          .insert({
            mentee_id: input.menteeId,
            coach_id: profileStore.id,
            name: input.name,
            start_date: input.startDate,
            end_date: input.endDate,
            notes: input.notes ?? null,
          })
          .select("id")
          .single();

        if (planError) throw new Error(planError.message);
        if (!plan) throw new Error("Failed to create plan");

        planId = plan.id;

        // 2. Insert meals
        const mealsToInsert = input.meals.map((meal) => ({
          diet_plan_id: planId!,
          name: meal.name,
          display_order: meal.displayOrder,
        }));

        const { data: meals, error: mealsError } = await supabase
          .from("diet_plan_meals")
          .insert(mealsToInsert)
          .select("id");

        if (mealsError) throw new Error(mealsError.message);
        if (!meals || meals.length !== input.meals.length) {
          throw new Error("Failed to create all meals");
        }

        mealIds = meals.map((m) => m.id);

        // 3. Insert food items for each meal
        const foodItemsToInsert = input.meals.flatMap((meal, mealIdx) =>
          meal.items.map((item) => ({
            meal_id: mealIds[mealIdx]!,
            food_item_id: item.foodItemId,
            quantity_g: item.quantityG,
            calories: item.macros.calories,
            protein_g: item.macros.protein_g,
            carbs_g: item.macros.carbs_g,
            fat_g: item.macros.fat_g,
            fiber_g: item.macros.fiber_g,
            display_order: 0,
          })),
        );

        const { error: itemsError } = await supabase
          .from("diet_plan_food_items")
          .insert(foodItemsToInsert);

        if (itemsError) throw new Error(itemsError.message);

        return { id: planId };
      } catch (err) {
        // Rollback: delete in reverse order
        if (supabase) {
          if (mealIds.length > 0) {
            try {
              await supabase.from("diet_plan_meals").delete().in("id", mealIds);
            } catch (rollbackErr) {
              console.error("Rollback meals failed:", rollbackErr);
            }
          }
          if (planId) {
            try {
              await supabase.from("diet_plans").delete().eq("id", planId);
            } catch (rollbackErr) {
              console.error("Rollback plan failed:", rollbackErr);
            }
          }
        }

        const message =
          err instanceof Error ? err.message : "Failed to create plan";
        this.error = message;
        console.error("Create plan error:", err);
        throw err;
      } finally {
        this.loading = false;
      }
    },

    /**
     * Update an existing diet plan
     * Strategy: delete old meals/items, insert new ones
     */
    async updatePlan(planId: string, input: UpdatePlanInput): Promise<boolean> {
      this.loading = true;
      this.error = null;

      try {
        const profileStore = useProfileStore();
        if (!profileStore.id) {
          await profileStore.fetchProfile();
        }
        if (!profileStore.id) throw new Error("Profile not found");

        const supabase = getSupabase(true);

        // 1. Update plan basic info if provided
        const planUpdate: {
          name?: string;
          start_date?: string;
          end_date?: string;
          notes?: string | null;
        } = {};
        if (input.name !== undefined) planUpdate.name = input.name;
        if (input.startDate !== undefined)
          planUpdate.start_date = input.startDate;
        if (input.endDate !== undefined) planUpdate.end_date = input.endDate;
        if (input.notes !== undefined) planUpdate.notes = input.notes ?? null;

        if (Object.keys(planUpdate).length > 0) {
          const { error: planError } = await supabase
            .from("diet_plans")
            .update(planUpdate)
            .eq("id", planId)
            .eq("coach_id", profileStore.id);

          if (planError) throw new Error(planError.message);
        }

        // 2. If meals provided, replace them
        if (input.meals) {
          // Delete old meals (cascades to food_items)
          const { error: deleteError } = await supabase
            .from("diet_plan_meals")
            .delete()
            .eq("diet_plan_id", planId);

          if (deleteError) throw new Error(deleteError.message);

          // Insert new meals
          const mealsToInsert = input.meals.map((meal) => ({
            diet_plan_id: planId,
            name: meal.name,
            display_order: meal.displayOrder,
          }));

          const { data: meals, error: mealsError } = await supabase
            .from("diet_plan_meals")
            .insert(mealsToInsert)
            .select("id");

          if (mealsError) throw new Error(mealsError.message);
          if (!meals || meals.length !== input.meals.length) {
            throw new Error("Failed to create all meals");
          }

          const newMealIds = meals.map((m) => m.id);

          // Insert new food items
          const foodItemsToInsert = input.meals.flatMap((meal, mealIdx) =>
            meal.items.map((item) => ({
              meal_id: newMealIds[mealIdx]!,
              food_item_id: item.foodItemId,
              quantity_g: item.quantityG,
              calories: item.macros.calories,
              protein_g: item.macros.protein_g,
              carbs_g: item.macros.carbs_g,
              fat_g: item.macros.fat_g,
              fiber_g: item.macros.fiber_g,
              display_order: 0,
            })),
          );

          const { error: itemsError } = await supabase
            .from("diet_plan_food_items")
            .insert(foodItemsToInsert);

          if (itemsError) throw new Error(itemsError.message);
        }

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update plan";
        this.error = message;
        console.error("Update plan error:", err);
        return false;
      } finally {
        this.loading = false;
      }
    },

    /**
     * Delete a diet plan (cascades to meals and food items via FK)
     */
    async deletePlan(planId: string): Promise<boolean> {
      this.loading = true;
      this.error = null;

      try {
        const profileStore = useProfileStore();
        if (!profileStore.id) {
          await profileStore.fetchProfile();
        }
        if (!profileStore.id) throw new Error("Profile not found");

        const supabase = getSupabase(true);

        const { error } = await supabase
          .from("diet_plans")
          .delete()
          .eq("id", planId)
          .eq("coach_id", profileStore.id);

        if (error) throw new Error(error.message);

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete plan";
        this.error = message;
        console.error("Delete plan error:", err);
        return false;
      } finally {
        this.loading = false;
      }
    },

    /**
     * Fetch existing plans for a specific mentee (lightweight: no meal data)
     * Used to block date ranges that already have a plan assigned.
     */
    async fetchPlansForMentee(menteeId: string): Promise<
      Array<{
        id: string;
        name: string;
        start_date: string;
        end_date: string;
      }>
    > {
      this.loading = true;
      this.error = null;

      try {
        const supabase = getSupabase(true);

        const { data, error } = await supabase
          .from("diet_plans")
          .select("id, name, start_date, end_date")
          .eq("mentee_id", menteeId)
          .order("start_date", { ascending: true });

        if (error) throw new Error(error.message);

        return (data ?? []) as Array<{
          id: string;
          name: string;
          start_date: string;
          end_date: string;
        }>;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch mentee plans";
        this.error = message;
        console.error("Fetch mentee plans error:", err);
        return [];
      } finally {
        this.loading = false;
      }
    },

    /**
     * Fetch a single plan with full structure for editing
     * Only allows coach to fetch their own plans
     */
    async fetchPlanForEdit(planId: string): Promise<CoachPlanSummary | null> {
      this.loading = true;
      this.error = null;

      try {
        const profileStore = useProfileStore();
        if (!profileStore.id) {
          await profileStore.fetchProfile();
        }
        if (!profileStore.id) throw new Error("Profile not found");

        const supabase = getSupabase(true);

        const { data, error } = await supabase
          .from("diet_plans")
          .select(
            `
            id,
            name,
            mentee_id,
            coach_id,
            start_date,
            end_date,
            notes,
            diet_plan_meals (
              id,
              name,
              display_order,
              diet_plan_food_items (
                id,
                food_item_id,
                quantity_g,
                calories,
                protein_g,
                carbs_g,
                fat_g,
                fiber_g,
                food_items (
                  id,
                  name,
                  calories_per_100g,
                  protein_g_per_100g,
                  carbs_g_per_100g,
                  fat_g_per_100g,
                  fiber_g_per_100g
                )
              )
            )
          `,
          )
          .eq("id", planId)
          .eq("coach_id", profileStore.id)
          .maybeSingle();

        if (error) throw new Error(error.message);

        if (!data) return null;

        const typedData = data as {
          id: string;
          name: string;
          mentee_id: string;
          coach_id: string;
          start_date: string;
          end_date: string;
          notes: string | null;
          diet_plan_meals: Array<{
            id: string;
            name: string;
            display_order: number;
            diet_plan_food_items: Array<{
              id: string;
              food_item_id: string;
              quantity_g: number;
              calories: number;
              protein_g: number;
              carbs_g: number;
              fat_g: number;
              fiber_g: number;
              food_items: {
                id: string;
                name: string;
                calories_per_100g: number;
                protein_g_per_100g: number;
                carbs_g_per_100g: number;
                fat_g_per_100g: number;
                fiber_g_per_100g: number;
              } | null;
            }>;
          }>;
        };

        const meals: DietPlanMeal[] = (typedData.diet_plan_meals ?? []).map(
          (meal) => ({
            id: meal.id,
            name: meal.name,
            display_order: meal.display_order,
            items: (meal.diet_plan_food_items ?? []).map((item) => ({
              id: item.id as string,
              food_item_id: item.food_item_id as string,
              quantity_g: item.quantity_g as number,
              macros: {
                calories: item.calories as number,
                protein_g: item.protein_g as number,
                carbs_g: item.carbs_g as number,
                fat_g: item.fat_g as number,
                fiber_g: item.fiber_g as number,
              },
              foodItem: item.food_items
                ? {
                    id: item.food_items.id as string,
                    name: item.food_items.name as string,
                    calories_per_100g: item.food_items
                      .calories_per_100g as number,
                    protein_g_per_100g: item.food_items
                      .protein_g_per_100g as number,
                    carbs_g_per_100g: item.food_items
                      .carbs_g_per_100g as number,
                    fat_g_per_100g: item.food_items.fat_g_per_100g as number,
                    fiber_g_per_100g: item.food_items
                      .fiber_g_per_100g as number,
                  }
                : undefined,
            })),
          }),
        );

        return {
          id: typedData.id,
          name: typedData.name,
          mentee_id: typedData.mentee_id,
          mentee_name: "",
          coach_id: typedData.coach_id,
          start_date: typedData.start_date,
          end_date: typedData.end_date,
          notes: typedData.notes,
          meals,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch plan for edit";
        this.error = message;
        console.error("Fetch plan for edit error:", err);
        return null;
      } finally {
        this.loading = false;
      }
    },
  },
});
