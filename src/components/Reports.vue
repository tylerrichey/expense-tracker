<template>
  <div class="reports">
    <div class="report-section">
      <h4>Quick Stats</h4>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${{ totalSpent.toFixed(2) }}</div>
          <div class="stat-label">Total Spent (YTD)</div>
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
      <h4>Top Locations</h4>
      <div class="location-list">
        <div v-for="location in topLocations" :key="location.place_name" class="location-item">
          <div class="location-info">
            <div class="location-name">{{ location.place_name }}</div>
            <div class="location-count">{{ location.count }} visits</div>
          </div>
          <div class="location-amount">${{ location.total.toFixed(2) }}</div>
        </div>
      </div>
    </div>

    <div class="download-section">
      <button @click="downloadCSV" class="download-btn">
        📥 Download Full Dataset as CSV
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { databaseService } from '../services/database'

interface LocationStat {
  place_name: string
  total: number
  count: number
}

const expenses = ref<any[]>([])
const topLocations = ref<LocationStat[]>([])

const totalSpent = computed(() => {
  const currentYear = new Date().getFullYear()
  return expenses.value
    .filter(expense => new Date(expense.timestamp).getFullYear() === currentYear)
    .reduce((sum, expense) => sum + expense.amount, 0)
})

const totalExpenses = computed(() => {
  const currentYear = new Date().getFullYear()
  return expenses.value
    .filter(expense => new Date(expense.timestamp).getFullYear() === currentYear)
    .length
})

const averageExpense = computed(() => {
  return totalExpenses.value > 0 ? totalSpent.value / totalExpenses.value : 0
})

const dailyAverage = computed(() => {
  if (expenses.value.length === 0) return 0
  
  // Find the earliest and latest dates in the full dataset
  const dates = expenses.value.map(expense => new Date(expense.timestamp).getTime())
  const earliestDate = new Date(Math.min(...dates))
  const latestDate = new Date(Math.max(...dates))
  
  // Calculate days between first and last expense (inclusive)
  const daysBetween = Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // Calculate total for all expenses (not just current year)
  const allTimeTotal = expenses.value.reduce((sum, expense) => sum + expense.amount, 0)
  
  return daysBetween > 0 ? allTimeTotal / daysBetween : 0
})

async function loadReports() {
  try {
    // Load all expenses
    const allExpenses = await databaseService.getAllExpenses()
    expenses.value = allExpenses

    // Calculate top locations
    calculateTopLocations()
  } catch (error) {
    console.error('Error loading reports:', error)
  }
}

function calculateTopLocations() {
  const currentYear = new Date().getFullYear()
  const locationMap = new Map<string, LocationStat>()
  
  expenses.value
    .filter(expense => new Date(expense.timestamp).getFullYear() === currentYear)
    .forEach(expense => {
      if (expense.place_name) {
        const key = expense.place_name
        if (locationMap.has(key)) {
          const existing = locationMap.get(key)!
          existing.total += expense.amount
          existing.count += 1
        } else {
          locationMap.set(key, {
            place_name: expense.place_name,
            total: expense.amount,
            count: 1
          })
        }
      }
    })

  // Sort by number of visits and take top 5
  topLocations.value = Array.from(locationMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

function downloadCSV() {
  if (expenses.value.length === 0) {
    alert('No data available to download')
    return
  }

  // CSV headers
  const headers = ['Date', 'Amount', 'Location', 'Address', 'Latitude', 'Longitude']
  
  // Convert expenses to CSV rows
  const csvRows = expenses.value.map(expense => {
    const date = new Date(expense.timestamp).toLocaleDateString()
    const amount = expense.amount.toFixed(2)
    const location = expense.place_name || ''
    const address = expense.place_address || ''
    const latitude = expense.latitude || ''
    const longitude = expense.longitude || ''
    
    // Escape CSV values that contain commas or quotes
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }
    
    return [date, amount, escapeCSV(location), escapeCSV(address), latitude, longitude].join(',')
  })
  
  // Combine headers and rows
  const csvContent = [headers.join(','), ...csvRows].join('\n')
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    
    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0]
    link.setAttribute('download', `expenses_${today}.csv`)
    
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.reports {
  width: 100%;
}


.download-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #333;
  text-align: center;
}

.download-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
  justify-content: center;
}

.download-btn:hover {
  background: #218838;
}

.download-btn:active {
  background: #1e7e34;
}

.report-section {
  margin-bottom: 30px;
}

.report-section h4 {
  margin-bottom: 15px;
  color: #b0b0b0;
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
  background: #1e1e1e;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #333;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #888;
}

.location-list {
  background: #1e1e1e;
  border-radius: 8px;
  border: 1px solid #333;
  overflow: hidden;
}

.location-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #2a2a2a;
}

.location-item:last-child {
  border-bottom: none;
}

.location-info {
  flex: 1;
}

.location-name {
  font-weight: 500;
  color: #e0e0e0;
}

.location-amount {
  font-weight: bold;
  color: #007bff;
  font-size: 16px;
}

.location-count {
  font-size: 12px;
  color: #888;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .download-btn {
    width: 100%;
    padding: 14px 20px;
    font-size: 16px;
  }
  
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
  
  .location-item {
    padding: 12px 16px;
  }
  
  .location-amount {
    font-size: 14px;
  }
}
</style>