<template>
  <div class="calendar-page">
    <!-- Page Header -->
    <div class="page-header">
      <h2>Calendar</h2>
      <p class="page-description">View your budget periods and expenses in a calendar format</p>
    </div>

    <!-- Calendar Component -->
    <div class="calendar-container">
      <!-- Calendar Header -->
      <div class="calendar-header">
        <button @click="previousMonth" class="nav-btn">‹</button>
        <h3 class="month-title">
          {{ currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }}
        </h3>
        <button @click="nextMonth" class="nav-btn">›</button>
      </div>

      <!-- Weekday Headers -->
      <div class="weekday-headers">
        <div v-for="day in weekdays" :key="day" class="weekday-header">{{ day }}</div>
      </div>

      <!-- Calendar Grid -->
      <div class="calendar-grid">
        <div 
          v-for="day in calendarDays" 
          :key="day.dateKey"
          class="calendar-day"
          :class="{
            'other-month': !day.isCurrentMonth,
            'today': day.isToday,
            'has-budget': day.budgetPeriods.length > 0,
            'has-expenses': getDailyCount(day.date) > 0
          }"
          :style="{ 
            '--spending-intensity': getSpendingIntensity(day.date),
            backgroundColor: getSpendingIntensity(day.date) > 0 ? 
              `rgba(255, 99, 71, ${getSpendingIntensity(day.date) * 0.3})` : 
              undefined 
          }"
          @click="showDayDetails(day.date)"
          @mouseenter="showHoverPreview(day.date, $event)"
          @mouseleave="hideHoverPreview"
        >
          <div class="day-header">
            <div class="day-number">{{ day.date.getDate() }}</div>
            <div v-if="getDailyCount(day.date) > 0" class="expense-info">
              <span class="expense-count">{{ getDailyCount(day.date) }}</span>
              <span class="expense-total">${{ getDailyTotal(day.date).toFixed(0) }}</span>
            </div>
          </div>
          
          <!-- Budget Period Overlays -->
          <div class="budget-periods">
            <div 
              v-for="period in day.budgetPeriods" 
              :key="period.id"
              class="budget-period"
              :class="{
                'period-start': day.isPeriodStart(period),
                'period-end': day.isPeriodEnd(period),
                'period-middle': day.isPeriodMiddle(period),
                [`status-${period.status}`]: true
              }"
              @click="showPeriodDetails(period, $event)"
              :title="getPeriodTooltip(period)"
            >
              <span v-if="day.isPeriodStart(period)" class="period-label">
                {{ period.budget_name }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="calendar-legend">
        <div class="legend-title">Budget Status:</div>
        <div class="legend-items">
          <div class="legend-item">
            <div class="legend-color status-upcoming"></div>
            <span>Upcoming</span>
          </div>
          <div class="legend-item">
            <div class="legend-color status-active"></div>
            <span>Active</span>
          </div>
          <div class="legend-item">
            <div class="legend-color status-completed"></div>
            <span>Completed</span>
          </div>
        </div>
      </div>

      <!-- Expense Hover Preview -->
      <div 
        v-if="hoverPreview && hoverPreview.expenses.length > 0" 
        class="expense-preview" 
        :style="{ left: hoverPreview.position.x + 'px', top: hoverPreview.position.y + 'px' }"
        @click.stop
      >
        <div class="preview-header">
          <span class="preview-date">{{ hoverPreview.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</span>
          <span class="preview-total">${{ hoverPreview.total.toFixed(2) }}</span>
        </div>
        <div class="preview-expenses">
          <div 
            v-for="expense in hoverPreview.expenses.slice(0, 3)" 
            :key="expense.id" 
            class="preview-expense"
          >
            <span class="preview-amount">${{ expense.amount.toFixed(2) }}</span>
            <span class="preview-location">{{ expense.place_name || 'Unknown' }}</span>
          </div>
          <div v-if="hoverPreview.expenses.length > 3" class="preview-more">
            +{{ hoverPreview.expenses.length - 3 }} more
          </div>
        </div>
      </div>

      <!-- Period Details Tooltip -->
      <div 
        v-if="selectedPeriod && tooltipPosition" 
        class="period-tooltip" 
        :style="{ left: tooltipPosition.x + 'px', top: tooltipPosition.y + 'px' }"
        @click.stop
      >
        <div class="tooltip-header">
          <h4>{{ selectedPeriod.budget_name }}</h4>
          <button @click="selectedPeriod = null" class="close-tooltip">×</button>
        </div>
        <div class="tooltip-body">
          <div class="tooltip-row">
            <span class="label">Period:</span>
            <span>{{ formatDate(selectedPeriod.start_date) }} - {{ formatDate(selectedPeriod.end_date) }}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Budget:</span>
            <span>${{ formatAmount(selectedPeriod.target_amount) }}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Spent:</span>
            <span class="amount" :class="{ 'over-budget': isOverBudget(selectedPeriod) }">
              ${{ formatAmount(selectedPeriod.actual_spent || 0) }}
            </span>
          </div>
          <div class="tooltip-row">
            <span class="label">Progress:</span>
            <span class="percentage" :class="{ 'over-budget': isOverBudget(selectedPeriod) }">
              {{ Math.round(((selectedPeriod.actual_spent || 0) / selectedPeriod.target_amount) * 100) }}%
            </span>
          </div>
          <div class="tooltip-row">
            <span class="label">Status:</span>
            <span class="status-badge" :class="`status-${selectedPeriod.status}`">
              {{ selectedPeriod.status.charAt(0).toUpperCase() + selectedPeriod.status.slice(1) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Day Expenses Modal -->
    <div v-if="selectedDay" class="modal-overlay" @click="closeDayDetails">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>{{ selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }}</h4>
          <button @click="closeDayDetails" class="close-modal">×</button>
        </div>
        <div class="modal-body">
          <div v-if="selectedDayExpenses.length === 0" class="no-expenses">
            <p>No expenses for this day</p>
          </div>
          <div v-else>
            <div class="expense-summary">
              <span class="summary-label">Total:</span>
              <span class="summary-amount">${{ getDailyTotal(selectedDay).toFixed(2) }}</span>
              <span class="summary-count">({{ selectedDayExpenses.length }} expenses)</span>
            </div>
            <div class="expense-list">
              <div v-for="expense in selectedDayExpenses" :key="expense.id" class="expense-item">
                <div class="expense-main">
                  <div class="expense-amount">${{ expense.amount.toFixed(2) }}</div>
                  <div class="expense-location">{{ expense.place_name || 'Unknown location' }}</div>
                </div>
                <div class="expense-time">
                  {{ new Date(expense.timestamp).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  }) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>Loading calendar data...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { budgetService } from '../services/budget'
import { databaseService } from '../services/database'

// Props for refresh trigger
const props = defineProps({
  refreshTrigger: {
    type: Number,
    default: 0
  }
})

// Reactive data
const currentMonth = ref(new Date())
const selectedPeriod = ref(null)
const tooltipPosition = ref(null)
const selectedDay = ref(null)
const selectedDayExpenses = ref([])
const hoverPreview = ref(null)
const allPeriods = ref([])
const currentPeriod = ref(null)
const budgets = ref([])
const expenses = ref([])
const loading = ref(false)

// Constants
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Watch for refresh trigger changes
watch(() => props.refreshTrigger, () => {
  if (props.refreshTrigger !== undefined) {
    loadCalendarData()
  }
})

// Computed
const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  
  // Get first day of the month and calculate starting point
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay()) // Start from previous Sunday
  
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Generate 42 days (6 weeks) for consistent calendar grid
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    
    const isCurrentMonth = date.getMonth() === month
    const isToday = date.getTime() === today.getTime()
    
    // Find budget periods that overlap with this day
    const budgetPeriods = getPeriodsForDate(date)
    
    days.push({
      date,
      dateKey: date.toISOString().split('T')[0],
      isCurrentMonth,
      isToday,
      budgetPeriods,
      isPeriodStart: (period) => {
        const periodStart = new Date(period.start_date)
        periodStart.setHours(0, 0, 0, 0)
        return date.getTime() === periodStart.getTime()
      },
      isPeriodEnd: (period) => {
        const periodEnd = new Date(period.end_date)
        periodEnd.setHours(0, 0, 0, 0)
        return date.getTime() === periodEnd.getTime()
      },
      isPeriodMiddle: (period) => {
        const periodStart = new Date(period.start_date)
        const periodEnd = new Date(period.end_date)
        periodStart.setHours(0, 0, 0, 0)
        periodEnd.setHours(0, 0, 0, 0)
        return date.getTime() > periodStart.getTime() && date.getTime() < periodEnd.getTime()
      }
    })
  }
  
  return days
})

// Methods
function getPeriodsForDate(date) {
  const periods = [...allPeriods.value]
  
  // Only add currentPeriod if it's not already in allPeriods
  if (currentPeriod.value && !periods.find(p => p.id === currentPeriod.value.id)) {
    periods.push(currentPeriod.value)
  }
  
  return periods.filter(period => {
    const periodStart = new Date(period.start_date)
    const periodEnd = new Date(period.end_date)
    periodStart.setHours(0, 0, 0, 0)
    periodEnd.setHours(0, 0, 0, 0)
    date.setHours(0, 0, 0, 0)
    
    return date.getTime() >= periodStart.getTime() && date.getTime() <= periodEnd.getTime()
  })
}

function previousMonth() {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1, 1)
}

