<template>
  <div class="home">
    <ExpenseForm @expense-added="handleExpenseAdded" />
    <ExpenseSummary :refresh-trigger="refreshTrigger" />
    <ExpenseList :refresh-trigger="refreshTrigger" @expense-deleted="handleExpenseDeleted" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ExpenseForm from './ExpenseForm.vue'
import ExpenseSummary from './ExpenseSummary.vue'
import ExpenseList from './ExpenseList.vue'

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

// Watch for changes in props and update local trigger
import { watch } from 'vue'
watch(() => props.refreshTrigger, (newValue) => {
  if (newValue !== undefined) {
    refreshTrigger.value = newValue
  }
})

function handleExpenseAdded() {
  refreshTrigger.value++
  emit('expense-added')
}

function handleExpenseDeleted() {
  refreshTrigger.value++
  emit('expense-deleted')
}
</script>

<style scoped>
.home {
  width: 100%;
}
</style>