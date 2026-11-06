<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useDietPlanStore } from "@/stores/dietPlan";

const router = useRouter();
const authStore = useAuthStore();
const profileStore = useProfileStore();
const dietPlanStore = useDietPlanStore();

const loading = ref(true);
const today = new Date().toISOString().split("T")[0] ?? "";
const selectedDate = ref<string>(today);
const collapsed = ref<Record<string, boolean>>({});

function toggleMeal(mealId: string) {
  collapsed.value[mealId] = !collapsed.value[mealId];
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await authStore.fetchSession();
  }
  if (!profileStore.id) {
    await profileStore.fetchProfile();
  }
  
  loading.value = false;
  
  if (profileStore.role !== "mentee") {
    router.push("/");
    return;
  }
  
  await loadPlanForDate(selectedDate.value);
});

async function loadPlanForDate(date: string) {
  try {
    await dietPlanStore.fetchPlanForDate(date);
  } catch (err) {
    console.error("Failed to load plan:", err);
  }
}

watch(selectedDate, (newDate) => {
  if (newDate) loadPlanForDate(newDate);
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function prevDay() {
  const date = new Date(selectedDate.value ?? today);
  date.setDate(date.getDate() - 1);
  selectedDate.value = date.toISOString().split("T")[0] ?? today;
}

function nextDay() {
  const date = new Date(selectedDate.value ?? today);
  date.setDate(date.getDate() + 1);
  selectedDate.value = date.toISOString().split("T")[0] ?? today;
}

function goToToday() {
  selectedDate.value = today;
}

interface MacroAccumulator {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

interface DietPlanLogItem {
  food_item_id: string;
  macros?: MacroAccumulator;
  consumed?: boolean;
}

function getDayTotalMacros(): MacroAccumulator {
  const plan = dietPlanStore.currentPlan;
  if (!plan) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
  
  return plan.meals.reduce((acc: MacroAccumulator, meal: { items: Array<{ macros?: MacroAccumulator }> }) => {
    meal.items.forEach((item) => {
      acc.calories += item.macros?.calories || 0;
      acc.protein_g = Number((acc.protein_g + (item.macros?.protein_g || 0)).toFixed(2));
      acc.carbs_g = Number((acc.carbs_g + (item.macros?.carbs_g || 0)).toFixed(2));
      acc.fat_g = Number((acc.fat_g + (item.macros?.fat_g || 0)).toFixed(2));
      acc.fiber_g = Number((acc.fiber_g + (item.macros?.fiber_g || 0)).toFixed(2));
    });
    return acc;
  }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
}

function getConsumedMacros(): MacroAccumulator {
  const plan = dietPlanStore.currentPlan;
  const logs = dietPlanStore.logs || {};

  // Build a lookup of macros by food item id from the plan's meals.
  // Logs only store food_item_id + consumed — macros live on the plan items.
  const macrosById: Record<string, MacroAccumulator> = {};
  plan?.meals.forEach((meal) => {
    meal.items.forEach((item) => {
      macrosById[item.id] = item.macros;
    });
  });

  return Object.values(logs)
    .filter((log: DietPlanLogItem) => log.consumed)
    .reduce((acc: MacroAccumulator, log: DietPlanLogItem) => {
      const macros = macrosById[log.food_item_id];
      if (macros) {
        acc.calories += macros.calories || 0;
        acc.protein_g = Number((acc.protein_g + (macros.protein_g || 0)).toFixed(2));
        acc.carbs_g = Number((acc.carbs_g + (macros.carbs_g || 0)).toFixed(2));
        acc.fat_g = Number((acc.fat_g + (macros.fat_g || 0)).toFixed(2));
        acc.fiber_g = Number((acc.fiber_g + (macros.fiber_g || 0)).toFixed(2));
      }
      return acc;
    }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });
}

function getProgressPercentage(consumed: number, planned: number) {
  if (planned === 0) return 0;
  return Math.min(100, Math.round((consumed / planned) * 100));
}

async function toggleConsumed(itemId: string, consumed: boolean) {
  try {
    await dietPlanStore.toggleConsumed(itemId, consumed);
  } catch (err) {
    console.error("Failed to toggle consumption:", err);
  }
}

async function saveNotes(notes: string) {
  try {
    await dietPlanStore.saveNotes(selectedDate.value, notes);
  } catch (err) {
    console.error("Failed to save notes:", err);
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent" />
    </div>
    
    <div v-else-if="profileStore.role !== 'mentee'" class="flex items-center justify-center min-h-screen">
      <div class="max-w-md text-center bg-white dark:bg-gray-800 rounded-xl p-8 shadow-xl">
        <div class="mx-auto mb-4 w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">This page is only accessible to mentees.</p>
        <button @click="router.push('/')" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Go to Dashboard</button>
      </div>
    </div>
    
    <div v-else class="max-w-4xl mx-auto px-4 py-6">
      <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 mb-6">
        <div class="max-w-4xl mx-auto px-4 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Diet Plan</h1>
              <p class="text-gray-600 dark:text-gray-400">{{ formatDate(selectedDate) }}</p>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="date"
                v-model="selectedDate"
                :min="dietPlanStore.currentPlan?.start_date ?? ''"
                :max="dietPlanStore.currentPlan?.end_date ?? ''"
                class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <button @click="prevDay" class="px-3 py-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">←</button>
              <button @click="goToToday" class="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700">Today</button>
              <button @click="nextDay" class="px-3 py-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">→</button>
            </div>
          </div>
        </div>
</header>
      
      <template v-if="dietPlanStore.currentPlan">
        <!-- Consolidated Daily Progress Card -->
        <UCard class="mb-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Daily Progress</h2>
              <span class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ getConsumedMacros().calories }} / {{ getDayTotalMacros().calories }} kcal
              </span>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div v-for="macro in [
                { key: 'protein_g', label: 'Protein', unit: 'g', color: 'red', bg: 'bg-red-500' },
                { key: 'carbs_g', label: 'Carbs', unit: 'g', color: 'blue', bg: 'bg-blue-500' },
                { key: 'fat_g', label: 'Fat', unit: 'g', color: 'yellow', bg: 'bg-yellow-500' },
                { key: 'fiber_g', label: 'Fiber', unit: 'g', color: 'green', bg: 'bg-green-500' }
              ]" :key="macro.key">
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ macro.label }}</span>
                    <span class="text-sm text-gray-500 dark:text-gray-400">
                      {{ getConsumedMacros()[macro.key] }} / {{ getDayTotalMacros()[macro.key] }} {{ macro.unit }}
                    </span>
                  </div>
                  <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full transition-all duration-300 rounded-full" :class="macro.bg" :style="{ width: getProgressPercentage(getConsumedMacros()[macro.key], getDayTotalMacros()[macro.key]) + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Meals -->
        <div class="space-y-6">
          <div v-for="meal in dietPlanStore.currentPlan.meals" :key="meal.id" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              @click="toggleMeal(meal.id)"
              class="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50"
              type="button"
            >
              <h3 class="font-semibold text-gray-900 dark:text-gray-100 capitalize">{{ meal.name }}</h3>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ meal.items.length }} items</span>
              <span
                class="text-gray-500 dark:text-gray-400 transition-transform duration-200"
                :class="{ 'rotate-180': collapsed[meal.id] }"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            
            <div v-if="meal.items.length === 0" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              No foods in this meal.
            </div>
            
            <transition name="slide" mode="out-in">
              <div
                v-if="!collapsed[meal.id]"
                key="meal-items"
                class="divide-y divide-gray-200 dark:divide-gray-700"
              >
                <div v-for="item in meal.items" :key="item.id" class="px-4 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-900 dark:text-gray-100 truncate">{{ item.foodItem?.name || 'Food Item' }}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ item.quantity_g }}g • {{ item.macros?.calories }} cal • P: {{ item.macros?.protein_g }}g • C: {{ item.macros?.carbs_g }}g • F: {{ item.macros?.fat_g }}g
                    </p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer ml-4">
                    <input type="checkbox" :checked="dietPlanStore.logs[item.id]?.consumed" @change="toggleConsumed(item.id, $event.target.checked)" class="sr-only peer" />
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </transition>
          </div>
        </div>
        
        <div class="mt-8">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-semibold mb-4">Daily Notes</h2>
            <textarea
              :value="dietPlanStore.notes[selectedDate] || ''"
              placeholder="Add notes for today..."
              rows="4"
              @input="saveNotes($event.target.value)"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </template>
      
      <template v-else>
        <div class="text-center py-12">
          <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 class="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">No Diet Plan for This Date</h3>
          <p class="text-gray-500 dark:text-gray-400">Your coach hasn't assigned a plan for {{ formatDate(selectedDate) }} yet.</p>
        </div>
        
        <div class="mt-8">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 class="text-lg font-semibold mb-4">Daily Notes</h2>
            <textarea
              :value="dietPlanStore.notes[selectedDate] || ''"
              placeholder="Add notes for today..."
              rows="4"
              @input="saveNotes($event.target.value)"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>