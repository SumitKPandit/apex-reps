import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import FoodSelector from "@/components/diet-plan/FoodSelector.vue";

// Control the online status seen by the component.
const online = ref(false);

vi.mock("@/composables/useOnlineStatus", () => ({
  useOnlineStatus: () => ({ isOnline: online }),
}));

// Mock the store so we can control searchFromCache without pulling in the
// Nuxt-only useRuntimeConfig (via getSupabase).
const mockStore = {
  searchResults: [] as unknown[],
  loading: false,
  error: null as string | null,
  searchFromCache: false,
  searchFoods: vi.fn(),
  createCustomFood: vi.fn(),
};
vi.mock("@/stores/foodItem", () => ({
  useFoodItemStore: vi.fn(() => mockStore),
}));

// Mock Nuxt UI toast composables used indirectly by the component tree.
vi.mock("@nuxt/ui/composables/useToast", () => ({
  useToast: () => ({ add: vi.fn() }),
}));
vi.mock("#ui/composables/useToast", () => ({
  useToast: () => ({ add: vi.fn() }),
}));

describe("FoodSelector offline UI", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    online.value = false;
    mockStore.searchFromCache = false;
    mockStore.searchResults = [];
    mockStore.loading = false;
    mockStore.error = null;
  });

  it("shows an offline chip when disconnected", async () => {
    const wrapper = mount(FoodSelector);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Offline");
  });

  it("shows a cached-results badge when results come from the cache", async () => {
    mockStore.searchFromCache = true;

    const wrapper = mount(FoodSelector);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Showing cached results");
  });

  it("does not show the offline chip when online", async () => {
    online.value = true;

    const wrapper = mount(FoodSelector);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).not.toContain("Offline");
  });
});