function nextMonth() {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 1)
}

function showPeriodDetails(period, event) {
  selectedPeriod.value = period
  tooltipPosition.value = {
    x: event.pageX + 10,
    y: event.pageY - 10
  }
}

function showDayDetails(date) {
  selectedDay.value = date
  selectedDayExpenses.value = getExpensesForDate(date)
  // Close period tooltip if open
  selectedPeriod.value = null
  tooltipPosition.value = null
}

function closeDayDetails() {
  selectedDay.value = null
  selectedDayExpenses.value = []
}

function showHoverPreview(date, event) {
  // Only show on desktop (non-touch devices)
  if (window.matchMedia('(max-width: 768px)').matches) return
  
  const dayExpenses = getExpensesForDate(date)
  if (dayExpenses.length === 0) return
  
  const total = getDailyTotal(date)
  
  hoverPreview.value = {
    date,
    expenses: dayExpenses,
    total,
    position: {
      x: event.pageX + 10,
      y: event.pageY - 10
    }
  }
}

function hideHoverPreview() {
  hoverPreview.value = null
}

function getPeriodTooltip(period) {
  const spent = period.actual_spent || 0
  const percentage = Math.round((spent / period.target_amount) * 100)
  return `${period.budget_name}: $${spent.toFixed(2)} / $${period.target_amount.toFixed(2)} (${percentage}%)`
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

function formatAmount(amount) {
  return typeof amount === 'number' ? amount.toFixed(2) : '0.00'
}

function isOverBudget(period) {
  return (period.actual_spent || 0) > period.target_amount
}

// Expense calculation functions
function getExpensesForDate(date) {
  const dateString = date.toISOString().split('T')[0]
  return expenses.value.filter(expense => {
    const expenseDate = new Date(expense.timestamp).toISOString().split('T')[0]
    return expenseDate === dateString
  })
}

function getDailyTotal(date) {
  const dayExpenses = getExpensesForDate(date)
  return dayExpenses.reduce((total, expense) => total + expense.amount, 0)
}

function getDailyCount(date) {
  return getExpensesForDate(date).length
}

function getSpendingIntensity(date) {
  const total = getDailyTotal(date)
  if (total === 0) return 0
  
  // Calculate intensity based on max spending in visible month
  const monthExpenses = expenses.value.filter(expense => {
    const expenseDate = new Date(expense.timestamp)
    return expenseDate.getMonth() === currentMonth.value.getMonth() && 
           expenseDate.getFullYear() === currentMonth.value.getFullYear()
  })
  
  const maxDaily = Math.max(...Array.from(new Set(monthExpenses.map(e => 
    new Date(e.timestamp).toISOString().split('T')[0]
  ))).map(dateStr => {
    const dayTotal = monthExpenses
      .filter(e => new Date(e.timestamp).toISOString().split('T')[0] === dateStr)
      .reduce((sum, e) => sum + e.amount, 0)
    return dayTotal
  }))
  
  if (maxDaily === 0) return 0
  return Math.min(total / maxDaily, 1) // Normalize to 0-1 range
}

// Data loading
async function loadCalendarData() {
  loading.value = true
  
  try {
    const [budgetsData, currentPeriodData, allPeriodsData, expensesData] = await Promise.all([
      budgetService.getAllBudgets(),
      budgetService.getCurrentBudgetPeriod().catch(() => null),
      budgetService.getBudgetPeriods().catch(() => []),
      databaseService.getAllExpenses().catch(() => [])
    ])
    
    budgets.value = budgetsData
    currentPeriod.value = currentPeriodData
    expenses.value = expensesData
    
    // Generate virtual upcoming periods for upcoming budgets that don't have actual periods yet
    const upcomingBudget = budgetsData.find(b => b.is_upcoming)
    const virtualUpcomingPeriods = []
    
    if (upcomingBudget && currentPeriodData) {
      // Calculate when the upcoming budget will start (after current period ends)
      const currentEndDate = new Date(currentPeriodData.end_date)
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
          status: 'upcoming',
          created_at: new Date().toISOString()
        })
      }
    }
    
    // Store all periods including virtual upcoming periods
    allPeriods.value = [...allPeriodsData, ...virtualUpcomingPeriods]
    
  } catch (error) {
    console.error('Error loading calendar data:', error)
  } finally {
    loading.value = false
  }
}

