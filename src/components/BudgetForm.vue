<template>
  <div class="budget-form">
    <h2>{{ isEditing ? 'Edit Budget' : 'Create Budget' }}</h2>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    
    <form @submit.prevent="submitBudget">
      <div class="form-group">
        <label for="budget-name">Budget Name:</label>
        <input
          id="budget-name"
          v-model="budgetData.name"
          type="text"
          required
          placeholder="e.g., Weekly Groceries, Monthly Entertainment"
          :disabled="isSubmitting"
        />
      </div>

      <div class="form-group">
        <label for="budget-amount">Target Amount ($):</label>
        <input
          id="budget-amount"
          v-model.number="budgetData.amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="0.00"
          :disabled="isSubmitting"
        />
      </div>

      <div class="form-group">
        <label for="start-weekday">Start Day:</label>
        <select
          id="start-weekday"
          v-model.number="budgetData.start_weekday"
          required
          :disabled="isSubmitting"
        >
          <option value="0">Sunday</option>
          <option value="1">Monday</option>
          <option value="2">Tuesday</option>
          <option value="3">Wednesday</option>
          <option value="4">Thursday</option>
          <option value="5">Friday</option>
          <option value="6">Saturday</option>
        </select>
      </div>

      <div class="form-group">
        <label for="duration">Duration (days):</label>
        <select
          id="duration"
          v-model.number="budgetData.duration_days"
          required
          :disabled="isSubmitting"
        >
          <option value="7">7 days (Weekly)</option>
          <option value="14">14 days (Bi-weekly)</option>
          <option value="21">21 days (Tri-weekly)</option>
          <option value="28">28 days (Monthly)</option>
        </select>
      </div>

      <div class="form-group preview-group">
        <div class="budget-preview">
          <h4>Budget Preview:</h4>
          <p><strong>{{ budgetData.name || 'Unnamed Budget' }}</strong></p>
          <p>Amount: ${{ budgetData.amount ? budgetData.amount.toFixed(2) : '0.00' }}</p>
          <p>Starts: {{ getWeekdayName(budgetData.start_weekday) }}</p>
          <p>Duration: {{ budgetData.duration_days }} days</p>
          <p v-if="budgetPreview">
            <small class="preview-period">
              Next period: {{ budgetPreview.start_date }} to {{ budgetPreview.end_date }}
            </small>
          </p>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" @click="$emit('cancel')" :disabled="isSubmitting">
          Cancel
        </button>
        <button type="submit" :disabled="!isFormValid || isSubmitting" class="primary">
          {{ isSubmitting ? 'Saving...' : (isEditing ? 'Update Budget' : 'Create Budget') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      name: '',
      amount: null,
      start_weekday: 1,
      duration_days: 7
    })
  },
  isEditing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel'])

// Form data
const budgetData = ref({ ...props.initialData })
const isSubmitting = ref(false)
const error = ref('')

// Form validation
const isFormValid = computed(() => {
  return budgetData.value.name?.trim() &&
         budgetData.value.amount > 0 &&
         budgetData.value.start_weekday >= 0 &&
         budgetData.value.start_weekday <= 6 &&
         budgetData.value.duration_days >= 7 &&
         budgetData.value.duration_days <= 28
})

// Budget preview calculation
const budgetPreview = computed(() => {
  if (!isFormValid.value) return null
  
  try {
    const today = new Date()
    const startWeekday = budgetData.value.start_weekday
    const duration = budgetData.value.duration_days
    
    // Calculate next period start (simplified)
    const currentWeekday = today.getDay()
    let daysUntilStart = (startWeekday - currentWeekday + 7) % 7
    if (daysUntilStart === 0) daysUntilStart = 0 // Start today if it's the right weekday
    
    const startDate = new Date(today)
    startDate.setDate(today.getDate() + daysUntilStart)
    
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + duration - 1)
    
    return {
      start_date: startDate.toLocaleDateString(),
      end_date: endDate.toLocaleDateString()
    }
  } catch (err) {
    return null
  }
})

// Helper function
function getWeekdayName(weekday) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[weekday] || 'Invalid'
}

// Form submission
async function submitBudget() {
  if (!isFormValid.value) return
  
  isSubmitting.value = true
  error.value = ''
  
  try {
    await emit('submit', { ...budgetData.value })
  } catch (err) {
    error.value = err.message || 'Failed to save budget'
  } finally {
    isSubmitting.value = false
  }
}

// Watch for prop changes
watch(() => props.initialData, (newData) => {
  budgetData.value = { ...newData }
}, { deep: true })
</script>

<style scoped>
.budget-form {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.budget-form h2 {
  text-align: center;
  margin-bottom: 24px;
  color: #e0e0e0;
}

.error-message {
  background: #2e1a1a;
  border: 1px solid #5c2e2e;
  color: #f44336;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  color: #b0b0b0;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #444;
  border-radius: 4px;
  font-size: 14px;
  background: #2a2a2a;
  color: #e0e0e0;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-group input:disabled,
.form-group select:disabled {
  background: #1a1a1a;
  color: #666;
  cursor: not-allowed;
}

.preview-group {
  margin-top: 24px;
  margin-bottom: 24px;
}

.budget-preview {
  background: #2a2a2a;
  border: 1px solid #444;
  padding: 16px;
  border-radius: 4px;
}

.budget-preview h4 {
  margin: 0 0 12px 0;
  color: #e0e0e0;
}

.budget-preview p {
  margin: 4px 0;
  color: #b0b0b0;
}

.preview-period {
  color: #888;
  font-style: italic;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.form-actions button {
  padding: 10px 20px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #3a3a3a;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.form-actions button:hover:not(:disabled) {
  background: #4a4a4a;
  border-color: #007bff;
  color: #007bff;
}

.form-actions button:disabled {
  background: #2a2a2a;
  color: #666;
  cursor: not-allowed;
  border-color: #333;
}

.form-actions button.primary {
  background: #007bff;
  border-color: #007bff;
  color: white;
}

.form-actions button.primary:hover:not(:disabled) {
  background: #0056b3;
  border-color: #0056b3;
}

/* Responsive */
@media (max-width: 600px) {
  .budget-form {
    margin: 10px;
    padding: 16px;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions button {
    width: 100%;
  }
}
</style>