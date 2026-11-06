<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useDietPlanStore } from "@/stores/dietPlan";
import { useToast } from "#imports";
import { sumMacros } from "@/utils/foodMacros";
import FoodSelector from "@/components/diet-plan/FoodSelector.vue";

definePageMeta({
  layout: "coach",
});

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const profileStore = useProfileStore();
const dietPlanStore = useDietPlanStore();
const toast = useToast();

const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const initialized = ref(false);
const mentees = ref<{ id: string; name: string }[]>([]);
const planId = route.params.id as string;

const planName = ref("");
const startDate = ref("");
const endDate = ref("");
const notes = ref("");

// Date ranges already assigned to this mentee (excluding the plan being edited)
const menteePlanRanges = ref<Map<string, string>>(new Map());

function isDateWithinRange(dateStr: string, rangeStart: string, rangeEnd: string) {
  return dateStr >= rangeStart && dateStr <= rangeEnd;
}

function isStartDateBlocked(dateStr: string) {
  for (const [rangeStart, rangeEnd] of menteePlanRanges.value.entries()) {
    if (isDateWithinRange(dateStr, rangeStart, rangeEnd)) return true;
  }
  return false;
}

function getBlockedDateNotice() {
  const ranges = Array.from(menteePlanRanges.value.entries());
  if (ranges.length === 0) return "";
  const notice = ranges
    .map(([start, end]) => `${start} to ${end}`)
    .join(", ");
  return `This mentee already has plans assigned for: ${notice}. Please choose a start date outside these ranges.`;
}

async function fetchMenteePlanRanges(menteeId: string, excludePlanId: string) {
  menteePlanRanges.value.clear();
  if (!menteeId) return;
  try {
    const plans = await dietPlanStore.fetchPlansForMentee(menteeId);
    plans.forEach((p) => {
      if (p.id === excludePlanId) return; // Skip the plan being edited
      menteePlanRanges.value.set(p.start_date, p.end_date);
    });
  } catch (err) {
    console.error("Failed to fetch mentee plan ranges:", err);
  }
}

interface MealItem {
  id: string;
  foodItemId: string;
  foodName: string;
  quantityG: number;
  macros: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  };
}

const meals = ref<{ id: string; name: string; displayOrder: number; items: MealItem[] }[]>([]);
const snackCount = ref(0);

function getMealTotalMacros(meal: { items: MealItem[] }) {
  return sumMacros(meal.items.map((i) => i.macros));
}

function getDailyTotalMacros() {
  return sumMacros(meals.value.flatMap((m) => m.items.map((i) => i.macros)));
}

onMounted(async () => {
  try {
    if (!authStore.isAuthenticated) {
      await authStore.fetchSession();
    }
    if (!profileStore.id) {
      try {
        await profileStore.fetchProfile();
      } catch (err) {
        console.error("Failed to load profile:", err);
        toast.add({ title: "Failed to load profile", color: "error" });
        loading.value = false;
        router.push("/coach/diet-plans");
        return;
      }
    }

    if (profileStore.role !== "coach") {
      router.push("/");
      return;
    }

    const [menteesData, planData] = await Promise.all([
      dietPlanStore.fetchMentees(),
      dietPlanStore.fetchPlanForEdit(planId),
    ]);

    mentees.value = menteesData.map((m) => ({ id: m.id, name: m.name }));

    if (!planData) {
      toast.add({ title: "Plan not found or access denied", color: "error" });
      loading.value = false;
      return;
    }

    planName.value = planData.name;
    startDate.value = planData.start_date;
    endDate.value = planData.end_date;
    notes.value = planData.notes ?? "";

    // Block date ranges of this mentee's other plans (excluding the one being edited)
    await fetchMenteePlanRanges(planData.mentee_id, planId);

    // Transform meals and items - ensure default meals always exist
    const defaultMealIds = ["breakfast", "lunch", "dinner"];
    const mealMap = new Map(
      planData.meals.map((meal) => [
        meal.id,
        {
          id: meal.id,
          name: meal.name,
          displayOrder: meal.display_order,
          items: meal.items.map((item) => ({
            id: item.id,
            foodItemId: item.food_item_id,
            foodName: item.foodItem?.name ?? "",
            quantityG: item.quantity_g,
            macros: item.macros,
          })),
        },
      ]),
    );

    // Ensure default meals always exist (even if empty)
    defaultMealIds.forEach((defaultId) => {
      if (!mealMap.has(defaultId)) {
        mealMap.set(defaultId, {
          id: defaultId,
          name: defaultId.charAt(0).toUpperCase() + defaultId.slice(1),
          displayOrder: defaultMealIds.indexOf(defaultId),
          items: [],
        });
      }
    });

    meals.value = Array.from(mealMap.values()).sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );

    // Count existing snacks
    const snackMeals = meals.value.filter((m) => m.name.startsWith("Snack "));
    snackCount.value = snackMeals.length;

    initialized.value = true;
  } catch (err) {
    console.error("Failed to load plan:", err);
    toast.add({ title: "Failed to load plan", color: "error" });
  } finally {
    loading.value = false;
  }
});

