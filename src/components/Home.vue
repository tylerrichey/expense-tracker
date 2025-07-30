<template>
  <div class="home">
    <ExpenseForm @expense-added="handleExpenseAdded" />
    <BudgetSummary v-if="hasActiveBudget" :refresh-trigger="refreshTrigger" />
    <ExpenseSummary v-else :refresh-trigger="refreshTrigger" />
    <ExpenseList :refresh-trigger="refreshTrigger" @expense-deleted="handleExpenseDeleted" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ExpenseForm from './ExpenseForm.vue'
import ExpenseSummary from './ExpenseSummary.vue'
import BudgetSummary from './BudgetSummary.vue'
import ExpenseList from './ExpenseList.vue'
import { budgetService } from '../services/budget'

// Define props to receive refresh trigger from parent
interface Props {
  refreshTrigger?: number
}

const props = defineProps<Props>()

// Define emits
const emit = defineEmits<{
  'expense-added': []
  'expense-deleted': []
}>()

// Local refresh trigger that syncs with parent
const refreshTrigger = ref(props.refreshTrigger || 0)
const hasActiveBudget = ref(false)

// Watch for changes in props and update local trigger
import { watch } from 'vue'
watch(() => props.refreshTrigger, (newValue) => {
  if (newValue !== undefined) {
    refreshTrigger.value = newValue
  }
})

async function checkActiveBudget() {
  try {
    const activeBudget = await budgetService.getActiveBudget()
    hasActiveBudget.value = !!activeBudget
  } catch (error) {
    console.error('Error checking active budget:', error)
    hasActiveBudget.value = false
  }
}

function handleExpenseAdded() {
  refreshTrigger.value++
  emit('expense-added')
  // Recheck budget status in case expense affects budget display
  checkActiveBudget()
}

function handleExpenseDeleted() {
  refreshTrigger.value++
  emit('expense-deleted')
  // Recheck budget status in case expense affects budget display
  checkActiveBudget()
}

onMounted(() => {
  checkActiveBudget()
})
</script>

<style scoped>
.home {
  width: 100%;
}
</style>