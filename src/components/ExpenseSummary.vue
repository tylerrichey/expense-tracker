<template>
  <div class="expense-summary">
    <h3>Expense Summary</h3>
    <div v-if="loading" class="loading">Loading summary...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="summary-grid">
      <div class="summary-item">
        <div class="period">7d</div>
        <div class="amount">${{ totals.last7Days.toFixed(2) }}</div>
      </div>
      <div class="summary-item">
        <div class="period">14d</div>
        <div class="amount">${{ totals.last14Days.toFixed(2) }}</div>
      </div>
      <div class="summary-item">
        <div class="period">Month</div>
        <div class="amount">${{ totals.thisMonth.toFixed(2) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { databaseService } from '../services/database'

const loading = ref(false)
const error = ref('')
const totals = ref({
  last7Days: 0,
  last14Days: 0,
  thisMonth: 0
})
const counts = ref({
  last7Days: 0,
  last14Days: 0,
  thisMonth: 0
})

const props = defineProps<{
  refreshTrigger?: number
}>()

async function loadSummary() {
  loading.value = true
  error.value = ''
  
  try {
    const [summary7, summary14, summaryMonth] = await Promise.all([
      databaseService.getExpenseSummary(7),
      databaseService.getExpenseSummary(14),
      databaseService.getCurrentMonthSummary()
    ])
    
    totals.value = {
      last7Days: summary7.total,
      last14Days: summary14.total,
      thisMonth: summaryMonth.total
    }
    
    counts.value = {
      last7Days: summary7.count,
      last14Days: summary14.count,
      thisMonth: summaryMonth.count
    }
    
    if (import.meta.env.DEV) {
      console.log('Loaded expense summary:', JSON.stringify({ totals: totals.value, counts: counts.value }, null, 2))
    }
  } catch (err) {
    console.error('Error loading summary:', err)
    error.value = 'Failed to load summary'
  } finally {
    loading.value = false
  }
}

onMounted(loadSummary)

// Watch for refresh trigger changes
import { watch } from 'vue'
watch(() => props.refreshTrigger, () => {
  if (props.refreshTrigger) {
    loadSummary()
  }
})

defineExpose({ loadSummary })
</script>

<style scoped>
.expense-summary {
  width: 100%;
  max-width: 400px;
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

h3 {
  margin-bottom: 15px;
  color: #333;
  text-align: center;
  font-size: 1.3rem;
}

.loading, .error {
  text-align: center;
  padding: 20px;
  color: #666;
  font-size: 14px;
}

.error {
  color: #721c24;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  transition: box-shadow 0.2s;
  text-align: center;
}

.summary-item:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.period {
  font-weight: 600;
  color: #555;
  font-size: 12px;
  margin-bottom: 4px;
}

.amount {
  font-size: 16px;
  font-weight: bold;
  color: #007bff;
  line-height: 1.2;
}

/* Mobile optimizations */
@media (max-width: 480px) {
  .expense-summary {
    padding: 12px;
    margin: 15px 0;
    border-radius: 6px;
  }
  
  h3 {
    font-size: 1.2rem;
    margin-bottom: 12px;
  }
  
  .summary-item {
    padding: 8px 6px;
  }
  
  .period {
    font-size: 11px;
  }
  
  .amount {
    font-size: 14px;
  }
  
  .loading, .error {
    padding: 15px;
    font-size: 13px;
  }
}

/* Very small screens */
@media (max-width: 320px) {
  .expense-summary {
    padding: 10px;
  }
  
  .summary-item {
    padding: 6px 4px;
  }
  
  .period {
    font-size: 10px;
  }
  
  .amount {
    font-size: 13px;
  }
}
</style>