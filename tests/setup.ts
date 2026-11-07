import { vi } from "vitest";

// Mock useToast globally
vi.mock("@nuxt/ui/composables/useToast", () => ({
  useToast: () => ({ add: vi.fn() }),
}));

vi.mock("#ui/composables/useToast", () => ({
  useToast: () => ({ add: vi.fn() }),
}));
