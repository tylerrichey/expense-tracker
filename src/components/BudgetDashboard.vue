<template>
  <div class="budget-dashboard">
    <!-- No Active Budget State -->
    <div v-if="!currentBudget && !loading" class="no-budget">
      <div class="no-budget-content">
        <h2>No Active Budget</h2>
        <p>Create your first budget to start tracking your expenses with targets and insights.</p>
        <button @click="$emit('create-budget')" class="create-budget-btn">
          Create Budget
        </button>
      </div>
    </div>

    <!-- Active Budget Display -->
    <div v-else-if="currentBudget && !loading" class="active-budget">
      <!-- Budget Header -->
      <div class="budget-header">
        <div class="budget-info">
          <h2>{{ currentBudget.name }}</h2>
          <p class="budget-period" v-if="currentPeriod">
            {{ formatDate(currentPeriod.start_date) }} - {{ formatDate(currentPeriod.end_date) }}
          </p>
        </div>
        <div class="budget-actions">
          <button @click="$emit('manage-budget')" class="manage-btn">
            Manage
          </button>
        </div>
      </div>

      <!-- Progress Circle -->
      <div class="progress-section">
        <div class="progress-circle-container">
          <div class="progress-circle">
            <svg class="circle-svg" viewBox="0 0 100 100">
              <circle
                class="circle-background"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#e9ecef"
                stroke-width="8"
              />
              <circle
                class="circle-progress"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                :stroke="progressColor"
                stroke-width="8"
                stroke-linecap="round"
                :stroke-dasharray="`${progressPercentage * 2.827}, 282.7`"
                :class="{ 'over-budget': isOverBudget }"
              />
            </svg>
            <div class="circle-content">
              <div class="spent-amount">${{ formatAmount(currentSpent) }}</div>
              <div class="total-amount">of ${{ formatAmount(targetAmount) }}</div>
              <div class="percentage">{{ Math.round(progressPercentage) }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Budget Stats -->
      <div class="budget-stats">
        <div class="stat-card">
          <div class="stat-value">${{ formatAmount(Math.abs(remaining)) }}</div>
          <div class="stat-label" :class="{ 'over-budget': remaining < 0 }">{{ remaining >= 0 ? 'Remaining' : 'Over Budget' }}</div>
        </div>
        
        <div class="stat-card" v-if="currentPeriod">
          <div class="stat-value">{{ daysRemaining }}</div>
          <div class="stat-label">{{ daysRemaining === 1 ? 'Day Left' : 'Days Left' }}</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${{ formatAmount(dailyAverage) }}</div>
          <div class="stat-label">Daily Average</div>
        </div>
        
        <div class="stat-card" v-if="projectedTotal !== null">
          <div class="stat-value">${{ formatAmount(projectedTotal) }}</div>
          <div class="stat-label">Projected Total</div>
        </div>
      </div>

      <!-- Quick Insights -->
      <div class="insights-section" v-if="insights.length > 0">
        <h3>Insights</h3>
        <div class="insights-list">
          <div 
            v-for="insight in insights" 
            :key="insight.id"
            class="insight-item"
            :class="insight.type"
          >
            <div class="insight-icon">{{ insight.icon }}</div>
            <div class="insight-text">{{ insight.message }}</div>
          </div>
        </div>
      </div>

      <!-- Vacation Mode Toggle -->
      <div class="vacation-mode" v-if="currentBudget">
        <label class="vacation-toggle">
          <input 
            type="checkbox" 
            :checked="currentBudget.vacation_mode"
            @change="toggleVacationMode"
            :disabled="updating"
          />
          <span class="toggle-slider"></span>
          <span class="toggle-label">Vacation Mode</span>
        </label>
        <p class="vacation-help">Temporarily pause budget tracking</p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else class="loading">
      <div class="loading-spinner"></div>
      <p>Loading budget...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  currentBudget: {
    type: Object,
    default: null
  },
  currentPeriod: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['create-budget', 'manage-budget', 'vacation-mode-toggle'])

// Local state
const updating = ref(false)

// Computed properties
const currentSpent = computed(() => {
  return props.currentPeriod?.actual_spent || 0
})

const targetAmount = computed(() => {
  return props.currentPeriod?.target_amount || props.currentBudget?.amount || 0
})

const remaining = computed(() => {
  return targetAmount.value - currentSpent.value
})

const progressPercentage = computed(() => {
  if (targetAmount.value === 0) return 0
  return Math.min((currentSpent.value / targetAmount.value) * 100, 100)
})

const isOverBudget = computed(() => {
  return currentSpent.value > targetAmount.value
})

const progressColor = computed(() => {
  if (isOverBudget.value) return '#dc3545'
  if (progressPercentage.value > 80) return '#fd7e14'
  if (progressPercentage.value > 60) return '#ffc107'
  return '#28a745'
})

const daysRemaining = computed(() => {
  if (!props.currentPeriod) return 0
  
  const today = new Date()
  const endDate = new Date(props.currentPeriod.end_date + 'T23:59:59')
  const diffTime = endDate - today
  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  
  return diffDays
})

const dailyAverage = computed(() => {
  if (!props.currentPeriod) return 0
  
  const startDate = new Date(props.currentPeriod.start_date)
  const today = new Date()
  const daysPassed = Math.max(1, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)))
  
  return currentSpent.value / daysPassed
})

