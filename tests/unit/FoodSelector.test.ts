import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import FoodSelector from "@/components/diet-plan/FoodSelector.vue";
import { useFoodItemStore } from "@/stores/foodItem";

// Mock useToast
vi.mock("@nuxt/ui/composables/useToast", () => ({
  useToast: () => ({ add: vi.fn() }),
}));
vi.mock("#ui/composables/useToast", () => ({
  useToast: () => ({ add: vi.fn() }),
}));

// Mock the store
vi.mock("@/stores/foodItem", () => ({
  useFoodItemStore: vi.fn(),
}));

describe("FoodSelector.vue", () => {
  let mockStore: ReturnType<typeof useFoodItemStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    mockStore = {
      searchResults: [],
      loading: false,
      error: null,
      searchFoods: vi.fn(),
      createCustomFood: vi.fn(),
    };

    (useFoodItemStore as unknown as vi.Mock).mockReturnValue(mockStore);
  });

  it("renders search input", () => {
    const wrapper = mount(FoodSelector);
    expect(wrapper.find('input[type="search"]').exists()).toBe(true);
  });

  it("calls searchFoods when query changes after debounce", async () => {
    const mockResults = [
      {
        id: "1",
        name: "Chicken breast",
        calories_per_100g: 165,
        protein_g_per_100g: 31,
        carbs_g_per_100g: 0,
        fat_g_per_100g: 3.6,
        fiber_g_per_100g: 0,
        source: "usda",
      },
    ];
    mockStore.searchFoods.mockResolvedValue(mockResults);
    mockStore.searchResults = mockResults;

    const wrapper = mount(FoodSelector);
    const input = wrapper.find('input[type="search"]');
    await input.setValue("chicken");

    // Wait for debounce (300ms)
    await new Promise((r) => setTimeout(r, 350));

    expect(mockStore.searchFoods).toHaveBeenCalledWith("chicken");
  });

  it("shows loading state during search", async () => {
    mockStore.loading = true;
    const wrapper = mount(FoodSelector);
    expect(wrapper.find(".animate-spin").exists()).toBe(true);
  });

  it("shows error state when search fails", async () => {
    mockStore.error = "Search failed";
    const wrapper = mount(FoodSelector);
    expect(wrapper.text()).toContain("Search failed");
  });

  it("opens custom food modal when button clicked", async () => {
    const wrapper = mount(FoodSelector);
    // Find button by text content
    const buttons = wrapper.findAll("button");
    const addFoodButton = buttons.find((b) =>
      b.text().includes("Add Custom Food"),
    );
    expect(addFoodButton).toBeDefined();
    if (addFoodButton) {
      await addFoodButton.trigger("click");
      expect(wrapper.emitted("open-custom-food-modal")).toBeTruthy();
    }
  });
});
