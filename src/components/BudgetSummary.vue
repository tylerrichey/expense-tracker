<template>
  <div class="budget-summary">
    <!-- <h3>Budget Summary</h3> -->
    <div v-if="loading" class="loading">Loading budget...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="!budget || !period" class="no-budget">No active budget</div>
    <div v-else class="budget-content">
      <!-- Budget Name and Period Info -->
      <div class="budget-header">
        <div class="budget-name">{{ budget.name }}</div>
        <div class="budget-period">
          {{ formatDateRange(period.start_date, period.end_date) }}
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :class="{
              'over-budget': percentage > 100,
              'vacation-mode': budget.vacation_mode,
            }"
            :style="{ width: `${Math.min(percentage, 100)}%` }"
          ></div>
        </div>
        <div class="progress-text">
          <span class="spent">${{ period.actual_spent.toFixed(2) }}</span>
          <span class="separator">/</span>
          <span class="target">${{ period.target_amount.toFixed(2) }}</span>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value" :class="{ 'over-budget': percentage > 100 }">
            {{ percentage.toFixed(1) }}%
          </div>
          <div class="stat-label">Used</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${{ Math.abs(remaining).toFixed(2) }}</div>
          <div class="stat-label">
            {{ remaining >= 0 ? "Remaining" : "Over Budget" }}
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${{ dailyAverage.toFixed(2) }}</div>
          <div class="stat-label">Daily Avg</div>
        </div>
      </div>

      <!-- Vacation Mode Indicator -->
      <div v-if="budget.vacation_mode" class="vacation-mode-indicator">
        🏖️ Vacation Mode Active
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import {
  budgetService,
  type Budget,
  type BudgetPeriod,
} from "../services/budget";

const loading = ref(false);
const error = ref("");
const budget = ref<Budget | null>(null);
const period = ref<BudgetPeriod | null>(null);

const props = defineProps<{
  refreshTrigger?: number;
}>();

// Computed properties
const percentage = computed(() => {
  if (!period.value) return 0;
  return (period.value.actual_spent / period.value.target_amount) * 100;
});

const remaining = computed(() => {
  if (!period.value) return 0;
  return period.value.target_amount - period.value.actual_spent;
});

const dailyAverage = computed(() => {
  if (!period.value) return 0;

  const startDate = new Date(period.value.start_date);
  const currentDate = new Date();
  const endDate = new Date(period.value.end_date);

  // Use the earlier of current date or end date for calculation
  const calculationDate = currentDate < endDate ? currentDate : endDate;

  // Calculate days elapsed (inclusive)
  const daysElapsed = Math.max(
    1,
    Math.ceil(
      (calculationDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1
  );

  return period.value.actual_spent / daysElapsed;
});

async function loadBudgetSummary() {
  loading.value = true;
  error.value = "";

  try {
    const { budget: activeBudget, period: currentPeriod } =
      await budgetService.getCurrentBudgetWithPeriod();
    budget.value = activeBudget;
    period.value = currentPeriod;

    if (import.meta.env.DEV) {
      console.log("Loaded budget summary:", {
        budget: activeBudget,
        period: currentPeriod,
      });
    }
  } catch (err) {
    console.error("Error loading budget summary:", err);
    error.value = "Failed to load budget summary";
  } finally {
    loading.value = false;
  }
}

function formatDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) return "";

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };

  // If same year, don't show year
  const startFormatted = start.toLocaleDateString("en-US", options);
  const endFormatted = end.toLocaleDateString("en-US", options);

  return `${startFormatted} - ${endFormatted}`;
}

onMounted(loadBudgetSummary);

// Watch for refresh trigger changes
watch(
  () => props.refreshTrigger,
  () => {
    if (props.refreshTrigger) {
      loadBudgetSummary();
    }
  }
);

defineExpose({ loadBudgetSummary });
</script>

<style scoped>
.budget-summary {
  width: 100%;
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #333;
  border-radius: 8px;
  background-color: #1e1e1e;
}

h3 {
  margin-bottom: 15px;
  color: #e0e0e0;
  text-align: center;
  font-size: 1.3rem;
}

.loading,
.error,
.no-budget {
  text-align: center;
  padding: 20px;
  color: #888;
  font-size: 14px;
}

.error {
  color: #f44336;
  background-color: #2e1a1a;
  border: 1px solid #5c2e2e;
  border-radius: 4px;
}

.budget-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.budget-header {
  text-align: center;
}

.budget-name {
  font-size: 18px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 4px;
}

.budget-period {
  font-size: 12px;
  color: #b0b0b0;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #333;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #28a745, #20c997);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.over-budget {
  background: linear-gradient(90deg, #dc3545, #fd7e14);
}

.progress-fill.vacation-mode {
  background: linear-gradient(90deg, #6f42c1, #e83e8c);
}

.progress-text {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.spent {
  color: #007bff;
  font-weight: 600;
}

.separator {
  color: #888;
}

.target {
  color: #b0b0b0;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background-color: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  text-align: center;
}

.stat-value {
  font-size: 14px;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 2px;
}

.stat-value.over-budget {
  color: #dc3545;
}

.stat-label {
  font-size: 11px;
  color: #b0b0b0;
}

.vacation-mode-indicator {
  text-align: center;
  padding: 8px;
  background: linear-gradient(90deg, #6f42c1, #e83e8c);
  color: white;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

/* Mobile optimizations */
@media (max-width: 480px) {
  .budget-summary {
    padding: 12px;
    margin: 15px 0;
  }

  h3 {
    font-size: 1.2rem;
    margin-bottom: 12px;
  }

  .budget-name {
    font-size: 16px;
  }

  .stats-grid {
    gap: 6px;
  }

  .stat-item {
    padding: 6px;
  }

  .stat-value {
    font-size: 13px;
  }

  .stat-label {
    font-size: 10px;
  }

  .progress-text {
    font-size: 13px;
  }
}
</style>