const projectedTotal = computed(() => {
  if (!props.currentPeriod) return null
  
  const totalDays = props.currentBudget?.duration_days || 7
  
  // Use the same daysPassed calculation as dailyAverage for consistency
  const startDate = new Date(props.currentPeriod.start_date)
  const today = new Date()
  const daysPassed = Math.max(1, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)))
  
  if (daysPassed <= 0) return currentSpent.value
  
  return (currentSpent.value / daysPassed) * totalDays
})

const insights = computed(() => {
  const insights = []
  
  if (isOverBudget.value) {
    insights.push({
      id: 'over-budget',
      type: 'warning',
      icon: '⚠️',
      message: `You're $${formatAmount(Math.abs(remaining.value))} over budget`
    })
  } else if (progressPercentage.value > 80) {
    insights.push({
      id: 'almost-over',
      type: 'warning',
      icon: '⚡',
      message: `You're at ${Math.round(progressPercentage.value)}% of your budget`
    })
  }
  
  if (projectedTotal.value && projectedTotal.value > targetAmount.value * 1.1) {
    insights.push({
      id: 'projected-over',
      type: 'info',
      icon: '📈',
      message: `At current pace, you'll spend $${formatAmount(projectedTotal.value)}`
    })
  }
  
  if (dailyAverage.value > 0 && remaining.value > 0) {
    const suggestedDaily = remaining.value / Math.max(1, daysRemaining.value)
    if (dailyAverage.value > suggestedDaily * 1.5) {
      insights.push({
        id: 'slow-down',
        type: 'tip',
        icon: '💡',
        message: `Try spending under $${formatAmount(suggestedDaily)} daily to stay on track`
      })
    }
  }
  
  return insights.slice(0, 3) // Limit to 3 insights
})

// Methods
function formatAmount(amount) {
  return typeof amount === 'number' ? amount.toFixed(2) : '0.00'
}

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

async function toggleVacationMode() {
  if (!props.currentBudget || updating.value) return
  
  updating.value = true
  try {
    await emit('vacation-mode-toggle', !props.currentBudget.vacation_mode)
  } catch (err) {
    console.error('Failed to toggle vacation mode:', err)
  } finally {
    updating.value = false
  }
}
</script>

<style scoped>
.budget-dashboard {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

/* No Budget State */
.no-budget {
  text-align: center;
  padding: 60px 20px;
}

.no-budget-content h2 {
  color: #e0e0e0;
  margin-bottom: 12px;
}

.no-budget-content p {
  color: #868e96;
  margin-bottom: 24px;
  line-height: 1.5;
}

.create-budget-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.create-budget-btn:hover {
  background: #0056b3;
}

/* Active Budget */
.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.budget-info h2 {
  margin: 0 0 4px 0;
  color: #e0e0e0;
}

.budget-period {
  margin: 0;
  color: #b0b0b0;
  font-size: 14px;
}

.manage-btn {
  background: #2a2a2a;
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.manage-btn:hover {
  background: #3a3a3a;
  border-color: #007bff;
  color: #007bff;
}

/* Progress Circle */
.progress-section {
  margin-bottom: 32px;
}

.progress-circle-container {
  display: flex;
  justify-content: center;
}

.progress-circle {
  position: relative;
  width: 200px;
  height: 200px;
}

.circle-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.circle-progress {
  transition: stroke-dasharray 0.3s ease;
}

.circle-progress.over-budget {
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0%, 100% { stroke: #dc3545; }
  50% { stroke: #ff6b7a; }
}

.circle-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.spent-amount {
  font-size: 24px;
  font-weight: 600;
  color: #e0e0e0;
}

.total-amount {
  font-size: 14px;
  color: #b0b0b0;
  margin-bottom: 4px;
}

.percentage {
  font-size: 16px;
  font-weight: 500;
  color: #007bff;
}

/* Budget Stats */
.budget-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  transition: box-shadow 0.2s;
}

.stat-card:hover {
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #007bff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #b0b0b0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-label.over-budget {
  color: #dc3545;
  font-weight: bold;
}

/* Insights */
.insights-section {
  margin-bottom: 32px;
}

.insights-section h3 {
  margin: 0 0 16px 0;
  color: #e0e0e0;
  font-size: 18px;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.insight-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
}

.insight-item.warning {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
}

.insight-item.info {
  background: #d1ecf1;
  border: 1px solid #bee5eb;
  color: #0c5460;
}

.insight-item.tip {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.insight-icon {
  margin-right: 12px;
  font-size: 16px;
}

/* Vacation Mode */
.vacation-mode {
  padding: 16px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  margin-bottom: 24px;
}

.vacation-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 8px;
}

.vacation-toggle input {
  display: none;
}

.toggle-slider {
  width: 40px;
  height: 20px;
  background: #ccc;
  border-radius: 20px;
  position: relative;
  margin-right: 12px;
  transition: background 0.3s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.3s;
}

.vacation-toggle input:checked + .toggle-slider {
  background: #007bff;
}

.vacation-toggle input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-label {
  font-weight: 500;
  color: #e0e0e0;
}

.vacation-help {
  margin: 0;
  font-size: 12px;
  color: #b0b0b0;
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
  color: #6c757d;
  margin: 0;
}

/* Responsive */
@media (max-width: 600px) {
  .budget-dashboard {
    padding: 16px;
  }
  
  .budget-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .manage-btn {
    margin-top: 8px;
  }
  
  .progress-circle {
    width: 160px;
    height: 160px;
  }
  
  .budget-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .insight-item {
    font-size: 13px;
  }
}
</style>