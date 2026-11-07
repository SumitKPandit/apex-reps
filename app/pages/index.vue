<template>
  <UContainer>
    <PageLoader v-if="isLoading" />

    <div v-else class="space-y-8 py-6">
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 class="text-2xl font-bold">Welcome {{ profileStore.name }}!</h2>
          <p class="text-muted mt-1">
            Track your fitness journey and stay on course.
          </p>
        </div>
        <UButton to="/check-in" size="lg" icon="i-lucide-plus">
          Check In
        </UButton>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="lg:col-span-1">
          <SubscriptionCard />
        </div>

        <div class="lg:col-span-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <UCard
            v-for="summary in summaries"
            :key="summary.label"
            variant="subtle"
          >
            <div class="flex flex-col gap-1">
              <span class="text-sm text-muted">{{ summary.label }}</span>
              <span class="text-2xl font-semibold">{{ summary.value }}</span>
            </div>
          </UCard>
        </div>
      </div>

      <div>
        <h3 class="text-xl font-bold mb-4">Your Progress</h3>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <StatChart
            class="min-w-0"
            title="Weight"
            :chart-data="statsStore.weightChartData"
            value-key="value"
            category-name="Weight"
            x-label="Date"
            y-label="Weight (kg)"
          />
          <StatChart
            class="min-w-0"
            title="Waist"
            :chart-data="statsStore.waistChartData"
            value-key="value"
            category-name="Waist"
            x-label="Date"
            y-label="Waist (in)"
          />
          <StatChart
            class="min-w-0"
            title="Body Fat %"
            :chart-data="statsStore.bfpChartData"
            value-key="value"
            category-name="Body Fat %"
            x-label="Date"
            y-label="Body Fat (%)"
          />
        </div>
        <div>
          <ProgressPhotoCompare />
        </div>
      </div>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import { useProfileStore } from "@/stores/profile";
import { useSubStore } from "@/stores/subscription";
import { usePlanStore } from "@/stores/plan";
import { useStatsStore } from "@/stores/stats";
import { useRouter } from "vue-router";
import { computed } from "vue";
import ProgressPhotoCompare from "@/components/ProgressPhotoCompare.vue";

const profileStore = useProfileStore();
const subStore = useSubStore();
const planStore = usePlanStore();
const statsStore = useStatsStore();
const router = useRouter();
const isLoading = ref(true);

const latestStat = computed(() => {
  const stats = statsStore.stats;
  return stats.length ? stats[stats.length - 1] : null;
});

const summaries = computed(() => [
  {
    label: "Weight",
    value: latestStat.value ? `${latestStat.value.weight} kg` : "—",
  },
  {
    label: "Waist",
    value: latestStat.value ? `${latestStat.value.waist} in` : "—",
  },
  {
    label: "Body Fat %",
    value: latestStat.value
      ? `${Math.round(latestStat.value.bfp * 10) / 10}%`
      : "—",
  },
]);

onMounted(async () => {
  isLoading.value = true;
  try {
    await profileStore.fetchProfile();

    // Redirect coaches to their dashboard
    if (profileStore.role === "coach") {
      router.push("/coach");
      return;
    }

    await subStore.fetchActiveSubscription();
    if (subStore.planId) {
      await planStore.fetchPlan(subStore.planId);
    }
    await statsStore.fetchAllStats();
    await statsStore.fetchLeftPhotos();
  } catch (error) {
    console.log("Error loading dashboard: ", error);
  } finally {
    isLoading.value = false;
  }
});
</script>
