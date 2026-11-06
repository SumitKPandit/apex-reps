<script setup lang="ts">
import { useRoute } from "vue-router";

const route = useRoute();

const tabs = [
  { to: "/", label: "Dashboard", icon: "i-lucide-layout-dashboard" },
  { to: "/check-in", label: "Check-in", icon: "i-lucide-plus" },
  { to: "/diet-plan", label: "Diet Plan", icon: "i-lucide-utensils" },
];

const isActive = (to: string) => route.path === to;
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 md:hidden"
  >
    <div class="flex items-center justify-around py-2 px-4">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-col items-center justify-center p-2 rounded-md transition-colors"
        :class="{
          'bg-primary-50 text-primary-700': isActive(tab.to),
          'text-gray-600 hover:bg-gray-100': !isActive(tab.to),
        }"
      >
        <span class="text-[20px] mb-0.5">
          <i-lucide-layout-dashboard v-if="tab.to === '/'" />
          <i-lucide-plus v-else-if="tab.to === '/check-in'" />
          <i-lucide-utensils v-else />
        </span>
        <span class="text-xs font-medium">{{ tab.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
