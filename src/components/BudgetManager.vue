<template>
  <div class="budget-manager">
    <div class="manager-header">
      <h2>Budget Management</h2>
      <button @click="showCreateForm = true" class="create-btn">
        + New Budget
      </button>
    </div>

    <!-- Create/Edit Form Modal -->
    <div v-if="showCreateForm || editingBudget" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <BudgetForm
          :initial-data="editingBudget || {}"
          :is-editing="!!editingBudget"
          @submit="handleBudgetSubmit"
          @cancel="closeModal"
        />
      </div>
    </div>

    <!-- Budget List -->
    <div class="budgets-section">
      <!-- Active Budget -->
      <div v-if="activeBudget" class="budget-group">
        <h3 class="group-title">Active Budget</h3>
        <div class="budget-card active">
          <div class="budget-main">
            <div class="budget-info">
              <h4>{{ activeBudget.name }}</h4>
              <p class="budget-details">
                ${{ formatAmount(activeBudget.amount) }} • 
                {{ getWeekdayName(activeBudget.start_weekday) }} • 
                {{ activeBudget.duration_days }} days
              </p>
              <p v-if="activeBudget.vacation_mode" class="vacation-badge">
                🏖️ Vacation Mode
              </p>
            </div>
            <div class="budget-actions">
              <button @click="editBudget(activeBudget)" class="edit-btn">
                Edit
              </button>
              <button 
                @click="toggleVacationMode(activeBudget)" 
                class="vacation-btn"
                :class="{ active: activeBudget.vacation_mode }"
              >
                {{ activeBudget.vacation_mode ? 'Resume' : 'Vacation' }}
              </button>
            </div>
          </div>
          
          <!-- Current Period Info -->
          <div v-if="currentPeriod" class="period-info">
            <div class="period-dates">
              <span class="period-label">Current Period:</span>
              {{ formatDate(currentPeriod.start_date) }} - {{ formatDate(currentPeriod.end_date) }}
            </div>
            <div class="period-spending">
              <div class="spending-bar">
                <div 
                  class="spending-progress" 
                  :style="{ width: spendingPercentage + '%' }"
                  :class="{ 'over-budget': isOverBudget }"
                ></div>
              </div>
              <div class="spending-text">
                ${{ formatAmount(currentPeriod.actual_spent || 0) }} of ${{ formatAmount(currentPeriod.target_amount) }}
                ({{ Math.round(spendingPercentage) }}%)
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Upcoming Budget -->
      <div v-if="upcomingBudget" class="budget-group">
        <h3 class="group-title">Upcoming Budget</h3>
        <div class="budget-card upcoming">
          <div class="budget-main">
            <div class="budget-info">
              <h4>{{ upcomingBudget.name }}</h4>
              <p class="budget-details">
                ${{ formatAmount(upcomingBudget.amount) }} • 
                {{ getWeekdayName(upcomingBudget.start_weekday) }} • 
                {{ upcomingBudget.duration_days }} days
              </p>
              <p class="upcoming-start-date">
                Will start: {{ getUpcomingStartDate() }}
              </p>
            </div>
            <div class="budget-actions">
              <button @click="editBudget(upcomingBudget)" class="edit-btn">
                Edit
              </button>
              <button 
                v-if="!activeBudget" 
                @click="activateBudget(upcomingBudget)" 
                class="activate-btn"
              >
                Activate Now
              </button>
              <button @click="cancelUpcoming(upcomingBudget)" class="cancel-btn">
                {{ isUpcomingBudgetAlsoActive ? 'Remove as Upcoming' : 'Cancel' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Draft/Inactive Budgets -->
      <div v-if="otherBudgets.length > 0" class="budget-group">
        <h3 class="group-title">Other Budgets</h3>
        <div v-for="budget in otherBudgets" :key="budget.id" class="budget-card draft">
          <div class="budget-main">
            <div class="budget-info">
              <h4>{{ budget.name }}</h4>
              <p class="budget-details">
                ${{ formatAmount(budget.amount) }} • 
                {{ getWeekdayName(budget.start_weekday) }} • 
                {{ budget.duration_days }} days
              </p>
              <p class="budget-status">Draft</p>
            </div>
            <div class="budget-actions">
              <button @click="editBudget(budget)" class="edit-btn">
                Edit
              </button>
              <button @click="scheduleForNext(budget)" class="schedule-btn">
                Set as Upcoming
              </button>
              <button 
                v-if="!budget.has_history" 
                @click="deleteBudget(budget)" 
                class="delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Historical Periods -->
      <div v-if="historicalPeriods.length > 0" class="budget-group">
        <h3 class="group-title">Recent History</h3>
        <div class="history-list">
          <div 
            v-for="period in historicalPeriods.slice(0, 5)" 
            :key="period.id" 
            class="history-item"
          >
            <div class="history-info">
              <div class="history-name">{{ period.budget_name }}</div>
              <div class="history-dates">
                {{ formatDate(period.start_date) }} - {{ formatDate(period.end_date) }}
              </div>
            </div>
            <div class="history-spending">
              <div class="history-amount">
                ${{ formatAmount(period.actual_spent || 0) }} / ${{ formatAmount(period.target_amount) }}
              </div>
              <div class="history-percentage" :class="{ 'over-budget': (period.actual_spent || 0) > period.target_amount }">
                {{ Math.round(((period.actual_spent || 0) / period.target_amount) * 100) }}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="budgets.length === 0 && !loading" class="empty-state">
        <h3>No Budgets Created</h3>
        <p>Create your first budget to start tracking your spending with targets and insights.</p>
        <button @click="showCreateForm = true" class="create-first-btn">
          Create Your First Budget
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>Loading budgets...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import BudgetForm from './BudgetForm.vue'

const props = defineProps({
  budgets: {
    type: Array,
    default: () => []
  },
  currentPeriod: {
    type: Object,
    default: null
  },
  historicalPeriods: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  autoShowCreateForm: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'create-budget',
  'update-budget', 
  'delete-budget',
  'activate-budget',
  'schedule-budget',
  'cancel-upcoming',
  'vacation-mode-toggle'
])

// Local state
const showCreateForm = ref(false)
const editingBudget = ref(null)

// Watch for auto-show prop changes
watch(() => props.autoShowCreateForm, (shouldShow) => {
  if (shouldShow) {
    showCreateForm.value = true
  }
}, { immediate: true })

// Computed properties
const activeBudget = computed(() => {
  return props.budgets.find(b => b.is_active)
})

const upcomingBudget = computed(() => {
  return props.budgets.find(b => b.is_upcoming)
})

const otherBudgets = computed(() => {
  return props.budgets.filter(b => {
    // Include budgets that are neither active nor upcoming
    // OR budgets that are active but not upcoming (so they can be set as upcoming again)
    return (!b.is_active && !b.is_upcoming) || (b.is_active && !b.is_upcoming)
  })
})

const spendingPercentage = computed(() => {
  if (!props.currentPeriod || !props.currentPeriod.target_amount) return 0
  return Math.min(((props.currentPeriod.actual_spent || 0) / props.currentPeriod.target_amount) * 100, 100)
})

const isOverBudget = computed(() => {
  if (!props.currentPeriod) return false
  return (props.currentPeriod.actual_spent || 0) > props.currentPeriod.target_amount
})

const isUpcomingBudgetAlsoActive = computed(() => {
  if (!upcomingBudget.value) return false
  return upcomingBudget.value.is_active
})

// Methods
function formatAmount(amount) {
  return typeof amount === 'number' ? amount.toFixed(2) : '0.00'
}

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

function getWeekdayName(weekday) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[weekday] || 'Invalid'
}

function closeModal() {
  showCreateForm.value = false
  editingBudget.value = null
}

function editBudget(budget) {
  editingBudget.value = { ...budget }
}

async function handleBudgetSubmit(budgetData) {
  try {
    if (editingBudget.value) {
      const isActive = activeBudget.value?.id === editingBudget.value.id
      await emit('update-budget', editingBudget.value.id, budgetData, isActive)
    } else {
      await emit('create-budget', budgetData)
    }
    closeModal()
  } catch (error) {
    console.error('Budget operation failed:', error)
    throw error
  }
}

async function activateBudget(budget) {
  if (confirm(`Activate "${budget.name}" now? This will replace the current active budget.`)) {
    try {
      await emit('activate-budget', budget.id)
    } catch (error) {
      console.error('Failed to activate budget:', error)
    }
  }
}

async function scheduleForNext(budget) {
  if (upcomingBudget.value) {
    if (!confirm(`Replace "${upcomingBudget.value.name}" as the upcoming budget with "${budget.name}"?`)) {
      return
    }
  }
  
  try {
    await emit('schedule-budget', budget.id)
  } catch (error) {
    console.error('Failed to schedule budget:', error)
  }
}

async function cancelUpcoming(budget) {
  const isAlsoActive = budget.is_active
  const action = isAlsoActive ? 'remove as upcoming' : 'cancel'
  const message = isAlsoActive 
    ? `Remove "${budget.name}" as upcoming budget? It will remain active for the current period.`
    : `Cancel "${budget.name}" as upcoming budget?`
    
  if (confirm(message)) {
    try {
      await emit('cancel-upcoming', budget.id)
    } catch (error) {
      console.error(`Failed to ${action} budget:`, error)
    }
  }
}

async function deleteBudget(budget) {
  if (confirm(`Delete "${budget.name}"? This cannot be undone.`)) {
    try {
      await emit('delete-budget', budget.id)
    } catch (error) {
      console.error('Failed to delete budget:', error)
    }
  }
}

async function toggleVacationMode(budget) {
  try {
    await emit('vacation-mode-toggle', budget.id, !budget.vacation_mode)
  } catch (error) {
    console.error('Failed to toggle vacation mode:', error)
  }
}

function getUpcomingStartDate() {
  if (!upcomingBudget.value) return ''
  
  // If there's an active budget with current period, start after it ends
  if (activeBudget.value && props.currentPeriod) {
    const endDate = new Date(props.currentPeriod.end_date)
    endDate.setDate(endDate.getDate() + 1) // Day after current period ends
    return endDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }
  
  // If no active budget, calculate next occurrence of the start weekday
  const today = new Date()
  const targetWeekday = upcomingBudget.value.start_weekday
  const currentWeekday = today.getDay()
  
  let daysUntilStart = (targetWeekday - currentWeekday + 7) % 7
  if (daysUntilStart === 0) daysUntilStart = 7 // Start next week if today is the target day
  
  const startDate = new Date(today)
  startDate.setDate(today.getDate() + daysUntilStart)
  
  return startDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}
</script>

<style scoped>
.budget-manager {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.manager-header h2 {
  margin: 0;
  color: #e0e0e0;
}

.create-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.create-btn:hover {
  background: #218838;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 8px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

/* Budget Groups */
.budget-group {
  margin-bottom: 32px;
}

.group-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 16px;
  border-bottom: 2px solid #444;
  padding-bottom: 8px;
}

/* Budget Cards */
.budget-card {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  transition: box-shadow 0.2s;
}

.budget-card:hover {
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
}

.budget-card.active {
  border-color: #28a745;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.budget-card.upcoming {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.budget-card.draft {
  border-color: #6c757d;
  opacity: 0.9;
}

.budget-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.budget-info h4 {
  margin: 0 0 4px 0;  
  color: #e0e0e0;
  font-size: 18px;
}

.budget-details {
  margin: 0;
  color: #b0b0b0;
  font-size: 14px;
}

.budget-status {
  margin: 4px 0 0 0;
  color: #888;
  font-size: 12px;
  text-transform: uppercase;
  font-weight: 500;
}

.vacation-badge {
  margin: 4px 0 0 0;
  color: #fd7e14;
  font-size: 12px;
  font-weight: 500;
}

.upcoming-start-date {
  margin: 4px 0 0 0;
  color: #007bff;
  font-size: 12px;
  font-weight: 500;
}

.budget-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.budget-actions button {
  padding: 6px 12px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #3a3a3a;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.budget-actions button:hover {
  background: #4a4a4a;
  border-color: #007bff;
  color: #007bff;
}

.edit-btn:hover {
  border-color: #007bff;
  color: #007bff;
}

.activate-btn {
  background: #28a745 !important;
  color: white !important;
  border-color: #28a745 !important;
}

.activate-btn:hover {
  background: #218838 !important;
}

.schedule-btn:hover {
  border-color: #007bff;
  color: #007bff;
}

.vacation-btn {
  background: #fd7e14 !important;
  color: white !important;
  border-color: #fd7e14 !important;
}

.vacation-btn.active {
  background: #6c757d !important;
  border-color: #6c757d !important;
}

.vacation-btn:hover {
  opacity: 0.8;
}

.cancel-btn:hover,
.delete-btn:hover {
  border-color: #dc3545;
  color: #dc3545;
}

/* Period Info */
.period-info {
  padding-top: 16px;
  border-top: 1px solid #444;
}

.period-dates {
  margin-bottom: 12px;
  font-size: 14px;
  color: #b0b0b0;
}

.period-label {
  font-weight: 500;
  color: #e0e0e0;
}

.spending-bar {
  height: 8px;
  background: #444;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.spending-progress {
  height: 100%;
  background: #28a745;
  transition: width 0.3s ease;
}

.spending-progress.over-budget {
  background: #dc3545;
}

.spending-text {
  font-size: 13px;
  color: #b0b0b0;
  text-align: right;
}

/* History */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  transition: box-shadow 0.2s;
}

.history-item:hover {
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
}

.history-name {
  font-weight: 500;
  color: #e0e0e0;
  margin-bottom: 2px;
}

.history-dates {
  font-size: 12px;
  color: #b0b0b0;
}

.history-amount {
  font-size: 14px;
  color: #e0e0e0;
  text-align: right;
  margin-bottom: 2px;
}

.history-percentage {
  font-size: 12px;
  color: #28a745;
  text-align: right;
  font-weight: 500;
}

.history-percentage.over-budget {
  color: #dc3545;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-state h3 {
  color: #b0b0b0;
  margin-bottom: 12px;
}

.empty-state p {
  color: #888;
  margin-bottom: 24px;
  line-height: 1.5;
}

.create-first-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
}

.create-first-btn:hover {
  background: #0056b3;
}

/* Loading */
.loading {
  text-align: center;
  padding: 60px 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading p {
  color: #b0b0b0;
  margin: 0;
}

/* Responsive */
@media (max-width: 700px) {
  .budget-manager {
    padding: 16px;
  }
  
  .manager-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
  
  .budget-main {
    flex-direction: column;
    gap: 16px;
  }
  
  .budget-actions {
    justify-content: flex-start;
  }
  
  .history-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .history-spending {
    align-self: flex-end;
    text-align: right;
  }
}

</style>
