import { describe, it, expect, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import DietPlanPage from "@/pages/diet-plan.vue";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useDietPlanStore } from "@/stores/dietPlan";

// Mock useToast globally (used by @nuxt/ui components)
vi.mock("@nuxt/ui/composables/useToast", () => ({
  useToast: () => ({ add: vi.fn() }),
}));
vi.mock("#ui/composables/useToast", () => ({
  useToast: () => ({ add: vi.fn() }),
}));

// Mock vue-router (Nuxt provides it; not directly resolvable in vitest)
const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ value: { path: "/diet-plan" } }),
}));

// Mock stores
vi.mock("@/stores/auth", () => ({ useAuthStore: vi.fn() }));
vi.mock("@/stores/profile", () => ({ useProfileStore: vi.fn() }));
vi.mock("@/stores/dietPlan", () => ({ useDietPlanStore: vi.fn() }));

// Stub NuxtLink to avoid nested router links
vi.mock("#components/nuxt-link.client", () => ({
  default: {
    name: "NuxtLink",
    props: ["to"],
    template: "<a :href='to'><slot /></a>",
  },
}));

function buildStoreOverrides(overrides: Record<string, unknown> = {}) {
  return {
    isAuthenticated: true,
    user: { user_metadata: { role: "mentee" } },
    fetchSession: vi.fn().mockResolvedValue(undefined),
    id: "mentee-id-123",
    name: "Test Mentee",
    role: "mentee",
    fetchProfile: vi.fn().mockResolvedValue(undefined),
    currentPlan: null,
    logs: {},
    notes: {},
    loading: false,
    error: null,
    fetchPlanForDate: vi.fn().mockResolvedValue(undefined),
    toggleConsumed: vi.fn().mockResolvedValue(undefined),
    saveNotes: vi.fn().mockResolvedValue(undefined),
    clearPlan: vi.fn(),
    ...overrides,
  };
}

async function mountPage(overrides: Record<string, unknown> = {}) {
  setActivePinia(createPinia());
  vi.clearAllMocks();

  const authStore = buildStoreOverrides(overrides);
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    authStore,
  );

  const profileStore = buildStoreOverrides(overrides);
  (useProfileStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    profileStore,
  );

  const dietPlanStore = buildStoreOverrides(overrides);
  (useDietPlanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    dietPlanStore,
  );

  const wrapper = mount(DietPlanPage, {
    global: {
      stubs: {
        UCard: { template: "<div class='u-card-stub'><slot /></div>" },
        UButton: {
          template: "<button class='u-button-stub'><slot /></button>",
        },
        UHeader: { template: "<div class='u-header-stub'><slot /></div>" },
        UMain: { template: "<main class='u-main-stub'><slot /></main>" },
        UFooter: {
          template: "<footer class='u-footer-stub'><slot /></footer>",
        },
        USeparator: { template: "<div class='u-separator-stub'></div>" },
        AppLogo: { template: "<div class='app-logo-stub'></div>" },
      },
    },
  });

  // Wait for async onMounted (loading state + fetch) to settle
  await wrapper.vm.$nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  return { wrapper, authStore, profileStore, dietPlanStore };
}

