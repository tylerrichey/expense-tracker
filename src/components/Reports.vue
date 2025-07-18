<template>
  <div class="reports">
    <h3>Expense Reports</h3>
    
    <div class="report-section">
      <h4>Quick Stats</h4>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${{ totalSpent.toFixed(2) }}</div>
          <div class="stat-label">Total Spent (60 days)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ totalExpenses }}</div>
          <div class="stat-label">Total Expenses</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${{ averageExpense.toFixed(2) }}</div>
          <div class="stat-label">Average Expense</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${{ dailyAverage.toFixed(2) }}</div>
          <div class="stat-label">Daily Average</div>
        </div>
      </div>
    </div>

    <div class="report-section">
      <h4>Time Period Reports</h4>
      <div class="time-reports">
        <div class="time-report-card">
          <h5>Last 7 Days</h5>
          <p class="amount">${{ weeklyTotal.toFixed(2) }}</p>
          <p class="count">{{ weeklyCount }} expenses</p>
        </div>
        <div class="time-report-card">
          <h5>Current Month</h5>
          <p class="amount">${{ monthlyTotal.toFixed(2) }}</p>
          <p class="count">{{ monthlyCount }} expenses</p>
        </div>
        <div class="time-report-card">
          <h5>Last 30 Days</h5>
          <p class="amount">${{ last30DaysTotal.toFixed(2) }}</p>
          <p class="count">{{ last30DaysCount }} expenses</p>
        </div>
      </div>
    </div>

    <div class="report-section">
      <h4>Top Locations</h4>
      <div class="location-list">
        <div v-for="location in topLocations" :key="location.place_name" class="location-item">
          <div class="location-info">
            <div class="location-name">{{ location.place_name }}</div>
            <div class="location-address">{{ location.place_address }}</div>
          </div>
          <div class="location-stats">
            <div class="location-amount">${{ location.total.toFixed(2) }}</div>
            <div class="location-count">{{ location.count }} visits</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { databaseService } from '../services/database'

interface LocationStat {
  place_name: string
  place_address: string
  total: number
  count: number
}

const expenses = ref<any[]>([])
const weeklyTotal = ref(0)
const weeklyCount = ref(0)
const monthlyTotal = ref(0)
const monthlyCount = ref(0)
const last30DaysTotal = ref(0)
const last30DaysCount = ref(0)
const topLocations = ref<LocationStat[]>([])

const totalSpent = computed(() => {
  return expenses.value.reduce((sum, expense) => sum + expense.amount, 0)
})

const totalExpenses = computed(() => {
  return expenses.value.length
})

const averageExpense = computed(() => {
  return totalExpenses.value > 0 ? totalSpent.value / totalExpenses.value : 0
})

const dailyAverage = computed(() => {
  return totalSpent.value / 60 // 60 days of data
})

async function loadReports() {
  try {
    // Load all expenses
    const allExpenses = await databaseService.getAllExpenses()
    expenses.value = allExpenses

    // Load weekly summary
    const weeklySummary = await databaseService.getExpenseSummary(7)
    weeklyTotal.value = weeklySummary.total
    weeklyCount.value = weeklySummary.count

    // Load monthly summary
    const monthlySummary = await databaseService.getCurrentMonthSummary()
    monthlyTotal.value = monthlySummary.total
    monthlyCount.value = monthlySummary.count

    // Load last 30 days summary
    const last30Summary = await databaseService.getExpenseSummary(30)
    last30DaysTotal.value = last30Summary.total
    last30DaysCount.value = last30Summary.count

    // Calculate top locations
    calculateTopLocations()
  } catch (error) {
    console.error('Error loading reports:', error)
  }
}

function calculateTopLocations() {
  const locationMap = new Map<string, LocationStat>()
  
  expenses.value.forEach(expense => {
    if (expense.place_name) {
      const key = expense.place_name
      if (locationMap.has(key)) {
        const existing = locationMap.get(key)!
        existing.total += expense.amount
        existing.count += 1
      } else {
        locationMap.set(key, {
          place_name: expense.place_name,
          place_address: expense.place_address || '',
          total: expense.amount,
          count: 1
        })
      }
    }
  })

  // Sort by total amount spent and take top 5
  topLocations.value = Array.from(locationMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
}

onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.reports {
  width: 100%;
}

.reports h3 {
  margin-bottom: 20px;
  color: #333;
  font-size: 24px;
}

.report-section {
  margin-bottom: 30px;
}

.report-section h4 {
  margin-bottom: 15px;
  color: #555;
  font-size: 18px;
  border-bottom: 2px solid #007bff;
  padding-bottom: 5px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.stat-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #e0e0e0;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.time-reports {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.time-report-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  text-align: center;
}

.time-report-card h5 {
  margin-bottom: 10px;
  color: #333;
  font-size: 16px;
}

.time-report-card .amount {
  font-size: 20px;
  font-weight: bold;
  color: #28a745;
  margin-bottom: 5px;
}

.time-report-card .count {
  font-size: 14px;
  color: #666;
}

.location-list {
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  overflow: hidden;
}

.location-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.location-item:last-child {
  border-bottom: none;
}

.location-info {
  flex: 1;
}

.location-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 5px;
}

.location-address {
  font-size: 14px;
  color: #666;
}

.location-stats {
  text-align: right;
}

.location-amount {
  font-weight: bold;
  color: #007bff;
  margin-bottom: 3px;
}

.location-count {
  font-size: 12px;
  color: #666;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  
  .stat-card {
    padding: 15px;
  }
  
  .stat-value {
    font-size: 20px;
  }
  
  .time-reports {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  
  .location-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .location-stats {
    text-align: left;
    width: 100%;
  }
}
</style>