// Close tooltip/preview when clicking outside
function handleClickOutside(event) {
  if (selectedPeriod.value && !event.target.closest('.period-tooltip') && !event.target.closest('.budget-period')) {
    selectedPeriod.value = null
    tooltipPosition.value = null
  }
  
  // Hide hover preview on any click
  if (hoverPreview.value) {
    hoverPreview.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  loadCalendarData()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.calendar-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 32px;
  text-align: center;
}

.page-header h2 {
  color: #e0e0e0;
  font-size: 32px;
  margin-bottom: 8px;
}

.page-description {
  color: #b0b0b0;
  font-size: 16px;
}

.calendar-container {
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 24px;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 20px;
}

.nav-btn {
  background: #3a3a3a;
  color: #e0e0e0;
  border: 1px solid #444;
  border-radius: 4px;
  width: 40px;
  height: 40px;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: #4a4a4a;
  border-color: #007bff;
  color: #007bff;
}

.month-title {
  margin: 0;
  color: #e0e0e0;
  font-size: 24px;
  font-weight: 600;
}

.weekday-headers {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  margin-bottom: 10px;
  background: #444;
  border-radius: 8px 8px 0 0;
  overflow: hidden;
}

.weekday-header {
  background: #2a2a2a;
  color: #b0b0b0;
  padding: 12px 8px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: #444;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
}

.calendar-day {
  background: #2a2a2a;
  min-height: 100px;
  padding: 8px;
  position: relative;
  transition: background-color 0.2s;
}

.calendar-day:hover {
  background: #333;
}

.calendar-day.other-month {
  opacity: 0.3;
}

.calendar-day.today .day-number {
  background: #007bff;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
  min-height: 20px;
}

.day-number {
  color: #e0e0e0;
  font-weight: 500;
  font-size: 14px;
}

.expense-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 10px;
  line-height: 1.1;
}

