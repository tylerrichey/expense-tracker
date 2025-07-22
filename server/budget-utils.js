/**
 * Budget period generation and management utilities
 */

/**
 * Calculate the start date for a budget period based on current date and target weekday
 * @param {number} targetWeekday - Target weekday (0=Sunday, 1=Monday, etc.)
 * @param {number} durationDays - Duration of the budget period
 * @param {Date} fromDate - Date to calculate from (defaults to today)
 * @returns {Date} The calculated start date
 */
export function calculateBudgetPeriodStart(targetWeekday, durationDays, fromDate = new Date()) {
  const currentDate = new Date(fromDate)
  const currentWeekday = currentDate.getDay()
  
  // Calculate how many days to go back to reach the target weekday
  let daysBack = (currentWeekday - targetWeekday + 7) % 7
  
  // If we're on the target weekday, check if we should use this week or last week
  if (daysBack === 0) {
    // If it's the same day, we need to determine which period we're in
    // For now, assume we want the current period (this week)
    // This logic can be refined based on time of day or other factors
    daysBack = 0
  }
  
  const startDate = new Date(currentDate)
  startDate.setDate(currentDate.getDate() - daysBack)
  startDate.setHours(0, 0, 0, 0) // Start of day
  
  return startDate
}

/**
 * Calculate the end date for a budget period
 * @param {Date} startDate - Start date of the period
 * @param {number} durationDays - Duration in days
 * @returns {Date} The calculated end date
 */
export function calculateBudgetPeriodEnd(startDate, durationDays) {
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + durationDays - 1)
  endDate.setHours(23, 59, 59, 999) // End of day
  return endDate
}

/**
 * Generate budget periods for a given budget configuration
 * @param {Object} budget - Budget configuration
 * @param {Date} fromDate - Start generating from this date
 * @param {number} periodCount - Number of periods to generate
 * @returns {Array} Array of budget period objects
 */
export function generateBudgetPeriods(budget, fromDate = new Date(), periodCount = 1) {
  const periods = []
  let currentStart = calculateBudgetPeriodStart(budget.start_weekday, budget.duration_days, fromDate)
  
  for (let i = 0; i < periodCount; i++) {
    const endDate = calculateBudgetPeriodEnd(currentStart, budget.duration_days)
    
    const period = {
      budget_id: budget.id,
      start_date: currentStart.toISOString().split('T')[0], // YYYY-MM-DD format
      end_date: endDate.toISOString().split('T')[0],
      target_amount: budget.amount,
      status: i === 0 ? 'active' : 'upcoming'
    }
    
    periods.push(period)
    
    // Calculate next period start
    currentStart = new Date(currentStart)
    currentStart.setDate(currentStart.getDate() + budget.duration_days)
  }
  
  return periods
}

/**
 * Check if a date falls within a budget period
 * @param {Date} date - Date to check
 * @param {Object} period - Budget period object with start_date and end_date
 * @returns {boolean} True if date is within the period
 */
export function isDateInPeriod(date, period) {
  const checkDate = new Date(date)
  const startDate = new Date(period.start_date)
  const endDate = new Date(period.end_date)
  
  // Set times for proper comparison
  checkDate.setHours(12, 0, 0, 0) // Noon to avoid timezone issues
  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)
  
  return checkDate >= startDate && checkDate <= endDate
}

/**
 * Find the budget period that contains a specific date
 * @param {Date} date - Date to find period for
 * @param {Array} periods - Array of budget periods
 * @returns {Object|null} The matching period or null
 */
export function findPeriodForDate(date, periods) {
  return periods.find(period => isDateInPeriod(date, period)) || null
}

/**
 * Update budget period statuses based on current date
 * @param {Array} periods - Array of budget periods
 * @param {Date} currentDate - Current date (defaults to now)
 * @returns {Array} Updated periods with correct statuses
 */
export function updatePeriodStatuses(periods, currentDate = new Date()) {
  const now = new Date(currentDate)
  now.setHours(12, 0, 0, 0) // Noon for consistent comparison
  
  return periods.map(period => {
    const startDate = new Date(period.start_date + 'T00:00:00')
    const endDate = new Date(period.end_date + 'T23:59:59')
    
    let status
    if (now < startDate) {
      status = 'upcoming'
    } else if (now >= startDate && now <= endDate) {
      status = 'active'
    } else {
      status = 'completed'
    }
    
    return { ...period, status }
  })
}

/**
 * Check if a new budget period would overlap with existing periods
 * @param {Object} newPeriod - New period to check
 * @param {Array} existingPeriods - Array of existing periods
 * @returns {boolean} True if there's an overlap
 */
export function checkPeriodOverlap(newPeriod, existingPeriods) {
  const newStart = new Date(newPeriod.start_date)
  const newEnd = new Date(newPeriod.end_date)
  
  return existingPeriods.some(period => {
    const existingStart = new Date(period.start_date)
    const existingEnd = new Date(period.end_date)
    
    // Check for any overlap
    return (newStart <= existingEnd && newEnd >= existingStart)
  })
}

/**
 * Generate a budget period that covers a specific date (retroactive creation)
 * @param {Object} budget - Budget configuration
 * @param {Date} targetDate - Date that should be covered by the period
 * @returns {Object} Budget period object
 */
export function generateRetroactivePeriod(budget, targetDate = new Date()) {
  const startDate = calculateBudgetPeriodStart(budget.start_weekday, budget.duration_days, targetDate)
  const endDate = calculateBudgetPeriodEnd(startDate, budget.duration_days)
  const now = new Date()
  
  // Determine status based on current date
  let status = 'completed'
  if (now >= startDate && now <= endDate) {
    status = 'active'
  } else if (now < startDate) {
    status = 'upcoming'
  }
  
  return {
    budget_id: budget.id,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    target_amount: budget.amount,
    status: status
  }
}

/**
 * Calculate the next period start date after a given period
 * @param {Object} period - Current period
 * @param {number} durationDays - Duration in days
 * @returns {Date} Next period start date
 */
export function calculateNextPeriodStart(period, durationDays) {
  const currentStart = new Date(period.start_date)
  const nextStart = new Date(currentStart)
  nextStart.setDate(currentStart.getDate() + durationDays)
  return nextStart
}

/**
 * Format a date for database storage (YYYY-MM-DD)
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateForDB(date) {
  return date.toISOString().split('T')[0]
}

/**
 * Get week name from weekday number
 * @param {number} weekday - Weekday number (0=Sunday, 1=Monday, etc.)
 * @returns {string} Week name
 */
export function getWeekdayName(weekday) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[weekday] || 'Invalid'
}

/**
 * Validate budget configuration
 * @param {Object} budget - Budget to validate
 * @returns {Object} Validation result with isValid and errors
 */
export function validateBudget(budget) {
  const errors = []
  
  if (!budget.name || budget.name.trim().length === 0) {
    errors.push('Budget name is required')
  }
  
  if (!budget.amount || budget.amount <= 0) {
    errors.push('Budget amount must be greater than 0')
  }
  
  if (budget.start_weekday < 0 || budget.start_weekday > 6) {
    errors.push('Start weekday must be between 0 (Sunday) and 6 (Saturday)')
  }
  
  if (budget.duration_days < 7 || budget.duration_days > 28) {
    errors.push('Duration must be between 7 and 28 days')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}