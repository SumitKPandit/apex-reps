<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useFoodItemStore } from "@/stores/foodItem";
import { calculateMacros } from "@/utils/foodMacros";
import CustomFoodModal from "@/components/diet-plan/CustomFoodModal.vue";
import { useOnlineStatus } from "@/composables/useOnlineStatus";

interface Props {
  /** Pre-selected food item ID */
  modelValue?: string;
  /** Pre-set quantity in grams */
  quantity?: number;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Placeholder text for search input */
  placeholder?: string;
}

interface Emits {
  /** Emitted when a food item is selected with quantity */
  "food-selected": [
    {
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
    },
  ];
  /** Emitted when user wants to add a custom food */
  "open-custom-food-modal": [];
  /** Emitted when quantity changes (for live preview) */
  "quantity-change": [number];
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  placeholder: "Search foods...",
});

const emit = defineEmits<Emits>();

const store = useFoodItemStore();
const { isOnline, stop } = useOnlineStatus();

const searchQuery = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const selectedFoodId = ref(props.modelValue || "");
const quantity = ref(props.quantity || 100);
const showDropdown = ref(false);
const showCustomFoodModal = ref(false);
const localSearchResults = ref<typeof store.searchResults>([]);
const focusedIndex = ref(-1);

// Sync with props
watch(
  () => props.modelValue,
  (val) => {
    selectedFoodId.value = val || "";
  },
);

watch(
  () => props.quantity,
  (val) => {
    quantity.value = val || 100;
  },
);

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let searchAbortController: AbortController | null = null;
const DEBOUNCE_MS = 300;

async function handleSearch() {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (searchAbortController) searchAbortController.abort();
  searchAbortController = new AbortController();

  searchTimeout = setTimeout(async () => {
    if (searchQuery.value.trim()) {
      try {
        await store.searchFoods(searchQuery.value);
        if (!searchAbortController?.signal.aborted) {
          localSearchResults.value = store.searchResults;
          showDropdown.value = true;
          focusedIndex.value = -1;
          // Ensure focus stays on input after search
          nextTick(() => {
            searchInput.value?.focus();
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        throw err;
      }
    } else {
      localSearchResults.value = [];
      showDropdown.value = false;
      focusedIndex.value = -1;
    }
  }, DEBOUNCE_MS);
}

function handleDropdownKeydown(event: KeyboardEvent) {
  const items = localSearchResults.value;
  if (items.length === 0) return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      focusedIndex.value = Math.min(focusedIndex.value + 1, items.length - 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0);
      break;
    case "Enter":
      event.preventDefault();
      if (focusedIndex.value >= 0 && focusedIndex.value < items.length) {
        const selectedItem = items[focusedIndex.value];
        if (selectedItem) handleSelect(selectedItem.id);
      }
      break;
    case "Escape":
      showDropdown.value = false;
      break;
    case "Tab":
      showDropdown.value = false;
      break;
  }
}

// Live macro preview
const selectedFood = computed(() =>
  localSearchResults.value.find((f) => f.id === selectedFoodId.value),
);

const previewMacros = computed(() => {
  if (!selectedFood.value || quantity.value <= 0) {
    return {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
    };
  }
  return calculateMacros(selectedFood.value, quantity.value);
});

// Emit quantity changes for live preview
watch(quantity, (val) => {
  emit("quantity-change", val);
});

// Handle food selection
function handleSelect(foodId: string) {
  selectedFoodId.value = foodId;
  showDropdown.value = false;
  searchQuery.value = selectedFood.value?.name || "";
  focusedIndex.value = -1;
}

function addFood() {
  emitFoodSelected();
  // Clear search input and reset state after adding
  searchQuery.value = "";
  selectedFoodId.value = "";
  quantity.value = 100;
  showDropdown.value = false;
  focusedIndex.value = -1;
}

function emitFoodSelected() {
  if (selectedFood.value && quantity.value > 0) {
    emit("food-selected", {
      foodItemId: selectedFood.value.id,
      foodName: selectedFood.value.name,
      quantityG: quantity.value,
      macros: previewMacros.value,
    });
  }
}

// Open custom food modal
function openCustomFoodModal() {
  showCustomFoodModal.value = true;
  emit("open-custom-food-modal");
}

// Handle custom food created
function onCustomFoodCreated(food: (typeof localSearchResults.value)[0]) {
  showCustomFoodModal.value = false;
  searchQuery.value = food.name;
  selectedFoodId.value = food.id;
  localSearchResults.value = store.searchResults; // Refresh from store
  emitFoodSelected();
}

// Close dropdown on outside click
function handleOutsideClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest(".food-selector")) {
    showDropdown.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener("click", handleOutsideClick);
  stop();
  if (searchTimeout) clearTimeout(searchTimeout);
  if (searchAbortController) searchAbortController.abort();
});
</script>

