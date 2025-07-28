/**
 * Timezone-aware utility functions for budget calculations
 * Replaces UTC-based calculations with timezone-aware ones
 */

/**
 * Get the current timezone setting from database
 * @param {Object} db - Database instance
 * @returns {string} Timezone identifier (e.g., 'America/New_York', 'UTC')
 */
export function getCurrentTimezone(db) {
  try {
    const stmt = db.prepare('SELECT value FROM user_settings WHERE key = ?')
    const result = stmt.get('timezone')
    return result ? result.value : 'UTC'
  } catch (err) {
    console.warn('Failed to get timezone setting, defaulting to UTC:', err.message)
    return 'UTC'
  }
}

/**
 * Create a date in a specific timezone at start of day (00:00:00)
 * @param {Date|string} date - Date to convert
 * @param {string} timezone - Target timezone
 * @returns {Date} Date at start of day in the specified timezone
 */
export function createStartOfDayInTimezone(date, timezone = 'UTC') {
  const inputDate = new Date(date)
  
  if (timezone === 'UTC') {
    const utcDate = new Date(inputDate.toISOString().split('T')[0] + 'T00:00:00.000Z')
    return utcDate
  }
  
  try {
    // Create date string in YYYY-MM-DD format
    const dateStr = inputDate.toISOString().split('T')[0]
    
    // Use Intl.DateTimeFormat to get the correct date in the timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    const parts = formatter.formatToParts(inputDate)
    const year = parts.find(p => p.type === 'year').value
    const month = parts.find(p => p.type === 'month').value
    const day = parts.find(p => p.type === 'day').value
    
    // Create a date string that represents midnight in the target timezone
    const timezoneDate = new Date(`${year}-${month}-${day}T00:00:00`)
    
    // Convert to UTC by adjusting for timezone offset
    const tempDate = new Date(timezoneDate.toLocaleString('sv-SE', { timeZone: timezone }))
    const utcDate = new Date(tempDate.getTime() - (tempDate.getTimezoneOffset() * 60000))
    
    return utcDate
  } catch (err) {
    console.warn(`Failed to create start of day in timezone ${timezone}, falling back to UTC:`, err.message)
    return createStartOfDayInTimezone(date, 'UTC')
  }
}

/**
 * Create a date in a specific timezone at end of day (23:59:59.999)
 * @param {Date|string} date - Date to convert
 * @param {string} timezone - Target timezone
 * @returns {Date} Date at end of day in the specified timezone
 */
export function createEndOfDayInTimezone(date, timezone = 'UTC') {
  const startOfDay = createStartOfDayInTimezone(date, timezone)
  
  if (timezone === 'UTC') {
    startOfDay.setUTCHours(23, 59, 59, 999)
    return startOfDay
  }
  
  try {
    // Add almost 24 hours to get end of day
    const endOfDay = new Date(startOfDay.getTime() + (24 * 60 * 60 * 1000) - 1)
    return endOfDay
  } catch (err) {
    console.warn(`Failed to create end of day in timezone ${timezone}, falling back to UTC:`, err.message)
    return createEndOfDayInTimezone(date, 'UTC')
  }
}

/**
 * Get current date and time in a specific timezone
 * @param {string} timezone - Target timezone
 * @returns {Date} Current date/time adjusted for timezone
 */
export function getCurrentDateInTimezone(timezone = 'UTC') {
  const now = new Date()
  
  if (timezone === 'UTC') {
    return now
  }
  
  try {
    // Get the current time in the specified timezone
    const timeInTimezone = new Date(now.toLocaleString('sv-SE', { timeZone: timezone }))
    return timeInTimezone
  } catch (err) {
    console.warn(`Failed to get current date in timezone ${timezone}, falling back to UTC:`, err.message)
    return now
  }
}

/**
 * Check if a date falls within a period, timezone-aware
 * @param {Date|string} date - Date to check
 * @param {Object} period - Budget period with start_date and end_date
 * @param {string} timezone - Timezone for comparison
 * @returns {boolean} True if date is within the period
 */
export function isDateInPeriodTimezoneAware(date, period, timezone = 'UTC') {
  const checkDate = new Date(date)
  const startDate = createStartOfDayInTimezone(period.start_date, timezone)
  const endDate = createEndOfDayInTimezone(period.end_date, timezone)
  
  console.log('🔍 EXPENSE DEBUG: isDateInPeriodTimezoneAware detailed:', {
    checkDate: checkDate.toISOString(),
    periodStart: period.start_date,
    periodEnd: period.end_date,
    timezone: timezone,
    startDateCalculated: startDate.toISOString(),
    endDateCalculated: endDate.toISOString(),
    result: checkDate >= startDate && checkDate <= endDate
  })
  
  return checkDate >= startDate && checkDate <= endDate
}

/**
 * Calculate budget period end date in timezone
 * @param {Date|string} startDate - Start date of the period
 * @param {number} durationDays - Duration in days
 * @param {string} timezone - Target timezone
 * @returns {Date} End date in the specified timezone
 */
