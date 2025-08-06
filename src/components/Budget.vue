<template>
  <div class="budget">
    <!-- Budget Dashboard -->
    <div v-if="currentView === 'dashboard'">
      <BudgetDashboard
        :current-budget="activeBudget"
        :current-period="currentPeriod"
        :loading="loading"
        @create-budget="showCreateBudget"
        @manage-budget="showManageBudgets"
        @vacation-mode-toggle="handleVacationModeToggle"
      />
    </div>

    <!-- Budget Manager -->
    <div v-if="currentView === 'manage'">
      <BudgetManager
        :budgets="budgets"
        :current-period="currentPeriod"
        :historical-periods="historicalPeriods"
        :loading="loading"
        :auto-show-create-form="autoShowCreateForm"
        @create-budget="handleCreateBudget"
        @update-budget="handleUpdateBudget"
        @delete-budget="handleDeleteBudget"
        @activate-budget="handleActivateBudget"
        @schedule-budget="handleScheduleBudget"
        @cancel-upcoming="handleCancelUpcoming"
        @vacation-mode-toggle="handleVacationModeToggleById"
      />
    </div>

    <!-- Recent History -->
    <div v-if="currentView === 'dashboard' && historicalPeriods.length > 0" class="recent-history">
      <h3 class="history-title">Recent History</h3>
      <div class="history-list">
        <div 
          v-for="period in historicalPeriods.slice(0, 5)" 
          :key="period.id" 
          class="history-item"
        >
          <div class="history-info">
            <div class="history-name">{{ period.budget_name }}</div>
            <div class="history-dates">
              {{ formatDateRange(period.start_date, period.end_date) }}
            </div>
          </div>
          <div class="history-spending">
            <div class="history-amount">
              ${{ formatAmount(period.actual_spent || 0) }} / ${{ formatAmount(period.target_amount) }}
            </div>
            <div class="history-percentage" :class="{ 'over-budget': isOverBudget(period) }">
              {{ Math.round(getSpendingPercentage(period)) }}%
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-banner">
      <div class="error-content">
        <span class="error-message">{{ error }}</span>
        <button @click="error = ''" class="error-close">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import BudgetDashboard from './BudgetDashboard.vue'
import BudgetManager from './BudgetManager.vue'
import { budgetService, type Budget, type BudgetPeriod } from '../services/budget'
import { formatAmount, formatDateRange, getSpendingPercentage, isOverBudget } from '../services/budgetUiService'

// Props
const props = defineProps<{
  refreshTrigger?: number
}>()

// Component state
const currentView = ref<'dashboard' | 'manage'>('dashboard')
const budgets = ref<Budget[]>([])
const currentPeriod = ref<BudgetPeriod | null>(null)
const historicalPeriods = ref<BudgetPeriod[]>([])
const allPeriods = ref<BudgetPeriod[]>([])
const loading = ref(false)
const error = ref('')
const autoShowCreateForm = ref(false)

// Computed properties
const activeBudget = computed(() => {
  return budgets.value.find(b => b.is_active) || null
})

// Note: upcomingBudget computed property not currently used
// const upcomingBudget = computed(() => {
//   return budgets.value.find(b => b.is_upcoming) || null
// })

// Watch for expense changes
watch(() => props.refreshTrigger, () => {
  if (props.refreshTrigger !== undefined) {
    loadBudgetData(false) // Silent refresh when expenses change
  }
})

// Lifecycle
onMounted(async () => {
  await loadBudgetData()
})

