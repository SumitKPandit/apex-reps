<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { useDietPlanStore } from "@/stores/dietPlan";

definePageMeta({
  layout: "coach",
});

const router = useRouter();
const authStore = useAuthStore();
const profileStore = useProfileStore();
const dietPlanStore = useDietPlanStore();

const loading = ref(true);
const mentees = ref<{ id: string; name: string }[]>([]);

function getPlanStatus(
  startDate: string,
  endDate: string,
): "active" | "upcoming" | "expired" {
  const today = new Date().toISOString().split("T")[0] ?? "";
  if (today < startDate) return "upcoming";
  if (today > endDate) return "expired";
  return "active";
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "upcoming":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "expired":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await authStore.fetchSession();
  }
  if (!profileStore.id) {
    await profileStore.fetchProfile();
  }
  loading.value = false;

  if (profileStore.role !== "coach") {
    router.push("/");
    return;
  }

  try {
    const menteesData = await dietPlanStore.fetchMentees();
    await dietPlanStore.fetchCoachPlans();
    mentees.value = menteesData;
  } catch (err) {
    console.error("Failed to load data:", err);
  }
});

const menteesWithPlans = computed(() => {
  const plans = dietPlanStore.coachPlans;
  const menteeMap = new Map(
    mentees.value.map((m) => [m.id, { ...m, plans: [] as typeof plans }]),
  );

  for (const plan of plans) {
    const mentee = menteeMap.get(plan.mentee_id);
    if (mentee) {
      mentee.plans.push(plan);
    }
  }

  return Array.from(menteeMap.values());
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div
        class="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"
      />
    </div>

    <div v-else class="max-w-4xl mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Diet Plan Management
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Create and manage diet plans for your mentees
        </p>
      </div>

      <div class="mb-6 flex flex-wrap gap-3">
        <NuxtLink
          to="/coach/diet-plans/new"
          class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Create New Plan
        </NuxtLink>
        <NuxtLink
          to="/coach/diet-plans"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          View Mentees
        </NuxtLink>
      </div>

      <div
        v-if="menteesWithPlans.length === 0"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center"
      >
        <p class="text-gray-500 dark:text-gray-400">No mentees assigned yet.</p>
      </div>

      <div v-else class="space-y-6">
        <div
          v-for="mentee in menteesWithPlans"
          :key="mentee.id"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
        >
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <div>
                <h2
                  class="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {{ mentee.name }}
                </h2>
              </div>
              <NuxtLink
                :to="{
                  path: '/coach/diet-plans/new',
                  query: { menteeId: mentee.id },
                }"
                class="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Create Plan
              </NuxtLink>
            </div>
          </div>

          <div
            v-if="mentee.plans.length === 0"
            class="p-4 text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700"
          >
            No plans yet. Click "Create Plan" to add one.
          </div>

          <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
            <div
              v-for="plan in mentee.plans"
              :key="plan.id"
              class="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-1">
                  <h3 class="font-medium text-gray-900 dark:text-gray-100">
                    {{ plan.name }}
                  </h3>
                  <span
                    :class="[
                      'px-2 py-0.5 text-xs font-medium rounded-full',
                      getStatusBadgeClass(
                        getPlanStatus(plan.start_date, plan.end_date),
                      ),
                    ]"
                  >
                    {{ getPlanStatus(plan.start_date, plan.end_date) }}
                  </span>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ plan.start_date }} – {{ plan.end_date }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <NuxtLink
                  :to="`/coach/diet-plans/${plan.id}/edit`"
                  class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                >
                  Edit
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