export function calculateBudgetPeriodEndInTimezone(startDate, durationDays, timezone = 'UTC') {
  const start = createStartOfDayInTimezone(startDate, timezone)
  const endDate = new Date(start.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000)
  return createEndOfDayInTimezone(endDate, timezone)
}

/**
 * Calculate budget period start based on weekday and timezone
 * @param {number} targetWeekday - Target weekday (0=Sunday, 1=Monday, etc.)
 * @param {number} durationDays - Duration of the budget period
 * @param {Date} fromDate - Date to calculate from
 * @param {string} timezone - Target timezone
 * @returns {Date} The calculated start date
 */
export function calculateBudgetPeriodStartInTimezone(targetWeekday, durationDays, fromDate = new Date(), timezone = 'UTC') {
  // Get the current date in the target timezone
  const currentDate = timezone === 'UTC' ? new Date(fromDate) : getCurrentDateInTimezone(timezone)
  
  // Use the same logic as the original function but with timezone-aware date
  const currentWeekday = currentDate.getDay()
  let daysBack = (currentWeekday - targetWeekday + 7) % 7
  
  if (daysBack === 0) {
    daysBack = 0
  }
  
  const startDate = new Date(currentDate)
  startDate.setDate(currentDate.getDate() - daysBack)
  
  return createStartOfDayInTimezone(startDate, timezone)
}

/**
 * Update period statuses based on current date in timezone
 * @param {Array} periods - Array of budget periods
 * @param {string} timezone - Target timezone
 * @param {Date} currentDate - Current date (optional, defaults to now)
 * @returns {Array} Updated periods with correct statuses
 */
export function updatePeriodStatusesInTimezone(periods, timezone = 'UTC', currentDate = null) {
  const now = currentDate ? new Date(currentDate) : getCurrentDateInTimezone(timezone)
  
  return periods.map(period => {
    const isInPeriod = isDateInPeriodTimezoneAware(now, period, timezone)
    const startDate = createStartOfDayInTimezone(period.start_date, timezone)
    
    let status
    if (now < startDate) {
      status = 'upcoming'
    } else if (isInPeriod) {
      status = 'active'
    } else {
      status = 'completed'
    }
    
    return { ...period, status }
  })
}

/**
 * Format date for database storage (YYYY-MM-DD) in timezone
 * @param {Date} date - Date to format
 * @param {string} timezone - Target timezone
 * @returns {string} Formatted date string
 */
export function formatDateForDBInTimezone(date, timezone = 'UTC') {
  if (timezone === 'UTC') {
    return date.toISOString().split('T')[0]
  }
  
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    
    return formatter.format(date)
  } catch (err) {
    console.warn(`Failed to format date in timezone ${timezone}, falling back to UTC:`, err.message)
    return date.toISOString().split('T')[0]
  }
}

/**
 * Get a list of common timezones for UI selection
 * @returns {Array} Array of timezone objects with label and value
 */
export function getCommonTimezones() {
  return [
    { label: 'UTC', value: 'UTC' },
    { label: 'Eastern Time (US)', value: 'America/New_York' },
    { label: 'Central Time (US)', value: 'America/Chicago' },
    { label: 'Mountain Time (US)', value: 'America/Denver' },
    { label: 'Pacific Time (US)', value: 'America/Los_Angeles' },
    { label: 'Alaska Time (US)', value: 'America/Anchorage' },
    { label: 'Hawaii Time (US)', value: 'Pacific/Honolulu' },
    { label: 'London (GMT/BST)', value: 'Europe/London' },
    { label: 'Paris (CET/CEST)', value: 'Europe/Paris' },
    { label: 'Berlin (CET/CEST)', value: 'Europe/Berlin' },
    { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
    { label: 'Sydney (AEDT/AEST)', value: 'Australia/Sydney' },
    { label: 'Mumbai (IST)', value: 'Asia/Kolkata' },
    { label: 'Dubai (GST)', value: 'Asia/Dubai' },
    { label: 'Singapore (SGT)', value: 'Asia/Singapore' },
    { label: 'Hong Kong (HKT)', value: 'Asia/Hong_Kong' },
    { label: 'Toronto (EST/EDT)', value: 'America/Toronto' },
    { label: 'Vancouver (PST/PDT)', value: 'America/Vancouver' },
    { label: 'Mexico City (CST/CDT)', value: 'America/Mexico_City' },
    { label: 'São Paulo (BRT)', value: 'America/Sao_Paulo' }
  ]
}

/**
 * Validate timezone identifier
 * @param {string} timezone - Timezone to validate
 * @returns {boolean} True if timezone is valid
 */
export function isValidTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') {
    return false
  }
  
  if (timezone === 'UTC') {
    return true
  }
  
  try {
    // Try to create a date formatter with the timezone
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch (err) {
    return false
  }
}