.expense-count {
  color: #ffa500;
  font-weight: 600;
}

.expense-total {
  color: #ff6347;
  font-weight: 500;
}

.budget-periods {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.budget-period {
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 10px;
  color: white;
  cursor: pointer;
  position: relative;
  transition: opacity 0.2s;
  min-height: 16px;
  display: flex;
  align-items: center;
}

.budget-period:hover {
  opacity: 0.8;
}

.budget-period.period-start {
  border-radius: 3px 0 0 3px;
  padding-left: 6px;
}

.budget-period.period-end {
  border-radius: 0 3px 3px 0;
  padding-right: 6px;
}

.budget-period.period-start.period-end {
  border-radius: 3px;
}

.period-label {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-upcoming {
  background-color: #007bff;
}

.status-active {
  background-color: #28a745;
}

.status-completed {
  background-color: #6c757d;
}

.calendar-legend {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
  padding: 16px 20px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
}

.legend-title {
  color: #e0e0e0;
  font-weight: 600;
  font-size: 14px;
}

.legend-items {
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #b0b0b0;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.period-tooltip {
  position: fixed;
  background: #1e1e1e;
  border: 2px solid #444;
  border-radius: 8px;
  padding: 0;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  max-width: 300px;
  min-width: 250px;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #444;
  background: #2a2a2a;
  border-radius: 6px 6px 0 0;
}

.tooltip-header h4 {
  margin: 0;
  color: #e0e0e0;
  font-size: 16px;
}

.close-tooltip {
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-tooltip:hover {
  background: #444;
  color: #e0e0e0;
}

.tooltip-body {
  padding: 16px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
}

.tooltip-row:last-child {
  margin-bottom: 0;
}

.tooltip-row .label {
  color: #b0b0b0;
  font-weight: 500;
}

.tooltip-row .amount,
.tooltip-row .percentage {
  color: #28a745;
  font-weight: 600;
}

.tooltip-row .amount.over-budget,
.tooltip-row .percentage.over-budget {
  color: #dc3545;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.status-upcoming {
  background: #007bff;
  color: white;
}

.status-badge.status-active {
  background: #28a745;
  color: white;
}

.status-badge.status-completed {
  background: #6c757d;
  color: white;
}

/* Expense Hover Preview */
.expense-preview {
  position: fixed;
  background: #1e1e1e;
  border: 2px solid #444;
  border-radius: 8px;
  padding: 0;
  z-index: 999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  max-width: 250px;
  min-width: 200px;
  pointer-events: none;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #444;
  background: #2a2a2a;
  border-radius: 6px 6px 0 0;
}

.preview-date {
  color: #b0b0b0;
  font-size: 12px;
  font-weight: 500;
}

.preview-total {
  color: #e0e0e0;
  font-weight: 600;
  font-size: 14px;
}

.preview-expenses {
  padding: 8px;
}

.preview-expense {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
}

.preview-expense:not(:last-child) {
  border-bottom: 1px solid #333;
}

.preview-amount {
  color: #ff6347;
  font-weight: 600;
  min-width: 50px;
}

.preview-location {
  color: #b0b0b0;
  text-align: right;
  flex: 1;
  margin-left: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-more {
  color: #888;
  font-size: 11px;
  text-align: center;
  padding: 4px 0 2px 0;
  font-style: italic;
}

/* Day Expenses Modal */
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
}

.modal-header h4 {
  margin: 0;
  color: #e0e0e0;
  font-size: 18px;
}

.close-modal {
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
}

.close-modal:hover {
  background: #444;
  color: #e0e0e0;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.no-expenses {
  text-align: center;
  color: #888;
  padding: 40px 20px;
}

.expense-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 8px;
}

.summary-label {
  color: #b0b0b0;
  font-weight: 500;
}

.summary-amount {
  color: #e0e0e0;
  font-weight: 600;
  font-size: 18px;
}

.summary-count {
  color: #888;
  font-size: 14px;
}

.expense-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.expense-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.expense-item:hover {
  background: #333;
}

.expense-main {
  flex: 1;
}

.expense-amount {
  color: #ff6347;
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 2px;
}

.expense-location {
  color: #b0b0b0;
  font-size: 14px;
}

.expense-time {
  color: #888;
  font-size: 12px;
  text-align: right;
}

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
@media (max-width: 768px) {
  .calendar-page {
    padding: 16px;
  }
  
  .calendar-container {
    padding: 16px;
  }
  
  .calendar-header {
    padding: 0 10px;
  }
  
  .month-title {
    font-size: 20px;
  }
  
  .calendar-day {
    min-height: 80px;
    padding: 6px;
  }
  
  .period-tooltip {
    position: fixed;
    left: 10px !important;
    right: 10px !important;
    top: 50% !important;
    transform: translateY(-50%);
    max-width: none;
    min-width: 0;
  }
  
  .calendar-legend {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .legend-items {
    flex-wrap: wrap;
  }
  
  .period-label {
    display: none;
  }
  
  .expense-info {
    display: none;
  }
}
</style>