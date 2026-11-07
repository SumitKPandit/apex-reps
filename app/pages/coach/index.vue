<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useDietPlanStore } from "@/stores/dietPlan";
import { useRouter } from "vue-router";

definePageMeta({
  layout: "coach",
});

const authStore = useAuthStore();
const profileStore = useProfileStore();
const dietPlanStore = useDietPlanStore();
const router = useRouter();

const loading = ref(true);
const totalMentees = ref(0);
const activePlans = ref(0);
const upcomingPlans = ref(0);
const mentees = ref<{ id: string; name: string }[]>([]);

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

onMounted(async () => {
  console.log("Coach dashboard onMounted started");
  if (!authStore.isAuthenticated) {
    console.log("Fetching session...");
    await authStore.fetchSession();
    console.log("Session fetched, user:", authStore.user?.email);
  }
  if (!profileStore.id) {
    console.log("Fetching profile...");
    await profileStore.fetchProfile();
    console.log("Profile fetched, role:", profileStore.role);
  }

  if (profileStore.role !== "coach") {
    console.log("Not a coach, redirecting to /");
    router.push("/");
    return;
  }

  try {
    console.log("Fetching mentees and plans...");
    const [menteesData, plans] = await Promise.all([
      dietPlanStore.fetchMentees(),
      dietPlanStore.fetchCoachPlans(),
    ]);
    console.log("Mentees:", menteesData);
    console.log("Plans:", plans);

    mentees.value = menteesData;
    totalMentees.value = menteesData.length;
    const today = new Date().toISOString().split("T")[0] ?? "";
    activePlans.value = plans.filter((p) => {
      return today >= p.start_date && today <= p.end_date;
    }).length;
    upcomingPlans.value = plans.filter((p) => {
      return today < p.start_date;
    }).length;
  } catch (err) {
    console.error("Failed to load coach dashboard:", err);
  } finally {
    console.log("Setting loading to false");
    loading.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div
        class="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"
      />
    </div>

    <div v-else class="max-w-6xl mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Coach Dashboard
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Welcome back, {{ profileStore.name }}! Here's your overview.
        </p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <UCard
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Total Mentees
              </p>
              <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {{ totalMentees }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"
            >
              <svg
                class="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
          </div>
        </UCard>

        <UCard
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Active Plans
              </p>
              <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {{ activePlans }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
            >
              <svg
                class="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </UCard>

        <UCard
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Upcoming Plans
              </p>
              <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {{ upcomingPlans }}
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center"
            >
              <svg
                class="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Quick Actions -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <NuxtLink
          to="/coach/diet-plans/new"
          class="UCard group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors p-6"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                Create New Plan
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Build a diet plan for your mentee
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center group-hover:bg-primary-200 dark:group-hover:bg-primary-800/30 transition-colors"
            >
              <svg
                class="w-6 h-6 text-primary-600 dark:text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/coach/diet-plans"
          class="UCard group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors p-6"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">
                View All Plans
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage existing diet plans
              </p>
            </div>
            <div
              class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors"
            >
              <svg
                class="w-6 h-6 text-gray-600 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Recent Mentees -->
      <div v-if="totalMentees > 0">
        <h2 class="text-xl font-semibold mb-4">Your Mentees</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-for="mentee in mentees"
            :key="mentee.id"
            :to="`/coach/diet-plans/${mentee.id}`"
            class="UCard group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors p-4"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-medium"
              >
                {{ getInitials(mentee.name) }}
              </div>
              <div class="flex-1 min-w-0">
                <h4
                  class="font-medium text-gray-900 dark:text-gray-100 truncate"
                >
                  {{ mentee.name }}
                </h4>
              </div>
              <svg
                class="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </NuxtLink>
        </div>
      </div>

      <div v-else class="text-center py-12">
        <UCard
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 max-w-md mx-auto"
        >
          <div class="p-8">
            <div
              class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4"
            >
              <svg
                class="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <h3
              class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2"
            >
              No Mentees Yet
            </h3>
            <p class="text-gray-500 dark:text-gray-400 mb-4">
              Add mentees to start creating diet plans for them.
            </p>
            <NuxtLink
              to="/coach/diet-plans"
              class="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              View Mentees
            </NuxtLink>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