<template>
  <div class="food-selector relative w-full">
    <!-- Search Input -->
    <div class="relative">
      <input
        ref="searchInput"
        type="search"
        v-model="searchQuery"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        @input="handleSearch"
        @click.stop="showDropdown = true"
        autocomplete="off"
        aria-label="Search foods"
        aria-expanded="showDropdown"
        aria-controls="food-dropdown"
      />
      <div
        v-if="store.loading"
        class="absolute right-3 top-1/2 -translate-y-1/2"
      >
        <div
          class="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent"
        />
      </div>
    </div>

    <!-- Offline / cached status strip -->
    <div
      v-if="!isOnline || store.searchFromCache"
      class="mt-1 px-3 py-1.5 flex items-center gap-2 text-xs font-medium bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg"
    >
      <span v-if="!isOnline" class="flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Offline
      </span>
      <span
        v-if="store.searchFromCache"
        class="flex items-center gap-1 text-amber-700 dark:text-amber-300"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Showing cached results
      </span>
    </div>

    <!-- Dropdown Results -->
    <div
      v-if="showDropdown && (localSearchResults.length > 0 || store.loading)"
      id="food-dropdown"
      role="listbox"
      aria-label="Food search results"
      class="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg"
      @keydown="handleDropdownKeydown"
    >
      <div
        v-if="store.loading"
        role="option"
        aria-disabled="true"
        class="px-3 py-2 text-center text-gray-500 dark:text-gray-400"
      >
        Searching...
      </div>
      <template v-else>
        <button
          v-for="(food, index) in localSearchResults"
          :key="food.id"
          type="button"
          role="option"
          :aria-selected="selectedFoodId === food.id"
          @click="handleSelect(food.id)"
          @focus="focusedIndex = index"
          class="w-full px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 text-left"
        >
          <div class="flex justify-between items-center">
            <span class="font-medium">{{ food.name }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400 capitalize">{{ food.source }}</span>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ food.calories_per_100g }} cal • {{ food.protein_g_per_100g }}g
            protein • {{ food.carbs_g_per_100g }}g carbs •
            {{ food.fat_g_per_100g }}g fat • {{ food.fiber_g_per_100g }}g fiber
            (per 100g)
          </div>
        </button>
      </template>
      <div
        v-if="localSearchResults.length === 0 && !store.loading"
        role="option"
        aria-disabled="true"
        class="px-3 py-2 text-center text-gray-500 dark:text-gray-400"
      >
        No foods found.
        <button
          @click="openCustomFoodModal"
          class="text-primary-500 hover:underline"
        >
          Add custom food
        </button>
      </div>
    </div>

    <!-- Selected Food Preview -->
    <div
      v-if="selectedFood"
      class="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-medium">{{ selectedFood.name }}</h4>
        <span
          class="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full capitalize"
          >{{ selectedFood.source }}</span
        >
      </div>

      <!-- Quantity Input -->
      <div class="flex items-center gap-3 mb-3">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >Quantity (g):</label
        >
        <input
          type="number"
          v-model.number="quantity"
          min="1"
          step="1"
          class="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          :disabled="disabled"
        />
        <button
          @click="addFood"
          :disabled="disabled"
          class="px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          Add
        </button>
      </div>

      <!-- Macro Preview -->
      <div class="grid grid-cols-5 gap-2 text-xs">
        <div class="text-center p-2 bg-white dark:bg-gray-700 rounded">
          <div class="font-bold text-gray-900 dark:text-gray-100">
            {{ previewMacros.calories }}
          </div>
          <div class="text-gray-500 dark:text-gray-400">Cal</div>
        </div>
        <div class="text-center p-2 bg-white dark:bg-gray-700 rounded">
          <div class="font-bold text-gray-900 dark:text-gray-100">
            {{ previewMacros.protein_g }}
          </div>
          <div class="text-gray-500 dark:text-gray-400">Protein</div>
        </div>
        <div class="text-center p-2 bg-white dark:bg-gray-700 rounded">
          <div class="font-bold text-gray-900 dark:text-gray-100">
            {{ previewMacros.carbs_g }}
          </div>
          <div class="text-gray-500 dark:text-gray-400">Carbs</div>
        </div>
        <div class="text-center p-2 bg-white dark:bg-gray-700 rounded">
          <div class="font-bold text-gray-900 dark:text-gray-100">
            {{ previewMacros.fat_g }}
          </div>
          <div class="text-gray-500 dark:text-gray-400">Fat</div>
        </div>
        <div class="text-center p-2 bg-white dark:bg-gray-700 rounded">
          <div class="font-bold text-gray-900 dark:text-gray-100">
            {{ previewMacros.fiber_g }}
          </div>
          <div class="text-gray-500 dark:text-gray-400">Fiber</div>
        </div>
      </div>
    </div>

    <!-- Add Custom Food Button -->
    <button
      type="button"
      @click="openCustomFoodModal"
      :disabled="disabled"
      class="mt-3 w-full px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      + Add Custom Food
    </button>

    <!-- Error Display -->
    <div
      v-if="store.error"
      class="mt-2 p-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded"
    >
      {{ store.error }}
    </div>

    <!-- Custom Food Modal -->
    <CustomFoodModal
      v-if="showCustomFoodModal"
      @close="showCustomFoodModal = false"
      @created="onCustomFoodCreated"
    />
  </div>
</template>