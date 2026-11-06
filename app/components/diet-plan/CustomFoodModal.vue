<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useFoodItemStore } from "@/stores/foodItem";
import { z } from "zod";

interface Emits {
  close: [];
  created: [
    food: {
      id: string;
      name: string;
      calories_per_100g: number;
      protein_g_per_100g: number;
      carbs_g_per_100g: number;
      fat_g_per_100g: number;
      fiber_g_per_100g: number;
      source: "usda" | "custom";
    },
  ];
}

const emit = defineEmits<Emits>();

const store = useFoodItemStore();

// Toast is optional - may not be available in test environment
interface ToastInterface {
  add: (options: { title: string; color?: string }) => void;
}
let toast: ToastInterface | null = null;
try {
  const { useToast } = await import("@nuxt/ui/composables/useToast");
  toast = useToast() as unknown as ToastInterface;
} catch {
  // Toast not available (e.g., in tests)
  toast = { add: () => {} };
}

// Validation schema
const customFoodSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  calories_per_100g: z
    .number()
    .int()
    .min(0, "Calories cannot be negative")
    .max(9999, "Calories too high"),
  protein_g_per_100g: z
    .number()
    .min(0, "Protein cannot be negative")
    .max(999, "Protein too high"),
  carbs_g_per_100g: z
    .number()
    .min(0, "Carbs cannot be negative")
    .max(999, "Carbs too high"),
  fat_g_per_100g: z
    .number()
    .min(0, "Fat cannot be negative")
    .max(999, "Fat too high"),
  fiber_g_per_100g: z
    .number()
    .min(0, "Fiber cannot be negative")
    .max(999, "Fiber too high"),
});

type CustomFoodForm = z.infer<typeof customFoodSchema>;

const form = ref<CustomFoodForm>({
  name: "",
  calories_per_100g: 0,
  protein_g_per_100g: 0,
  carbs_g_per_100g: 0,
  fat_g_per_100g: 0,
  fiber_g_per_100g: 0,
});

const errors = ref<Partial<Record<keyof CustomFoodForm, string>>>({});
const submitting = ref(false);

const isValid = computed(() => {
  const result = customFoodSchema.safeParse(form.value);
  return result.success;
});

function validateForm(): boolean {
  const result = customFoodSchema.safeParse(form.value);
  if (!result.success) {
    errors.value = result.error.flatten().fieldErrors as Partial<
      Record<keyof CustomFoodForm, string>
    >;
    return false;
  }
  errors.value = {};
  return true;
}