function addSnack() {
  snackCount.value++;
  meals.value.push({
    id: `snack-${snackCount.value}-${Date.now()}`,
    name: `Snack ${snackCount.value}`,
    displayOrder: 3 + snackCount.value - 1,
    items: [] as MealItem[],
  });
}

function removeMeal(mealId: string) {
  if (meals.value.length <= 3) return;
  meals.value = meals.value.filter((m) => m.id !== mealId);
}

function handleFoodSelected(event: { foodItemId: string; foodName: string; quantityG: number; macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } }, mealId: string) {
  const meal = meals.value.find((m) => m.id === mealId);
  if (!meal) return;

  meal.items.push({
    id: crypto.randomUUID(),
    foodItemId: event.foodItemId,
    foodName: event.foodName,
    quantityG: event.quantityG,
    macros: event.macros,
  });
}

function removeFoodItem(mealId: string, itemId: string) {
  const meal = meals.value.find((m) => m.id === mealId);
  if (meal) {
    meal.items = meal.items.filter((i) => i.id !== itemId);
  }
}

async function savePlan() {
  if (!planName.value || !startDate.value || !endDate.value) {
    toast.add({ title: "Please fill all required fields", color: "error" });
    return;
  }

  // Validate that the selected start date doesn't conflict with other existing plans
  if (isStartDateBlocked(startDate.value)) {
    toast.add({
      title: "Cannot update plan for these dates",
      description: getBlockedDateNotice() || "This mentee already has a plan assigned for the selected start date. Please choose a different date.",
      color: "error",
    });
    return;
  }

  const mealsWithItems = meals.value.filter((m) => m.items.length > 0);
  if (mealsWithItems.length === 0) {
    toast.add({ title: "Please add at least one food item to a meal", color: "error" });
    return;
  }

  saving.value = true;
  try {
    const success = await dietPlanStore.updatePlan(planId, {
      name: planName.value,
      startDate: startDate.value,
      endDate: endDate.value,
      notes: notes.value || undefined,
      meals: mealsWithItems.map((m) => ({
        name: m.name,
        displayOrder: m.displayOrder,
        items: m.items.map((i) => ({
          foodItemId: i.foodItemId,
          foodName: i.foodName,
          quantityG: i.quantityG,
          macros: i.macros,
        })),
      })),
    });

    if (success) {
      toast.add({ title: "Plan updated successfully", color: "success" });
      router.push("/coach/diet-plans");
    } else {
      toast.add({ title: dietPlanStore.error || "Failed to update plan", color: "error" });
    }
  } catch (err) {
    console.error("Failed to update plan:", err);
    const message = err instanceof Error ? err.message : "Failed to update plan";
    if (message.includes("unique constraint") || message.includes("duplicate key")) {
      toast.add({
        title: "Plan already exists for this date",
        description: "This mentee already has a plan starting on the selected date. Please choose a different start date.",
        color: "error",
      });
    } else {
      toast.add({ title: message, color: "error" });
    }
  } finally {
    saving.value = false;
  }
}

