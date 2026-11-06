<script lang="ts" setup>
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";
import BottomNav from "@/components/BottomNav.vue";

const authStore = useAuthStore();
const router = useRouter();

const isLoading = ref(false);

useHead({
  meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
  link: [{ rel: "icon", href: "/favicon.ico" }],
  htmlAttrs: {
    lang: "en",
  },
});

const logout = async () => {
  isLoading.value = true;
  await authStore.logout();
  isLoading.value = false;
  router.push("/login");
};
</script>

<template>
  <div class="flex min-h-screen flex-col overflow-x-hidden">
    <UHeader :toggle="false">
      <template #left>
        <NuxtLink
          to="/"
          class="focus-visible:outline-3 outline-primary/25 rounded-md p-1 -ms-1"
        >
          <AppLogo class="w-auto h-6 shrink-0" />
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-1 ms-6">
          <NuxtLink
            v-if="authStore.user?.user_metadata?.role === 'coach'"
            to="/coach"
            class="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            active-class="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
          >
            Coach Portal
          </NuxtLink>
          <NuxtLink
            v-else
            to="/diet-plan"
            class="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            active-class="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
          >
            Diet Plan
          </NuxtLink>
        </nav>
      </template>

      <template #right>
        <UButton :loading="isLoading" @click="logout" variant="ghost" class="hidden sm:flex">
          Logout
        </UButton>
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <BottomNav v-if="authStore.user?.user_metadata?.role !== 'coach'" />

    <USeparator />

    <UFooter>
      <p class="text-sm text-muted">
        &copy; {{ new Date().getFullYear() }} Mahima Srivastava. All rights
        reserved.
      </p>
    </UFooter>
  </div>
</template>
