<script lang="ts" setup>
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const router = useRouter();

const isLoading = ref(false);

const logout = async () => {
  isLoading.value = true;
  await authStore.logout();
  isLoading.value = false;
  router.push("/login");
};

const navItems = [
  { label: "Dashboard", to: "/coach" },
  { label: "Diet Plans", to: "/coach/diet-plans" },
  { label: "Mentees", to: "/coach/mentees" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
</script>

<template>
  <div class="flex min-h-screen flex-col overflow-x-hidden">
    <UHeader :toggle="false">
      <template #left>
        <NuxtLink
          to="/coach"
          class="flex items-center gap-2 focus-visible:outline-3 outline-primary/25 rounded-md p-1 -ms-1"
        >
          <AppLogo class="w-auto h-6 shrink-0" />
          <span class="font-semibold text-lg hidden sm:block"
            >Coach Portal</span
          >
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-1 ms-4">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            active-class="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
      </template>

      <template #right>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-medium text-sm"
            >
              {{
                getInitials(
                  authStore.user?.user_metadata?.name ||
                    authStore.user?.email ||
                    "U",
                )
              }}
            </div>
            <span class="hidden sm:block text-sm font-medium">{{
              authStore.user?.user_metadata?.name || "Coach"
            }}</span>
          </div>
          <UButton
            :loading="isLoading"
            @click="logout"
            variant="ghost"
            class="hidden sm:flex"
          >
            Logout
          </UButton>
        </div>
      </template>
    </UHeader>

    <UMain class="flex-1">
      <NuxtPage />
    </UMain>

    <USeparator />

    <UFooter>
      <p class="text-sm text-muted">
        &copy; {{ new Date().getFullYear() }} Mahima Srivastava. All rights
        reserved.
      </p>
    </UFooter>
  </div>
</template>
