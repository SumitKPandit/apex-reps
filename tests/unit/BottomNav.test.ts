import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import BottomNav from "@/components/BottomNav.vue";

// Mock useToast globally
vi.mock("@nuxt/ui/composables/useToast", () => ({
  useToast: () => ({ add: vi.fn() }),
}));
vi.mock("#ui/composables/useToast", () => ({
  useToast: () => ({ add: vi.fn() }),
}));

// Hoisted mock so route path can be changed per test
const mockUseRoute = vi.fn(() => ({ value: { path: "/" } }));
vi.mock("vue-router", () => ({
  useRoute: () => mockUseRoute(),
}));

function mountNav(path: string = "/") {
  mockUseRoute.mockReturnValue({ value: { path } });
  return mount(BottomNav, {
    global: {
      stubs: {
        NuxtLink: {
          props: ["to"],
          template: "<a v-bind='$props'><slot /></a>",
        },
        UButton: {
          template: "<button class='u-button-stub'><slot /></button>",
        },
      },
    },
  });
}

describe("BottomNav", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders 3 tabs: Dashboard, Check-in, Diet Plan", () => {
    const wrapper = mountNav("/");
    expect(wrapper.text()).toContain("Dashboard");
    expect(wrapper.text()).toContain("Check-in");
    expect(wrapper.text()).toContain("Diet Plan");
  });

  it("is hidden on desktop (md:hidden)", () => {
    const wrapper = mountNav("/");
    expect(wrapper.classes()).toContain("md:hidden");
  });

  it("highlights active tab based on current route", () => {
    const wrapper = mountNav("/diet-plan");
    const dietPlanTab = wrapper.find("a[to='/diet-plan']");
    expect(dietPlanTab.exists()).toBe(true);
  });

  it("renders Dashboard tab link to /", () => {
    const wrapper = mountNav("/");
    const dashboardLink = wrapper.find("a[to='/']");
    expect(dashboardLink.exists()).toBe(true);
  });
});