// Data loading
async function loadBudgetData(showLoading = true) {
  if (showLoading) {
    loading.value = true
  }
  
  try {
    const [budgetsData, currentPeriodData, allPeriodsData] = await Promise.all([
      budgetService.getAllBudgets(),
      budgetService.getCurrentBudgetPeriod().catch(() => null),
      budgetService.getBudgetPeriods().catch(() => [])
    ])
    
    budgets.value = budgetsData
    currentPeriod.value = currentPeriodData
    
    // Generate virtual upcoming periods for upcoming budgets that don't have actual periods yet
    const upcomingBudget = budgetsData.find(b => b.is_upcoming)
    const virtualUpcomingPeriods = []
    
    if (upcomingBudget && currentPeriod.value) {
      // Calculate when the upcoming budget will start (after current period ends)
      const currentEndDate = new Date(currentPeriod.value.end_date)
      const upcomingStartDate = new Date(currentEndDate)
      upcomingStartDate.setDate(upcomingStartDate.getDate() + 1)
      
      const upcomingEndDate = new Date(upcomingStartDate)
      upcomingEndDate.setDate(upcomingEndDate.getDate() + upcomingBudget.duration_days - 1)
      
      // Check if this period doesn't already exist in allPeriodsData
      const existingUpcoming = allPeriodsData.find(p => 
        p.budget_id === upcomingBudget.id && p.status === 'upcoming'
      )
      
      if (!existingUpcoming) {
        virtualUpcomingPeriods.push({
          id: -upcomingBudget.id, // Use negative ID to avoid conflicts
          budget_id: upcomingBudget.id,
          budget_name: upcomingBudget.name,
          start_date: upcomingStartDate.toISOString().split('T')[0],
          end_date: upcomingEndDate.toISOString().split('T')[0],
          target_amount: upcomingBudget.amount,
          actual_spent: 0,
          status: 'upcoming' as const,
          created_at: new Date().toISOString()
        })
      }
    }
    
    // Store all periods including virtual upcoming periods for calendar view
    allPeriods.value = [...allPeriodsData, ...virtualUpcomingPeriods]
    
    // For the manager list view, show only completed periods
    historicalPeriods.value = allPeriodsData.filter(p => p.status === 'completed').slice(0, 10)
    
    // If there are budgets but no active budget, show management view
    const hasActiveBudget = budgetsData.find(b => b.is_active)
    if (budgetsData.length > 0 && !hasActiveBudget && currentView.value === 'dashboard') {
      currentView.value = 'manage'
      autoShowCreateForm.value = false
    }
    
    error.value = ''
  } catch (err) {
    console.error('Failed to load budget data:', err)
    error.value = 'Failed to load budget data. Please try again.'
  } finally {
    loading.value = false
  }
}

// View navigation
function showCreateBudget() {
  currentView.value = 'manage'
  autoShowCreateForm.value = budgets.value.length === 0
}

function showManageBudgets() {
  currentView.value = 'manage'
  autoShowCreateForm.value = false
}

// Budget operations
async function handleCreateBudget(budgetData: any) {
  try {
    const newBudget = await budgetService.createBudget(budgetData)
    await loadBudgetData()
    
    // Reset auto-show flag - let loadBudgetData() decide the view
    autoShowCreateForm.value = false
    // Don't force dashboard view - let loadBudgetData logic determine the correct view
    
    // Show success message
    showSuccessMessage(`Budget "${newBudget.name}" created successfully`)
  } catch (err: any) {
    error.value = err.message || 'Failed to create budget'
    throw err
  }
}

async function handleUpdateBudget(budgetId: number, updateData: any) {
  try {
    const updatedBudget = await budgetService.updateBudget(budgetId, updateData)
    await loadBudgetData()
    
    showSuccessMessage(`Budget "${updatedBudget.name}" updated successfully`)
  } catch (err: any) {
    error.value = err.message || 'Failed to update budget'
    throw err
  }
}

async function handleDeleteBudget(budgetId: number) {
  try {
    const budget = budgets.value.find(b => b.id === budgetId)
    await budgetService.deleteBudget(budgetId)
    await loadBudgetData()
    
    showSuccessMessage(`Budget "${budget?.name || 'Budget'}" deleted successfully`)
  } catch (err: any) {
    error.value = err.message || 'Failed to delete budget'
    throw err
  }
}

