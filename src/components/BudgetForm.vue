<template>
  <div class="card budget-form">
    <h2 class="card-title text-center">{{ isEditing ? 'Edit Budget' : 'Create Budget' }}</h2>
    
    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>
    
    <form @submit.prevent="submitBudget">
      <div class="form-group">
        <label for="budget-name" class="form-label">Budget Name:</label>
        <input
          id="budget-name"
          v-model="budgetData.name"
          type="text"
          class="form-input"
          required
          placeholder="e.g., Weekly Groceries, Monthly Entertainment"
          :disabled="isSubmitting"
        />
      </div>

      <div class="form-group">
        <label for="budget-amount" class="form-label">Target Amount ($):</label>
        <input
          id="budget-amount"
          v-model.number="budgetData.amount"
          type="number"
          step="0.01"
          min="0.01"
          class="form-input"
          required
          placeholder="0.00"
          :disabled="isSubmitting"
        />
      </div>

      <div class="form-group">
        <label for="start-weekday" class="form-label">Start Day:</label>
        <select
          id="start-weekday"
          v-model.number="budgetData.start_weekday"
          class="form-select"
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
        <label for="duration" class="form-label">Duration (days):</label>
        <select
          id="duration"
          v-model.number="budgetData.duration_days"
          class="form-select"
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
        <div class="budget-preview card card-compact">
          <h4 class="preview-title">Budget Preview:</h4>
          <p><strong>{{ budgetData.name || 'Unnamed Budget' }}</strong></p>
          <p>Amount: ${{ budgetData.amount ? budgetData.amount.toFixed(2) : '0.00' }}</p>
          <p>Starts: {{ getWeekdayName(budgetData.start_weekday) }}</p>
          <p>Duration: {{ budgetData.duration_days }} days</p>
          <p v-if="budgetPreview">
            <small class="text-muted text-sm preview-period">
              Next period: {{ budgetPreview.start_date }} to {{ budgetPreview.end_date }}
            </small>
          </p>
        </div>
      </div>

      <div class="flex gap-md justify-end form-actions">
        <button type="button" @click="$emit('cancel')" :disabled="isSubmitting" class="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" :disabled="!isFormValid || isSubmitting" class="btn btn-primary">
          <span v-if="isSubmitting">Saving<span class="loading-dots"></span></span>
          <span v-else>{{ isEditing ? 'Update Budget' : 'Create Budget' }}</span>
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
  box-shadow: var(--shadow-lg);
}

.preview-group {
  margin-top: var(--spacing-3xl);
  margin-bottom: var(--spacing-3xl);
}

.budget-preview p {
  margin: var(--spacing-xs) 0;
  color: var(--text-secondary);
}

.preview-title {
  margin: 0 0 var(--spacing-base) 0;
  color: var(--text-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}

.preview-period {
  font-style: italic;
}

.form-actions {
  margin-top: var(--spacing-3xl);
}

/* Responsive */
@media (max-width: 600px) {
  .budget-form {
    margin: var(--spacing-md);
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions .btn {
    width: 100%;
  }
}
</style>