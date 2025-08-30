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
        class="expense-item card card-compact clickable"
        @click="openExpenseDetails(expense)"
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
            <div v-if="expense.rating" class="expense-rating">
              <span class="rating-stars">
                <span v-for="star in 5" :key="star" :class="['star', { filled: star <= expense.rating }]">
                  ⭐
                </span>
              </span>
            </div>
          </div>
        </div>
        <div class="expense-actions">
          <button 
            v-if="expense.has_image"
            class="btn btn-primary btn-sm image-button"
            @click.stop="viewImage(expense.id!)"
            :disabled="loadingImageId === expense.id"
            title="View receipt image"
          >
            {{ loadingImageId === expense.id ? '...' : '📷' }}
          </button>
          <button 
            class="btn btn-danger btn-sm delete-button"
            @click.stop="deleteExpense(expense.id!)"
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
  <ImageModal 
    :show-image-modal="showImageModal"
    :current-image-url="currentImageUrl"
    @close="closeImageModal"
  />

  <!-- Expense Details Modal -->
  <ExpenseDetailsModal
    :show="showDetailsModal"
    :expense="selectedExpense!"
    :loading-image-id="loadingImageId"
    :deleting-id="deletingId"
    @close="closeDetailsModal"
    @view-receipt="handleViewReceipt"
    @delete-expense="handleDeleteExpense"
    @rating-updated="handleRatingUpdated"
    v-if="selectedExpense"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { databaseService } from '../services/database'
import { Expense } from '../types/expense'
import { useImageModal } from '../composables/useImageModal'
import ImageModal from './ImageModal.vue'
import ExpenseDetailsModal from './ExpenseDetailsModal.vue'

const expenses = ref<Expense[]>([])
const loading = ref(false)
const error = ref('')
const deletingId = ref<number | null>(null)

// Image modal functionality
const { loadingImageId, showImageModal, currentImageUrl, viewImage, closeImageModal } = useImageModal()

// Details modal functionality
const showDetailsModal = ref(false)
const selectedExpense = ref<Expense | null>(null)

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


function openExpenseDetails(expense: Expense) {
  selectedExpense.value = expense
  showDetailsModal.value = true
}

function closeDetailsModal() {
  showDetailsModal.value = false
  selectedExpense.value = null
}

function handleViewReceipt(expenseId: number) {
  viewImage(expenseId)
}

function handleDeleteExpense(expenseId: number) {
  deleteExpense(expenseId)
  closeDetailsModal()
}

function handleRatingUpdated() {
  loadExpenses()
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

.expense-item.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.expense-item.clickable:hover {
  background: var(--card-hover-bg, rgba(255, 255, 255, 0.05));
  transform: translateY(-1px);
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

.expense-rating {
  margin-top: 4px;
}

.rating-stars {
  display: inline-flex;
  gap: 1px;
}

.rating-stars .star {
  font-size: 12px;
  opacity: 0.3;
}

.rating-stars .star.filled {
  opacity: 1;
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
</style>