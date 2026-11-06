import { defineConfig } from "vitest/config";
import path from "path";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "~": path.resolve(__dirname, "./app"),
      "#shared": path.resolve(__dirname, "./shared"),
      "#server": path.resolve(__dirname, "./server"),
      "#app": path.resolve(__dirname, "./node_modules/nuxt/dist/app"),
      vue: path.resolve(
        __dirname,
        "./node_modules/.pnpm/vue@3.5.40_typescript@6.0.3/node_modules/vue",
      ),
      "vue-router": path.resolve(
        __dirname,
        "./node_modules/.pnpm/vue-router@5.2.0_@vue+compiler-sfc@3.5.40_esbuild@0.28.0_pinia@4.0.3_@vue+devtools-api@_a5555d75bfc4f4cae5b9ea6a90b9e11e/node_modules/vue-router",
      ),
    },
  },
});