async function handleSubmit() {
  if (!validateForm()) return;

  submitting.value = true;
  try {
    const food = await store.createCustomFood(form.value);
    emit("created", food);
    resetForm();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create food";
    toast?.add({ title: message, color: "error" });
    console.error("Failed to create custom food:", err);
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  form.value = {
    name: "",
    calories_per_100g: 0,
    protein_g_per_100g: 0,
    carbs_g_per_100g: 0,
    fat_g_per_100g: 0,
    fiber_g_per_100g: 0,
  };
  errors.value = {};
}

function handleClose() {
  resetForm();
  emit("close");
}

// Prevent body scroll when modal is open
onMounted(() => {
  document.body.style.overflow = "hidden";
  // Focus trap
  const modal = document.querySelector(".custom-food-modal") as HTMLElement;
  if (modal) {
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement?.focus();

    function handleTab(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }

    modal.addEventListener("keydown", handleTab);
    // Store cleanup
    const modalWithCleanup = modal as HTMLElement & {
      _focusTrapCleanup?: () => void;
    };
    modalWithCleanup._focusTrapCleanup = () => {
      modal.removeEventListener("keydown", handleTab);
    };
  }
});

onUnmounted(() => {
  document.body.style.overflow = "";
  const modal = document.querySelector(".custom-food-modal") as HTMLElement | null;
  if (!modal) return;
  const modalWithCleanup = modal as HTMLElement & {
    _focusTrapCleanup?: () => void;
  };
  modalWithCleanup._focusTrapCleanup?.();
});
</script>

<template>
  <!-- Modal Overlay -->
  <div class="fixed inset-0 z-50 overflow-y-auto" @click.self="handleClose">
    <div class="flex min-h-full items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/50 transition-opacity" />

      <!-- Modal Panel -->
      <div
        class="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl custom-food-modal"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add Custom Food
          </h3>
          <button
            type="button"
            @click="handleClose"
            class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="p-4 space-y-4">
          <!-- Name -->
          <div>
            <label
              for="name"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Food Name
            </label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              placeholder="e.g., Whey Isolate"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              :class="{ 'border-red-500': errors.name }"
              :disabled="submitting"
              required
            />
            <p
              v-if="errors.name"
              class="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {{ errors.name[0] }}
            </p>
          </div>

          <!-- Macros Grid -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label
                for="calories"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Calories (per 100g)
              </label>
              <input
                id="calories"
                v-model.number="form.calories_per_100g"
                type="number"
                min="0"
                max="9999"
                step="1"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="{ 'border-red-500': errors.calories_per_100g }"
                :disabled="submitting"
                required
              />
              <p
                v-if="errors.calories_per_100g"
                class="mt-1 text-sm text-red-600 dark:text-red-400"
              >
                {{ errors.calories_per_100g[0] }}
              </p>
            </div>

            <div>
              <label
                for="protein"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Protein (g per 100g)
              </label>
              <input
                id="protein"
                v-model.number="form.protein_g_per_100g"
                type="number"
                min="0"
                max="999"
                step="0.1"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="{ 'border-red-500': errors.protein_g_per_100g }"
                :disabled="submitting"
                required
              />
              <p
                v-if="errors.protein_g_per_100g"
                class="mt-1 text-sm text-red-600 dark:text-red-400"
              >
                {{ errors.protein_g_per_100g[0] }}
              </p>
            </div>

            <div>
              <label
                for="carbs"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Carbs (g per 100g)
              </label>
              <input
                id="carbs"
                v-model.number="form.carbs_g_per_100g"
                type="number"
                min="0"
                max="999"
                step="0.1"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="{ 'border-red-500': errors.carbs_g_per_100g }"
                :disabled="submitting"
                required
              />
              <p
                v-if="errors.carbs_g_per_100g"
                class="mt-1 text-sm text-red-600 dark:text-red-400"
              >
                {{ errors.carbs_g_per_100g[0] }}
              </p>
            </div>

            <div>
              <label
                for="fat"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Fat (g per 100g)
              </label>
              <input
                id="fat"
                v-model.number="form.fat_g_per_100g"
                type="number"
                min="0"
                max="999"
                step="0.1"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="{ 'border-red-500': errors.fat_g_per_100g }"
                :disabled="submitting"
                required
              />
              <p
                v-if="errors.fat_g_per_100g"
                class="mt-1 text-sm text-red-600 dark:text-red-400"
              >
                {{ errors.fat_g_per_100g[0] }}
              </p>
            </div>

            <div class="col-span-2">
              <label
                for="fiber"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Fiber (g per 100g)
              </label>
              <input
                id="fiber"
                v-model.number="form.fiber_g_per_100g"
                type="number"
                min="0"
                max="999"
                step="0.1"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                :class="{ 'border-red-500': errors.fiber_g_per_100g }"
                :disabled="submitting"
                required
              />
              <p
                v-if="errors.fiber_g_per_100g"
                class="mt-1 text-sm text-red-600 dark:text-red-400"
              >
                {{ errors.fiber_g_per_100g[0] }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div
            class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <button
              type="button"
              @click="handleClose"
              :disabled="submitting"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="submitting || !isValid"
              class="px-4 py-2 text-sm font-medium text-white bg-primary-600 dark:bg-primary-500 rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span v-if="submitting" class="flex items-center gap-2">
                <svg
                  class="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </span>
              <span v-else>Save Food</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>