async function handleActivateBudget(budgetId: number) {
  try {
    const activatedBudget = await budgetService.activateBudget(budgetId)
    await loadBudgetData()
    
    showSuccessMessage(`Budget "${activatedBudget.name}" is now active`)
  } catch (err: any) {
    error.value = err.message || 'Failed to activate budget'
    throw err
  }
}

async function handleScheduleBudget(budgetId: number) {
  try {
    const scheduledBudget = await budgetService.scheduleBudget(budgetId)
    await loadBudgetData()
    
    showSuccessMessage(`Budget "${scheduledBudget.name}" scheduled as upcoming`)
  } catch (err: any) {
    error.value = err.message || 'Failed to schedule budget'
    throw err
  }
}

async function handleCancelUpcoming(budgetId: number) {
  try {
    const budget = budgets.value.find(b => b.id === budgetId)
    
    if (budget?.is_active) {
      // If budget is also active, just remove upcoming status
      await budgetService.updateBudget(budgetId, { is_upcoming: false })
      showSuccessMessage(`Removed "${budget.name}" as upcoming budget`)
    } else {
      // If budget is only upcoming (not active), delete it completely
      await budgetService.deleteBudget(budgetId)
      showSuccessMessage(`Cancelled "${budget?.name || 'Budget'}" as upcoming`)
    }
    
    await loadBudgetData()
  } catch (err: any) {
    error.value = err.message || 'Failed to cancel upcoming budget'
    throw err
  }
}

async function handleVacationModeToggle(newVacationMode: boolean) {
  if (!activeBudget.value) return
  
  try {
    await budgetService.toggleVacationMode(activeBudget.value.id, newVacationMode)
    await loadBudgetData()
    
    const mode = newVacationMode ? 'enabled' : 'disabled'
    showSuccessMessage(`Vacation mode ${mode} for "${activeBudget.value.name}"`)
  } catch (err: any) {
    error.value = err.message || 'Failed to toggle vacation mode'
    throw err
  }
}

async function handleVacationModeToggleById(budgetId: number, newVacationMode: boolean) {
  try {
    const budget = budgets.value.find(b => b.id === budgetId)
    await budgetService.toggleVacationMode(budgetId, newVacationMode)
    await loadBudgetData()
    
    const mode = newVacationMode ? 'enabled' : 'disabled'
    showSuccessMessage(`Vacation mode ${mode} for "${budget?.name || 'Budget'}"`)
  } catch (err: any) {
    error.value = err.message || 'Failed to toggle vacation mode'
    throw err
  }
}

// Success message helper
function showSuccessMessage(message: string) {
  // For now, we'll just console.log success messages
  // In the future, this could be a toast notification system
  console.log('Success:', message)
}
</script>

<style scoped>
.budget {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  min-height: 60vh;
}

.manager-footer {
  margin-top: 32px;
  text-align: center;
}

.back-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.back-btn:hover {
  background: #5a6268;
}

/* Error Banner */
.error-banner {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: 500px;
  width: 90%;
}

.error-content {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
  padding: 12px 16px;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.error-message {
  font-size: 14px;
  line-height: 1.4;
}

.error-close {
  background: none;
  border: none;
  color: #721c24;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  padding: 0;
  margin-left: 12px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-close:hover {
  opacity: 0.7;
}

/* Responsive */
@media (max-width: 768px) {
  .budget {
    padding: 16px;
  }
  
  .error-banner {
    width: 95%;
    top: 10px;
  }
  
  .error-content {
    padding: 10px 12px;
    font-size: 13px;
  }
}

/* Recent History Styles */
.recent-history {
  margin: 32px auto 0;
  max-width: 800px;
}

.history-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 16px;
  border-bottom: 2px solid #444;
  padding-bottom: 8px;
}

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

/* Responsive adjustments for Recent History */
@media (max-width: 768px) {
  .recent-history {
    margin: 24px 16px 0;
  }
  
  .history-item {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
</style>