describe("diet-plan page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("mentee access", () => {
    it("renders diet plan header for mentee", async () => {
      const { wrapper } = await mountPage({ role: "mentee" });
      expect(wrapper.text()).toContain("Diet Plan");
    });

    it("redirects coach to home on mount", async () => {
      await mountPage({ role: "coach" });
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  describe("progress bars", () => {
    it("shows progress bars for each macro when plan exists", async () => {
      const plan = {
        id: "plan-1",
        name: "Week 1",
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

      const { wrapper } = await mountPage({
        role: "mentee",
        currentPlan: plan,
      });

      const html = wrapper.html();
      // Calories shown in header only (consumed/planned), not as separate grid item
      expect(html).toContain("Protein");
      expect(html).toContain("Carbs");
      expect(html).toContain("Fat");
      expect(html).toContain("Fiber");
    });

    it("shows empty state when no plan", async () => {
      const { wrapper } = await mountPage({
        role: "mentee",
        currentPlan: null,
      });

      expect(wrapper.text()).toContain("No Diet Plan for This Date");
    });
  });

  describe("meal tracking", () => {
    it("toggles consumed on checkbox change", async () => {
      const toggleConsumed = vi.fn().mockResolvedValue(undefined);
      const plan = {
        id: "plan-1",
        name: "Week 1",
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

      const { wrapper } = await mountPage({
        role: "mentee",
        currentPlan: plan,
        logs: { "item-1": { food_item_id: "item-1", consumed: false } },
        toggleConsumed,
      });

      const checkbox = wrapper.find('input[type="checkbox"]');
      expect(checkbox.exists()).toBe(true);
      await checkbox.setChecked(true);

      expect(toggleConsumed).toHaveBeenCalledWith("item-1", true);
    });
  });

  describe("notes", () => {
    it("saves notes on textarea input", async () => {
      const saveNotes = vi.fn().mockResolvedValue(undefined);
      const plan = {
        id: "plan-1",
        name: "Week 1",
        start_date: "2026-11-01",
        end_date: "2026-11-07",
        notes: null,
        meals: [],
      } as never;

      const { wrapper } = await mountPage({
        role: "mentee",
        currentPlan: plan,
        logs: {},
        notes: {},
        saveNotes,
      });

      const textarea = wrapper.find("textarea");
      expect(textarea.exists()).toBe(true);
      await textarea.setValue("Feeling good today");

      expect(saveNotes).toHaveBeenCalled();
    });
  });

  describe("date picker", () => {
    it("renders native date input when plan exists", async () => {
      const plan = {
        id: "plan-1",
        name: "Week 1",
        start_date: "2026-11-01",
        end_date: "2026-11-07",
        notes: null,
        meals: [],
      } as never;

      const { wrapper } = await mountPage({
        role: "mentee",
        currentPlan: plan,
      });

      const dateInput = wrapper.find('input[type="date"]');
      expect(dateInput.exists()).toBe(true);
    });

    it("constrains date input to plan start/end dates", async () => {
      const plan = {
        id: "plan-1",
        name: "Week 1",
        start_date: "2026-11-01",
        end_date: "2026-11-07",
        notes: null,
        meals: [],
      } as never;

      const { wrapper } = await mountPage({
        role: "mentee",
        currentPlan: plan,
      });

      const dateInput = wrapper.find('input[type="date"]');
      expect(dateInput.attributes("min")).toBe("2026-11-01");
      expect(dateInput.attributes("max")).toBe("2026-11-07");
    });
  });

  describe("collapsible meals", () => {
    it("shows meal items by default (expanded)", async () => {
      const plan = {
        id: "plan-1",
        name: "Week 1",
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

      const { wrapper } = await mountPage({
        role: "mentee",
        currentPlan: plan,
      });

      expect(wrapper.text()).toContain("Chicken breast");
      expect(wrapper.text()).toContain("200");
    });

    it("collapses meal items when meal header is clicked", async () => {
      const plan = {
        id: "plan-1",
        name: "Week 1",
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

      const { wrapper } = await mountPage({
        role: "mentee",
        currentPlan: plan,
      });

      // Initially expanded - food item visible
      expect(wrapper.text()).toContain("Chicken breast");

      // Click meal header (button with type="button", unique flex justify-between button)
      const mealHeader = wrapper.find(
        'button[type="button"].flex.items-center.justify-between',
      );
      await mealHeader.trigger("click");
      await wrapper.vm.$nextTick();

      // After collapse, food item should be hidden
      expect(wrapper.text()).not.toContain("Chicken breast");
    });

    it("expands meal items when collapsed header is clicked again", async () => {
      const plan = {
        id: "plan-1",
        name: "Week 1",
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

      const { wrapper } = await mountPage({
        role: "mentee",
        currentPlan: plan,
      });

      // Click twice: collapse then expand
      const mealHeader = wrapper.find(
        'button[type="button"].flex.items-center.justify-between',
      );
      await mealHeader.trigger("click");
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).not.toContain("Chicken breast");

      await mealHeader.trigger("click");
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain("Chicken breast");
    });
  });
});
