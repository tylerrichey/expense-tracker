/**
 * Budget period generation and management utilities
 */

import { 
  getCurrentTimezone,
  createStartOfDayInTimezone,
  createEndOfDayInTimezone,
  getCurrentDateInTimezone,
  isDateInPeriodTimezoneAware,
  calculateBudgetPeriodEndInTimezone,
  calculateBudgetPeriodStartInTimezone,
  updatePeriodStatusesInTimezone,
  formatDateForDBInTimezone
} from './timezone-utils.js'
import { debugLog } from './debug-utils.js'

// Database instance - will be injected by the calling code
let databaseInstance = null

/**
 * Set the database instance for timezone lookups
 * @param {Object} db - Database instance
 */
export function setDatabaseInstance(db) {
  databaseInstance = db
}

/**
 * Get timezone from database or default to UTC
 * @returns {string} Current timezone setting
 */
function getTimezone() {
  if (!databaseInstance) {
    debugLog('🔍 EXPENSE DEBUG: Database instance not set, using UTC timezone')
    return 'UTC'
  }
  const timezone = getCurrentTimezone(databaseInstance)
  debugLog('🔍 EXPENSE DEBUG: Got timezone from database:', timezone)
  return timezone
}

/**
 * Calculate the start date for a budget period based on current date and target weekday
 * @param {number} targetWeekday - Target weekday (0=Sunday, 1=Monday, etc.)
 * @param {number} durationDays - Duration of the budget period
 * @param {Date} fromDate - Date to calculate from (defaults to today)
 * @returns {Date} The calculated start date
 */
export function calculateBudgetPeriodStart(targetWeekday, durationDays, fromDate = new Date()) {
  const timezone = getTimezone()
  
  // For UTC timezone, use original logic for backward compatibility
  if (timezone === 'UTC') {
    const currentDate = new Date(fromDate)
    const currentWeekday = currentDate.getDay()
    
    // Calculate how many days to go back to reach the target weekday
    let daysBack = (currentWeekday - targetWeekday + 7) % 7
    
    // If we're on the target weekday, check if we should use this week or last week
    if (daysBack === 0) {
      daysBack = 0
    }
    
    const startDate = new Date(currentDate)
    startDate.setDate(currentDate.getDate() - daysBack)
    startDate.setHours(0, 0, 0, 0) // Start of day
    
    return startDate
  }
  
  return calculateBudgetPeriodStartInTimezone(targetWeekday, durationDays, fromDate, timezone)
}

/**
 * Calculate the end date for a budget period
 * @param {Date} startDate - Start date of the period
 * @param {number} durationDays - Duration in days
 * @returns {Date} The calculated end date
 */
export function calculateBudgetPeriodEnd(startDate, durationDays) {
  const timezone = getTimezone()
  
  // For UTC timezone, use original logic for backward compatibility
  if (timezone === 'UTC') {
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + durationDays - 1)
    endDate.setUTCHours(23, 59, 59, 999) // End of day in UTC
    return endDate
  }
  
  return calculateBudgetPeriodEndInTimezone(startDate, durationDays, timezone)
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

  // If fromDate is within the first calculated period, we might need to adjust.
  const firstEndDate = calculateBudgetPeriodEnd(currentStart, budget.duration_days);
  if (fromDate > firstEndDate) {
    // If fromDate is past the end of the first period, start the next period from there.
    currentStart.setDate(currentStart.getDate() + budget.duration_days);
  }

  for (let i = 0; i < periodCount; i++) {
    const endDate = calculateBudgetPeriodEnd(currentStart, budget.duration_days)
    
    const period = {
      budget_id: budget.id,
      start_date: formatDateForDB(currentStart),
      end_date: formatDateForDB(endDate),
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
  const timezone = getTimezone()
  
  debugLog('🔍 EXPENSE DEBUG: isDateInPeriod called:', {
    date: date.toISOString(),
    periodStart: period.start_date,
    periodEnd: period.end_date,
    timezone: timezone
  })
  
  // SIMPLIFIED APPROACH: Convert everything to dates and compare in local timezone context
  // This avoids the complex timezone conversion issues
  
  const checkDate = new Date(date)
  const startDate = new Date(period.start_date + 'T00:00:00.000Z')
  const endDate = new Date(period.end_date + 'T23:59:59.999Z')
  
  // For non-UTC timezones, we need to be more careful about the comparison
  // The issue is that the period dates are stored as date strings (YYYY-MM-DD)
  // but the expense date is a full timestamp
  
  let result
  if (timezone === 'UTC') {
    // For UTC, use the noon comparison to avoid edge cases
    checkDate.setUTCHours(12, 0, 0, 0)
    result = checkDate >= startDate && checkDate <= endDate
  } else {
    // For other timezones, compare the date parts in the target timezone
    const expenseDateInTimezone = checkDate.toLocaleDateString('en-CA', { timeZone: timezone })
    const periodStartDate = period.start_date
    const periodEndDate = period.end_date
    
    result = expenseDateInTimezone >= periodStartDate && expenseDateInTimezone <= periodEndDate
    
    debugLog('🔍 EXPENSE DEBUG: Timezone date comparison:', {
      expenseDateInTimezone: expenseDateInTimezone,
      periodStartDate: periodStartDate,
      periodEndDate: periodEndDate,
      result: result
    })
  }
  
  debugLog('🔍 EXPENSE DEBUG: Final comparison result:', {
    checkDate: checkDate.toISOString(),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    result: result
  })
  
  return result
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
  const timezone = getTimezone()
  
  // For UTC timezone, use original logic for backward compatibility
  if (timezone === 'UTC') {
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
  
  return updatePeriodStatusesInTimezone(periods, timezone, currentDate)
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
    start_date: formatDateForDB(startDate),
    end_date: formatDateForDB(endDate),
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
  const timezone = getTimezone()
  
  // For UTC timezone, use original logic for backward compatibility
  if (timezone === 'UTC') {
    return date.toISOString().split('T')[0]
  }
  
  return formatDateForDBInTimezone(date, timezone)
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