import type { BudgetPeriod } from './budget'

// --- Formatting Helpers ---

/**
 * Formats a number as a string with two decimal places.
 * @param amount The number to format.
 * @returns The formatted amount string, or '0.00' if the amount is null/undefined.
 */
export function formatAmount(amount: number | null | undefined): string {
  return typeof amount === 'number' ? amount.toFixed(2) : '0.00'
}

/**
 * Formats a date string into a short month and day format (e.g., "Aug 06").
 * @param dateString The date string to format (YYYY-MM-DD).
 * @returns The formatted date string.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  // Appending T00:00:00 ensures the date is parsed in the user's local timezone.
  return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formats a date range into a "start - end" format.
 * @param startDate The start date string.
 * @param endDate The end date string.
 * @returns The formatted date range string.
 */
export function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return ''
  return `${formatDate(startDate)} - ${formatDate(endDate)}`
}

/**
 * Gets the name of a weekday from its number (0-6).
 * @param weekday The number of the weekday (0 for Sunday).
 * @param format 'long' for full name, 'short' for abbreviation.
 * @returns The name of the weekday.
 */
export function getWeekdayName(weekday: number, format: 'long' | 'short' = 'long'): string {
  const daysLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = format === 'short' ? daysShort : daysLong
  return days[weekday] || 'Invalid'
}


// --- Budget Period Date Calculations ---

/**
 * Calculates the total number of days in a budget period.
 * @param period The budget period.
 * @returns The total number of days.
 */
export function getDaysInPeriod(period: BudgetPeriod): number {
    const startDate = new Date(period.start_date + 'T00:00:00');
    const endDate = new Date(period.end_date + 'T23:59:59.999');
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates the number of days that have passed in the current budget period.
 * @param period The budget period.
 * @returns The number of days passed.
 */
export function getDaysPassed(period: BudgetPeriod): number {
    const startDate = new Date(period.start_date + 'T00:00:00');
    const today = new Date();

    if (today < startDate) return 0;

    const endDate = new Date(period.end_date + 'T23:59:59.999');
    const calculationDate = today < endDate ? today : endDate;

    const daysPassed = Math.ceil((calculationDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, daysPassed);
}

/**
 * Calculates the number of days remaining in the current budget period.
 * @param period The budget period.
 * @returns The number of days remaining.
 */
export function getDaysRemaining(period: BudgetPeriod): number {
    const today = new Date();
    const endDate = new Date(period.end_date + 'T23:59:59.999');
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
}


// --- Budget Statistic Calculations ---

/**
 * Calculates the spending percentage of a budget period.
 * @param period The budget period.
 * @returns The spending percentage.
 */
export function getSpendingPercentage(period: BudgetPeriod | null): number {
  if (!period || !period.target_amount) return 0
  return ((period.actual_spent || 0) / period.target_amount) * 100
}

/**
 * Calculates the remaining amount of a budget period.
 * @param period The budget period.
 * @returns The remaining amount.
 */
export function getRemainingAmount(period: BudgetPeriod | null): number {
  if (!period) return 0
  return period.target_amount - (period.actual_spent || 0)
}

/**
 * Checks if the spending is over budget for a period.
 * @param period The budget period.
 * @returns True if over budget, false otherwise.
 */
export function isOverBudget(period: BudgetPeriod | null): boolean {
  if (!period) return false
  return (period.actual_spent || 0) > period.target_amount
}

/**
 * Calculates the daily average spending for a budget period.
 * @param period The budget period.
 * @returns The daily average spending.
 */
export function getDailyAverage(period: BudgetPeriod | null): number {
  if (!period || (period.actual_spent || 0) === 0) return 0
  const daysPassed = getDaysPassed(period)
  return (period.actual_spent || 0) / daysPassed
}

/**
 * Calculates the projected total spending for a budget period.
 * @param period The budget period.
 * @returns The projected total spending, or null if not applicable.
 */
export function getProjectedTotal(period: BudgetPeriod | null): number | null {
  if (!period) return null

  const totalDays = getDaysInPeriod(period)
  const daysPassed = getDaysPassed(period)

  if (daysPassed >= totalDays) {
    return period.actual_spent || 0
  }

  const dailyAverage = getDailyAverage(period)
  return dailyAverage * totalDays
}


// --- Upcoming Budget Calculations ---

/**
 * Calculates the start and end dates for an upcoming budget.
 * @param upcomingBudget The budget to be scheduled, requires start_weekday and duration_days.
 * @param activePeriod The currently active budget period, if any.
 * @returns An object with the start and end dates of the upcoming period.
 */
export function getUpcomingPeriod(upcomingBudget: { start_weekday: number, duration_days: number }, activePeriod: BudgetPeriod | null): { start_date: Date; end_date: Date } {
  const startDate = new Date()
  startDate.setHours(0, 0, 0, 0)

  if (activePeriod) {
    const activeEndDate = new Date(activePeriod.end_date + 'T00:00:00')
    startDate.setTime(activeEndDate.getTime() + 24 * 60 * 60 * 1000) // Day after active period ends
  } else {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetWeekday = upcomingBudget.start_weekday
    const currentWeekday = today.getDay()

    let daysUntilStart = (targetWeekday - currentWeekday + 7) % 7
    if (daysUntilStart === 0) {
      // If today is the target day, start next week
      daysUntilStart = 7
    }

    startDate.setDate(today.getDate() + daysUntilStart)
  }

  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + upcomingBudget.duration_days - 1)

  return { start_date: startDate, end_date: endDate }
}

// --- Service Object ---

/**
 * A service object that bundles all budget UI helper functions.
 */
export const budgetUiService = {
  formatAmount,
  formatDate,
  formatDateRange,
  getWeekdayName,
  getDaysInPeriod,
  getDaysPassed,
  getDaysRemaining,
  getSpendingPercentage,
  getRemainingAmount,
  isOverBudget,
  getDailyAverage,
  getProjectedTotal,
  getUpcomingPeriod,
}