async function deletePlan() {
  if (!confirm("Are you sure you want to delete this plan? This action cannot be undone.")) {
    return;
  }

  deleting.value = true;
  try {
    const success = await dietPlanStore.deletePlan(planId);
    if (success) {
      toast.add({ title: "Plan deleted successfully", color: "success" });
      router.push("/coach/diet-plans");
    } else {
      toast.add({ title: dietPlanStore.error || "Failed to delete plan", color: "error" });
    }
  } catch (err) {
    console.error("Failed to delete plan:", err);
    toast.add({ title: err instanceof Error ? err.message : "Failed to delete plan", color: "error" });
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
    </div>

    <div v-else-if="profileStore.role === 'coach'" class="max-w-4xl mx-auto px-4 py-8">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Diet Plan</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">Modify the nutrition plan for your mentee</p>
        </div>
        <button @click="router.push('/coach/diet-plans')" class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          Back
        </button>
      </div>

      <form @submit.prevent="savePlan" class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 class="text-lg font-semibold mb-4">Basic Information</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mentee <span class="text-red-500">*</span>
              </label>
              <select :value="mentees[0]?.id" disabled class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <option v-for="m in mentees" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Mentee cannot be changed for existing plans</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plan Name <span class="text-red-500">*</span>
              </label>
              <input v-model="planName" placeholder="e.g., Cutting Phase Week 1" required class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date <span class="text-red-500">*</span>
              </label>
              <input v-model="startDate" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <p v-if="getBlockedDateNotice()" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {{ getBlockedDateNotice() }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date <span class="text-red-500">*</span>
              </label>
              <input v-model="endDate" type="date" required class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Coach Notes (Optional)
              </label>
              <textarea v-model="notes" rows="3" placeholder="Add any notes for this plan..." class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">Meals</h2>
            <button @click="addSnack" type="button" class="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700">Add Snack</button>
          </div>

          <div class="space-y-6">
            <div v-for="meal in meals" :key="meal.id" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-medium text-gray-900 dark:text-gray-100 capitalize">{{ meal.name }}</h3>
                <div class="flex items-center gap-2">
                  <span class="text-sm text-gray-500 dark:text-gray-400">
                    Total: {{ getMealTotalMacros(meal).calories }} cal • {{ getMealTotalMacros(meal).protein_g }}g protein
                  </span>
                  <button v-if="meal.name.startsWith('Snack ')" @click="removeMeal(meal.id)" type="button" class="px-2 py-1 text-sm text-red-600 hover:text-red-700">Remove</button>
                </div>
              </div>

              <FoodSelector
                @food-selected="($event) => handleFoodSelected($event, meal.id)"
                :placeholder="`Search and add food to ${meal.name}...`"
              />

              <div v-if="meal.items.length > 0" class="mt-4 space-y-2">
                <div v-for="item in meal.items" :key="item.id" class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div class="flex-1">
                    <p class="font-medium text-gray-900 dark:text-gray-100">{{ item.foodName }}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ item.quantityG }}g • {{ item.macros.calories }} cal • P: {{ item.macros.protein_g }}g • C: {{ item.macros.carbs_g }}g • F: {{ item.macros.fat_g }}g • Fib: {{ item.macros.fiber_g }}g
                    </p>
                  </div>
                  <button @click="removeFoodItem(meal.id, item.id)" type="button" class="px-2 py-1 text-sm text-red-600 hover:text-red-700">Remove</button>
                </div>
              </div>
              <div v-else class="text-center text-gray-500 dark:text-gray-400 py-4">
                No foods added yet. Search above to add items.
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="font-semibold mb-2">Daily Totals</h3>
          <div class="grid grid-cols-5 gap-2 text-sm">
            <div class="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div class="font-bold text-gray-900 dark:text-gray-100">{{ getDailyTotalMacros().calories }}</div>
              <div class="text-gray-500 dark:text-gray-400">Calories</div>
            </div>
            <div class="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div class="font-bold text-gray-900 dark:text-gray-100">{{ getDailyTotalMacros().protein_g }}</div>
              <div class="text-gray-500 dark:text-gray-400">Protein (g)</div>
            </div>
            <div class="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div class="font-bold text-gray-900 dark:text-gray-100">{{ getDailyTotalMacros().carbs_g }}</div>
              <div class="text-gray-500 dark:text-gray-400">Carbs (g)</div>
            </div>
            <div class="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div class="font-bold text-gray-900 dark:text-gray-100">{{ getDailyTotalMacros().fat_g }}</div>
              <div class="text-gray-500 dark:text-gray-400">Fat (g)</div>
            </div>
            <div class="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <div class="font-bold text-gray-900 dark:text-gray-100">{{ getDailyTotalMacros().fiber_g }}</div>
              <div class="text-gray-500 dark:text-gray-400">Fiber (g)</div>
            </div>
          </div>
        </div>

        <div class="flex justify-between">
          <button @click="deletePlan" :disabled="deleting" type="button" class="px-4 py-2 text-red-600 hover:text-red-700 font-medium disabled:opacity-50">
            {{ deleting ? "Deleting..." : "Delete Plan" }}
          </button>
          <div class="flex gap-3">
            <button @click="router.push('/coach/diet-plans')" type="button" class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
            <button type="submit" :disabled="saving" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              {{ saving ? "Saving..." : "Save Changes" }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <div v-else class="flex items-center justify-center min-h-screen">
      <div class="max-w-md text-center bg-white dark:bg-gray-800 rounded-xl p-8 shadow-xl">
        <div class="mx-auto mb-4 w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">This page is only accessible to coaches.</p>
        <button @click="router.push('/')" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Go to Dashboard</button>
      </div>
    </div>
  </div>
</template>