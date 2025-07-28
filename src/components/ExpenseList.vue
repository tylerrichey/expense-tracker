<template>
  <div class="card expense-list">
    <h3 class="card-title text-center">Recent Expenses (Last 7 Days)</h3>
    <div v-if="loading" class="text-center text-muted p-xl">Loading expenses...</div>
    <div v-else-if="error" class="alert alert-error">{{ error }}</div>
    <div v-else-if="expenses.length === 0" class="text-center text-muted p-xl">
      No expenses recorded in the last 7 days.
    </div>
    <div v-else class="expenses">
      <div 
        v-for="expense in expenses" 
        :key="expense.id" 
        class="expense-item card card-compact"
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
        <div class="expense-actions">
          <button 
            v-if="expense.has_image"
            class="btn btn-primary btn-sm image-button"
            @click="viewImage(expense.id!)"
            :disabled="loadingImageId === expense.id"
            title="View receipt image"
          >
            {{ loadingImageId === expense.id ? '...' : '📷' }}
          </button>
          <button 
            class="btn btn-danger btn-sm delete-button"
            @click="deleteExpense(expense.id!)"
            :disabled="deletingId === expense.id"
            title="Delete expense"
          >
            {{ deletingId === expense.id ? '...' : '🗑️' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Image Modal -->
  <div v-if="showImageModal" class="modal-overlay" @click="closeImageModal">
    <div class="modal-content image-modal" @click.stop>
      <button class="modal-close" @click="closeImageModal" title="Close">×</button>
      <img :src="currentImageUrl" alt="Receipt image" class="modal-image" />
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
const loadingImageId = ref<number | null>(null)
const showImageModal = ref(false)
const currentImageUrl = ref('')

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

async function viewImage(expenseId: number) {
  loadingImageId.value = expenseId
  
  try {
    const imageUrl = await databaseService.getExpenseImage(expenseId)
    currentImageUrl.value = imageUrl
    showImageModal.value = true
  } catch (err) {
    console.error('Error loading image:', err)
    error.value = 'Failed to load image'
    setTimeout(() => {
      error.value = ''
    }, 3000)
  } finally {
    loadingImageId.value = null
  }
}

function closeImageModal() {
  showImageModal.value = false
  if (currentImageUrl.value) {
    URL.revokeObjectURL(currentImageUrl.value) // Clean up object URL
    currentImageUrl.value = ''
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
  margin-top: var(--spacing-2xl);
}

.expense-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
  touch-action: manipulation;
}

.expense-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex: 1;
}

.expense-amount {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--primary-blue);
  min-width: 80px;
  flex-shrink: 0;
}

.expense-details {
  flex: 1;
  text-align: right;
  margin-left: var(--spacing-md);
}

.expense-actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  flex-shrink: 0;
  margin-left: var(--spacing-base);
}

.image-button,
.delete-button {
  min-width: 32px;
  height: 32px;
  width: auto;
  padding: var(--spacing-xs) var(--spacing-sm);
}

.expense-date {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
  line-height: var(--line-height-sm);
}

.expense-location {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  line-height: var(--line-height-sm);
  word-break: break-all;
}

/* Mobile optimizations */
@media (max-width: 480px) {
  .expense-list {
    margin-top: var(--spacing-lg);
  }
  
  .expense-item {
    align-items: flex-start;
  }
  
  .expense-content {
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  
  .expense-amount {
    font-size: var(--font-size-lg);
    margin-bottom: var(--spacing-xs);
    min-width: auto;
  }
  
  .expense-details {
    text-align: left;
    margin-left: 0;
  }
  
  .expense-actions {
    gap: var(--spacing-xs);
    flex-shrink: 0;
    align-self: center;
  }

  .image-button,
  .delete-button {
    width: 28px;
    height: 28px;
    font-size: var(--font-size-xs);
    min-width: 28px;
  }
  
  .expense-date {
    font-size: var(--font-size-sm);
  }
  
  .expense-location {
    font-size: 11px;
    margin-top: var(--spacing-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }
}

/* Image Modal Styles */
.image-modal {
  position: relative;
  width: auto;
  height: auto;
  max-width: 90vw;
  max-height: 90vh;
  backdrop-filter: blur(2px);
}

.modal-image {
  max-width: calc(90vw - 40px);
  max-height: calc(90vh - 40px);
  width: auto;
  height: auto;
  display: block;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

/* Mobile modal adjustments */
@media (max-width: 768px) {
  .image-modal {
    max-width: 95vw;
    max-height: 95vh;
  }
  
  .modal-image {
    max-width: calc(95vw - 20px);
    max-height: calc(95vh - 20px);
  }
}
</style>