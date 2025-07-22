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
        <div class="expense-actions">
          <button 
            v-if="expense.has_image"
            class="image-button"
            @click="viewImage(expense.id!)"
            :disabled="loadingImageId === expense.id"
            title="View receipt image"
          >
            {{ loadingImageId === expense.id ? '...' : '📷' }}
          </button>
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
  </div>

  <!-- Image Modal -->
  <div v-if="showImageModal" class="image-modal-overlay" @click="closeImageModal">
    <div class="image-modal" @click.stop>
      <button class="modal-close-button" @click="closeImageModal" title="Close">×</button>
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
  margin: 20px 0 0 0;
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

.loading, .error, .no-expenses {
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

.expenses {
}

.expense-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  background-color: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  transition: box-shadow 0.2s;
  touch-action: manipulation;
}

.expense-item:hover {
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
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

.expense-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.image-button {
  background: #007bff;
  border: none;
  border-radius: 4px;
  color: white;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 14px;
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  touch-action: manipulation;
}

.image-button:hover:not(:disabled) {
  background: #0056b3;
}

.image-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.image-button:active {
  transform: scale(0.95);
}

.delete-button {
  background: #dc3545;
  border: none;
  border-radius: 4px;
  color: white;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 14px;
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  touch-action: manipulation;
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
  color: #b0b0b0;
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
  
  .expense-actions {
    gap: 6px;
    flex-shrink: 0;
    align-self: center;
  }

  .image-button,
  .delete-button {
    width: 28px;
    height: 28px;
    font-size: 12px;
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

/* Image Modal Styles */
.image-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.image-modal {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.modal-close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: 50%;
  color: white;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  z-index: 1001;
  transition: background-color 0.2s;
}

.modal-close-button:hover {
  background: rgba(0, 0, 0, 0.9);
}

.modal-image {
  max-width: 100%;
  max-height: 100%;
  display: block;
  object-fit: contain;
}
</style>