<template>
  <div class="expense-list">
    <h3>Recent Expenses (Last 7 Days)</h3>
    <div v-if="loading" class="loading">Loading expenses...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="expenses.length === 0" class="no-expenses">
      No expenses recorded in the last 7 days.
    </div>
    <div v-else class="expenses">
      <div 
        v-for="expense in expenses" 
        :key="expense.id" 
        class="expense-item"
      >
        <div class="expense-content">
          <div class="expense-amount">${{ expense.amount.toFixed(2) }}</div>
          <div class="expense-details">
            <div class="expense-date">
              {{ formatDate(expense.timestamp) }}
            </div>
            <div v-if="expense.place_name" class="expense-location">
              📍 {{ expense.place_name }}
            </div>
            <div v-else-if="expense.latitude && expense.longitude" class="expense-location">
              📍 {{ expense.latitude.toFixed(4) }}, {{ expense.longitude.toFixed(4) }}
            </div>
          </div>
        </div>
        <button 
          class="delete-button"
          @click="deleteExpense(expense.id!)"
          :disabled="deletingId === expense.id"
          title="Delete expense"
        >
          {{ deletingId === expense.id ? '...' : '🗑️' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { databaseService } from '../services/database'
import { Expense } from '../types/expense'

const expenses = ref<Expense[]>([])
const loading = ref(false)
const error = ref('')
const deletingId = ref<number | null>(null)

const props = defineProps<{
  refreshTrigger?: number
}>()

const emit = defineEmits<{
  expenseDeleted: []
}>()

async function loadExpenses() {
  loading.value = true
  error.value = ''
  
  try {
    expenses.value = await databaseService.getRecentExpenses(7)
    if (import.meta.env.DEV) {
      console.log('Loaded expenses:', JSON.stringify(expenses.value, null, 2))
    }
  } catch (err) {
    console.error('Error loading expenses:', err)
    error.value = 'Failed to load expenses'
  } finally {
    loading.value = false
  }
}

async function deleteExpense(id: number) {
  if (!confirm('Are you sure you want to delete this expense?')) {
    return
  }

  deletingId.value = id
  
  try {
    await databaseService.deleteExpense(id)
    expenses.value = expenses.value.filter(expense => expense.id !== id)
    emit('expenseDeleted')
  } catch (err) {
    console.error('Error deleting expense:', err)
    error.value = 'Failed to delete expense'
    setTimeout(() => {
      error.value = ''
    }, 3000)
  } finally {
    deletingId.value = null
  }
}

function formatDate(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const expenseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffInMs = today.getTime() - expenseDate.getTime()
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
  
  if (diffInDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } else if (diffInDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } else {
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

onMounted(loadExpenses)

// Watch for refresh trigger changes
import { watch } from 'vue'
watch(() => props.refreshTrigger, () => {
  if (props.refreshTrigger) {
    loadExpenses()
  }
})

defineExpose({ loadExpenses })
</script>

<style scoped>
.expense-list {
  width: 100%;
  max-width: 400px;
  margin: 20px 0 0 0;
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

.loading, .error, .no-expenses {
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

.expenses {
}

.expense-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  transition: box-shadow 0.2s;
  touch-action: manipulation;
}

.expense-item:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.expense-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex: 1;
}

.expense-amount {
  font-size: 18px;
  font-weight: bold;
  color: #007bff;
  min-width: 80px;
  flex-shrink: 0;
}

.expense-details {
  flex: 1;
  text-align: right;
  margin-left: 10px;
}

.delete-button {
  background: #dc3545;
  border: none;
  border-radius: 4px;
  color: white;
  padding: 6px 8px;
  margin-left: 10px;
  cursor: pointer;
  font-size: 14px;
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  touch-action: manipulation;
  flex-shrink: 0;
}

.delete-button:hover:not(:disabled) {
  background: #c82333;
}

.delete-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.delete-button:active {
  transform: scale(0.95);
}

.expense-date {
  font-size: 14px;
  color: #555;
  margin-bottom: 2px;
  line-height: 1.3;
}

.expense-location {
  font-size: 12px;
  color: #888;
  line-height: 1.2;
  word-break: break-all;
}

/* Mobile optimizations */
@media (max-width: 480px) {
  .expense-list {
    padding: 12px;
    margin: 15px 0 0 0;
    border-radius: 6px;
  }
  
  h3 {
    font-size: 1.2rem;
    margin-bottom: 12px;
  }
  
  
  .expense-item {
    padding: 10px;
    margin-bottom: 6px;
    /* Keep flex-direction: row to maintain inline layout */
    align-items: flex-start;
  }
  
  .expense-content {
    flex-direction: column;
    flex: 1;
    min-width: 0; /* Allows content to shrink */
  }
  
  .expense-amount {
    font-size: 18px;
    margin-bottom: 3px;
    min-width: auto;
  }
  
  .expense-details {
    text-align: left;
    margin-left: 0;
  }
  
  .delete-button {
    /* Keep button on the right side */
    margin-left: 8px;
    margin-top: 0;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    font-size: 12px;
    align-self: center;
  }
  
  .expense-date {
    font-size: 13px;
    line-height: 1.2;
  }
  
  .expense-location {
    font-size: 11px;
    margin-top: 2px;
    line-height: 1.2;
    /* Prevent text from overflowing */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }
  
  .loading, .error, .no-expenses {
    padding: 15px;
    font-size: 13px;
  }
}

/* Very small screens */
@media (max-width: 320px) {
  .expense-list {
    padding: 10px;
  }
  
  .expense-amount {
    font-size: 18px;
  }
  
  .expense-location {
    font-size: 10px;
  }
}
</style>