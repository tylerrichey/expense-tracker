import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import {
  formatAmount,
  formatDate,
  formatDateRange,
  getWeekdayName,
  getDaysRemaining,
  getDailyAverage,
  getProjectedTotal,
  getUpcomingPeriod,
  getSpendingPercentage,
  getRemainingAmount,
  isOverBudget,
  getDaysPassed,
  getDaysInPeriod,
} from '../services/budgetUiService'
import type { Budget, BudgetPeriod } from '../services/budget'

describe('budgetUiService', () => {
  // Mock Date
  beforeAll(() => {
    const mockDate = new Date('2025-08-15T12:00:00.000Z') // A Friday
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  describe('Formatting Helpers', () => {
    it('formatAmount should format numbers correctly', () => {
      expect(formatAmount(123)).toBe('123.00')
      expect(formatAmount(123.456)).toBe('123.46')
      expect(formatAmount(0)).toBe('0.00')
      expect(formatAmount(null)).toBe('0.00')
      expect(formatAmount(undefined)).toBe('0.00')
    })

    it('formatDate should format date strings', () => {
      expect(formatDate('2025-08-15')).toBe('Aug 15')
      expect(formatDate('2025-12-01')).toBe('Dec 1')
    })

    it('formatDateRange should format date ranges', () => {
      expect(formatDateRange('2025-08-15', '2025-08-21')).toBe('Aug 15 - Aug 21')
    })

    it('getWeekdayName should return correct day names', () => {
      expect(getWeekdayName(0)).toBe('Sunday')
      expect(getWeekdayName(1, 'short')).toBe('Mon')
      expect(getWeekdayName(6)).toBe('Saturday')
    })
  })

  describe('Budget Period Calculations', () => {
    const period: BudgetPeriod = {
      id: 1,
      budget_id: 1,
      budget_name: 'Test',
      start_date: '2025-08-11', // Monday
      end_date: '2025-08-17', // Sunday
      target_amount: 700,
      actual_spent: 300,
      status: 'active',
      created_at: '2025-08-11',
    }

    it('getDaysInPeriod should calculate total days correctly', () => {
      expect(getDaysInPeriod(period)).toBe(7)
    })

    it('getDaysPassed should calculate passed days correctly', () => {
        // Today is Friday Aug 15th. Start was Monday Aug 11th. So 5 days passed (Mon, Tue, Wed, Thu, Fri)
        expect(getDaysPassed(period)).toBe(5)
    })

    it('getDaysRemaining should calculate remaining days correctly', () => {
        // Today is Aug 15th, period ends Aug 17th. Remaining should be 3 (15, 16, 17)
        expect(getDaysRemaining(period)).toBe(3)
    })

    it('getDaysRemaining should be 0 for past periods', () => {
        const pastPeriod = { ...period, start_date: '2025-08-04', end_date: '2025-08-10' }
        expect(getDaysRemaining(pastPeriod)).toBe(0)
    })
  })

  describe('Budget Statistic Calculations', () => {
    const period: BudgetPeriod = {
        id: 1,
        budget_id: 1,
        budget_name: 'Test',
        start_date: '2025-08-11', // Monday
        end_date: '2025-08-17', // Sunday
        target_amount: 700,
        actual_spent: 350,
        status: 'active',
        created_at: '2025-08-11',
    }

    it('getSpendingPercentage should be 50%', () => {
        expect(getSpendingPercentage(period)).toBe(50)
    })

    it('getRemainingAmount should be 350', () => {
        expect(getRemainingAmount(period)).toBe(350)
    })

    it('isOverBudget should be false', () => {
        expect(isOverBudget(period)).toBe(false)
    })

    it('isOverBudget should be true when spent > target', () => {
        expect(isOverBudget({ ...period, actual_spent: 701 })).toBe(true)
    })

    it('getDailyAverage should be 70', () => {
        // 350 spent / 5 days passed
        expect(getDailyAverage(period)).toBe(70)
    })

    it('getProjectedTotal should be 490', () => {
        // 70 daily average * 7 days
        expect(getProjectedTotal(period)).toBe(490)
    })
  })

  describe('Upcoming Budget Calculations', () => {
    const upcomingBudget: Budget = {
        id: 2,
        name: 'Upcoming',
        amount: 1400,
        start_weekday: 1, // Monday
        duration_days: 14,
        is_active: false,
        is_upcoming: true,
        vacation_mode: false,
        created_at: '2025-08-01',
        updated_at: '2025-08-01',
        has_history: false,
    }

    it('getUpcomingPeriod should calculate next period when there is an active one', () => {
        const activePeriod: BudgetPeriod = {
            id: 1, budget_id: 1, budget_name: 'Active',
            start_date: '2025-08-11', end_date: '2025-08-17', // Ends Sunday
            target_amount: 700, actual_spent: 350, status: 'active', created_at: ''
        }
        const { start_date, end_date } = getUpcomingPeriod(upcomingBudget, activePeriod)
        expect(start_date.toISOString().split('T')[0]).toBe('2025-08-18') // Starts Monday after
        expect(end_date.toISOString().split('T')[0]).toBe('2025-08-31')
    })

    it('getUpcomingPeriod should calculate next period when there is no active one', () => {
        // Today is Friday, Aug 15. Next Monday is Aug 18.
        const { start_date, end_date } = getUpcomingPeriod(upcomingBudget, null)
        expect(start_date.toISOString().split('T')[0]).toBe('2025-08-18')
        expect(end_date.toISOString().split('T')[0]).toBe('2025-08-31')
    })
  })
})
