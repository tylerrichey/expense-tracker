<template>
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Expense Details</h3>
        <button class="close-btn" @click="closeModal" title="Close">×</button>
      </div>
      
      <div class="modal-body">
        <div class="expense-detail-row">
          <span class="detail-label">Amount:</span>
          <span class="detail-value amount">${{ expense.amount.toFixed(2) }}</span>
        </div>
        
        <div class="expense-detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">{{ formatFullDate(expense.timestamp) }}</span>
        </div>
        
        <div class="expense-detail-row">
          <span class="detail-label">Time:</span>
          <span class="detail-value">{{ formatTime(expense.timestamp) }}</span>
        </div>
        
        <div class="expense-detail-row" v-if="expense.place_name">
          <span class="detail-label">Location:</span>
          <span class="detail-value">{{ expense.place_name }}</span>
        </div>
        
        <div class="expense-detail-row" v-if="expense.place_address">
          <span class="detail-label">Address:</span>
          <span class="detail-value">{{ expense.place_address }}</span>
        </div>
        
        <div class="expense-detail-row">
          <span class="detail-label">Rating:</span>
          <div class="detail-value rating-value">
            <!-- Read-only rating display -->
            <div v-if="!isEditingRating" class="rating-display">
              <div v-if="expense.rating" class="rating-content">
                <span class="modal-rating-stars">
                  <span v-for="star in 5" :key="star" :class="['star', { filled: star <= expense.rating }]">
                    ⭐
                  </span>
                </span>
                <span class="rating-text">({{ expense.rating }}/5)</span>
              </div>
              <div v-else class="no-rating">
                <span class="rating-text">No rating</span>
              </div>
              <button @click="startEditingRating" class="edit-rating-btn" title="Edit rating">
                ✏️
              </button>
            </div>
            
            <!-- Rating editing interface -->
            <div v-else class="rating-edit">
              <div class="rating-stars-edit">
                <span v-for="star in 5" :key="star" 
                      :class="['star-edit', { 
                        filled: editingRating && star <= editingRating,
                        hover: editingRating && star <= editingRating 
                      }]"
                      @click="setEditingRating(star)"
                      @mouseover="editingRating = star"
                      :title="`Rate ${star} star${star > 1 ? 's' : ''}`">
                  ⭐
                </span>
                <button @click="setEditingRating(null)" 
                        :class="['clear-rating-btn', { active: editingRating === null }]"
                        title="Remove rating">
                  ❌
                </button>
              </div>
              <div class="rating-edit-actions">
                <button @click="saveRating" 
                        :disabled="updatingRating"
                        class="save-rating-btn">
                  {{ updatingRating ? 'Saving...' : 'Save' }}
                </button>
                <button @click="cancelEditingRating" 
                        :disabled="updatingRating"
                        class="cancel-rating-btn">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="expense-detail-row" v-if="expense.latitude && expense.longitude">
          <span class="detail-label">Coordinates:</span>
          <span class="detail-value">{{ expense.latitude.toFixed(4) }}, {{ expense.longitude.toFixed(4) }}</span>
        </div>
      </div>
      
      <div class="modal-actions">
        <button 
          v-if="expense.has_image" 
          @click="handleViewReceipt"
          class="action-btn receipt-btn"
          :disabled="loadingImageId === expense.id"
        >
          <span class="btn-icon">📄</span>
          <span class="btn-text">{{ loadingImageId === expense.id ? 'Loading...' : 'View Receipt' }}</span>
        </button>
        
        <button 
          @click="handleDeleteExpense"
          class="action-btn delete-btn"
          :disabled="deletingId === expense.id"
        >
          <span class="btn-icon">🗑️</span>
          <span class="btn-text">{{ deletingId === expense.id ? 'Deleting...' : 'Delete' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { databaseService } from '../services/database'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  expense: {
    type: Object,
    required: true
  },
  loadingImageId: {
    type: Number,
    default: null
  },
  deletingId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['close', 'view-receipt', 'delete-expense', 'rating-updated'])

// Rating editing state
const isEditingRating = ref(false)
const editingRating = ref(null)
const updatingRating = ref(false)

function closeModal() {
  emit('close')
}

function handleViewReceipt() {
  if (props.expense.id) {
    emit('view-receipt', props.expense.id)
  }
}

function handleDeleteExpense() {
  emit('delete-expense', props.expense.id)
}

function formatFullDate(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function startEditingRating() {
  isEditingRating.value = true
  editingRating.value = props.expense.rating
}

function cancelEditingRating() {
  isEditingRating.value = false
  editingRating.value = null
}

function setEditingRating(rating) {
  editingRating.value = rating
}

async function saveRating() {
  if (updatingRating.value) return
  
  try {
    updatingRating.value = true
    await databaseService.updateExpenseRating(props.expense.id, editingRating.value)
    
    // Update the expense object locally for immediate UI feedback
    props.expense.rating = editingRating.value
    
    isEditingRating.value = false
    editingRating.value = null
    emit('rating-updated')
  } catch (error) {
    console.error('Failed to update rating:', error)
    alert('Failed to update rating. Please try again.')
  } finally {
    updatingRating.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
  padding: 20px;
}

.modal-content {
  background: #1e1e1e;
  border: 2px solid #444;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #444;
  background: #2a2a2a;
  border-radius: 10px 10px 0 0;
}

.modal-header h3 {
  margin: 0;
  color: #e0e0e0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #444;
  color: #e0e0e0;
}

.modal-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.expense-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid #333;
  gap: 16px;
}

.expense-detail-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.detail-label {
  color: #b0b0b0;
  font-weight: 500;
  min-width: 80px;
  flex-shrink: 0;
}

.detail-value {
  color: #e0e0e0;
  text-align: right;
  flex: 1;
  word-break: break-word;
}

.detail-value.amount {
  color: #28a745;
  font-weight: 600;
  font-size: 20px;
}

.rating-value {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.modal-rating-stars {
  display: inline-flex;
  gap: 2px;
}

.modal-rating-stars .star {
  font-size: 16px;
  opacity: 0.3;
}

.modal-rating-stars .star.filled {
  opacity: 1;
}

.rating-text {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

/* Rating editing styles */
.rating-display {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  justify-content: flex-end;
}

.rating-content, .no-rating {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edit-rating-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 14px;
  opacity: 0.6;
  transition: all 0.2s;
}

.edit-rating-btn:hover {
  opacity: 1;
  background: #444;
}

.rating-edit {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  align-items: flex-end;
}

.rating-stars-edit {
  display: flex;
  align-items: center;
  gap: 4px;
}

.star-edit {
  font-size: 20px;
  cursor: pointer;
  opacity: 0.3;
  transition: all 0.2s;
  user-select: none;
}

.star-edit:hover,
.star-edit.hover {
  opacity: 0.8;
}

.star-edit.filled {
  opacity: 1;
}

.clear-rating-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  opacity: 0.4;
  transition: all 0.2s;
}

.clear-rating-btn:hover,
.clear-rating-btn.active {
  opacity: 1;
  background: #dc3545;
}

.rating-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.save-rating-btn,
.cancel-rating-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.save-rating-btn {
  background: #28a745;
  color: white;
}

.save-rating-btn:hover:not(:disabled) {
  background: #1e7e34;
}

.save-rating-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-rating-btn {
  background: #6c757d;
  color: white;
}

.cancel-rating-btn:hover:not(:disabled) {
  background: #545b62;
}

.cancel-rating-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #444;
  background: #2a2a2a;
  border-radius: 0 0 10px 10px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.receipt-btn {
  background: #007bff;
  color: white;
}

.receipt-btn:hover:not(:disabled) {
  background: #0056b3;
}

.delete-btn {
  background: #dc3545;
  color: white;
}

.delete-btn:hover:not(:disabled) {
  background: #b02a37;
}

.btn-icon {
  font-size: 16px;
}

.btn-text {
  font-size: 14px;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 16px;
  }
  
  .modal-content {
    max-width: none;
    max-height: 85vh;
  }
  
  .modal-header {
    padding: 14px 16px;
  }
  
  .modal-header h3 {
    font-size: 16px;
  }
  
  .modal-body {
    padding: 16px;
  }
  
  .expense-detail-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 0;
  }
  
  .detail-value {
    text-align: left;
  }
  
  .detail-value.amount {
    font-size: 24px;
  }
  
  .modal-actions {
    flex-direction: column;
    gap: 8px;
    padding: 16px;
  }
  
  .action-btn {
    min-height: 48px;
    font-size: 16px;
  }
  
  .btn-icon {
    font-size: 18px;
  }
  
  .btn-text {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: 8px;
  }
  
  .expense-detail-row {
    padding: 8px 0;
  }
}</style>