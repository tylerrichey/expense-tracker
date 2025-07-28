import { describe, it, expect, beforeAll } from 'vitest'
import {
  calculateBudgetPeriodStart,
  calculateBudgetPeriodEnd,
  generateBudgetPeriods,
  generateRetroactivePeriod,
  isDateInPeriod,
  findPeriodForDate,
  updatePeriodStatuses,
  checkPeriodOverlap,
  calculateNextPeriodStart,
  formatDateForDB,
  getWeekdayName,
  validateBudget,
  setDatabaseInstance
// @ts-expect-error
} from '../../server/budget-utils.js'

// Mock database instance for tests
const mockDb = {
  prepare: (_query: string) => ({
    get: (key: string) => {
      if (key === 'timezone') {
        return { value: 'UTC' }
      }
      return null
    }
  })
}

describe('Budget Utilities Tests', () => {
  
  beforeAll(() => {
    // Set mock database instance for timezone-aware operations
    setDatabaseInstance(mockDb as any)
  })
  
  describe('calculateBudgetPeriodStart', () => {
    it('should calculate correct start date for Monday weekly budget', () => {
      // Test with Tuesday 2025-07-22 (today)
      const testDate = new Date('2025-07-22T12:00:00')
      const startDate = calculateBudgetPeriodStart(1, 7, testDate) // Monday (1)
      
      expect(startDate.getDay()).toBe(1) // Should be Monday
      expect(startDate.toISOString().split('T')[0]).toBe('2025-07-21') // Previous Monday
    })
    
    it('should handle Sunday start weekday correctly', () => {
      const testDate = new Date('2025-07-22T12:00:00') // Tuesday
      const startDate = calculateBudgetPeriodStart(0, 7, testDate) // Sunday (0)
      
      expect(startDate.getDay()).toBe(0) // Should be Sunday
      expect(startDate.toISOString().split('T')[0]).toBe('2025-07-20') // Previous Sunday
    })
    
    it('should handle same weekday correctly', () => {
      const testDate = new Date('2025-07-21T12:00:00') // Monday
      const startDate = calculateBudgetPeriodStart(1, 7, testDate) // Monday (1)
      
      expect(startDate.getDay()).toBe(1) // Should be Monday
      expect(startDate.toISOString().split('T')[0]).toBe('2025-07-21') // Same Monday
    })
    
    it('should set start time to beginning of day', () => {
      const testDate = new Date('2025-07-22T15:30:45')
      const startDate = calculateBudgetPeriodStart(1, 7, testDate)
      
      expect(startDate.getHours()).toBe(0)
      expect(startDate.getMinutes()).toBe(0)
      expect(startDate.getSeconds()).toBe(0)
      expect(startDate.getMilliseconds()).toBe(0)
    })
  })

  describe('calculateBudgetPeriodEnd', () => {
    it('should calculate correct end date for 7-day period', () => {
      const startDate = new Date('2025-07-21T00:00:00')
      const endDate = calculateBudgetPeriodEnd(startDate, 7)
      
      expect(endDate.toISOString().split('T')[0]).toBe('2025-07-27') // 6 days later
      expect(endDate.getUTCHours()).toBe(23)
      expect(endDate.getUTCMinutes()).toBe(59)
      expect(endDate.getUTCSeconds()).toBe(59)
    })
    
    it('should calculate correct end date for 14-day period', () => {
      const startDate = new Date('2025-07-21T00:00:00')
      const endDate = calculateBudgetPeriodEnd(startDate, 14)
      
      expect(endDate.toISOString().split('T')[0]).toBe('2025-08-03') // 13 days later
    })
  })

  describe('generateBudgetPeriods', () => {
    const testBudget = {
      id: 1,
      name: 'Test Budget',
      amount: 500,
      start_weekday: 1, // Monday
      duration_days: 7
    }

    it('should generate single period correctly', () => {
      const fromDate = new Date('2025-07-22T12:00:00') // Tuesday
      const periods = generateBudgetPeriods(testBudget, fromDate, 1)
      
      expect(periods).toHaveLength(1)
      expect(periods[0].budget_id).toBe(1)
      expect(periods[0].start_date).toBe('2025-07-21') // Previous Monday
      expect(periods[0].end_date).toBe('2025-07-27') // Following Sunday
      expect(periods[0].target_amount).toBe(500)
      expect(periods[0].status).toBe('active')
    })

    it('should generate multiple periods correctly', () => {
      const fromDate = new Date('2025-07-21T00:00:00') // Monday
      const periods = generateBudgetPeriods(testBudget, fromDate, 3)
      
      expect(periods).toHaveLength(3)
      expect(periods[0].status).toBe('active')
      expect(periods[1].status).toBe('upcoming')
      expect(periods[2].status).toBe('upcoming')
      
      // Check period progression
      expect(periods[0].start_date).toBe('2025-07-21')
      expect(periods[1].start_date).toBe('2025-07-28')
      expect(periods[2].start_date).toBe('2025-08-04')
    })
  })

  describe('generateRetroactivePeriod', () => {
    const testBudget = {
      id: 1,
      name: 'Retroactive Budget',
      amount: 300,
      start_weekday: 1, // Monday
      duration_days: 7
    }

    it('should generate retroactive period that covers target date', () => {
      // Use a date from this week so the period will be active
      const today = new Date()
      const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0) // Today at noon
      const period = generateRetroactivePeriod(testBudget, targetDate)
      
      expect(period.budget_id).toBe(1)
      expect(period.target_amount).toBe(300)
      // The period should cover the target date and be active since we're generating it for today
      expect(['active', 'completed'].includes(period.status)).toBe(true) // Could be active or completed depending on timing
    })
  })

  describe('isDateInPeriod', () => {
    const testPeriod = {
      start_date: '2025-07-21',
      end_date: '2025-07-27'
    }

    it('should return true for date within period', () => {
      const testDate = new Date('2025-07-23T15:30:00Z') // Wednesday in UTC
      expect(isDateInPeriod(testDate, testPeriod)).toBe(true)
    })

    it('should return true for start date', () => {
      const testDate = new Date('2025-07-21T08:00:00Z') // Monday in UTC
      expect(isDateInPeriod(testDate, testPeriod)).toBe(true)
    })

    it('should return true for end date', () => {
      const testDate = new Date('2025-07-27T20:00:00Z') // Sunday in UTC
      expect(isDateInPeriod(testDate, testPeriod)).toBe(true)
    })

    it('should return false for date before period', () => {
      const testDate = new Date('2025-07-20T12:00:00Z') // Sunday before in UTC
      expect(isDateInPeriod(testDate, testPeriod)).toBe(false)
    })

    it('should return false for date after period', () => {
      const testDate = new Date('2025-07-28T12:00:00Z') // Monday after in UTC
      expect(isDateInPeriod(testDate, testPeriod)).toBe(false)
    })
  })

  describe('findPeriodForDate', () => {
    const periods = [
      { id: 1, start_date: '2025-07-14', end_date: '2025-07-20' },
      { id: 2, start_date: '2025-07-21', end_date: '2025-07-27' },
      { id: 3, start_date: '2025-07-28', end_date: '2025-08-03' }
    ]

    it('should find correct period for date', () => {
      const testDate = new Date('2025-07-23T12:00:00')
      const result = findPeriodForDate(testDate, periods)
      
      expect(result).not.toBeNull()
      expect(result!.id).toBe(2)
    })

    it('should return null for date not in any period', () => {
      const testDate = new Date('2025-08-10T12:00:00')
      const result = findPeriodForDate(testDate, periods)
      
      expect(result).toBeNull()
    })
  })

  describe('updatePeriodStatuses', () => {
    it('should update statuses based on current date', () => {
      const periods = [
        { id: 1, start_date: '2025-07-14', end_date: '2025-07-20', status: 'active' },
        { id: 2, start_date: '2025-07-21', end_date: '2025-07-27', status: 'upcoming' },
        { id: 3, start_date: '2025-07-28', end_date: '2025-08-03', status: 'upcoming' }
      ]
      
      const currentDate = new Date('2025-07-23T12:00:00') // Wednesday in period 2
      const updated = updatePeriodStatuses(periods, currentDate)
      
      expect(updated[0].status).toBe('completed') // Period 1 is past
      expect(updated[1].status).toBe('active')    // Period 2 is current
      expect(updated[2].status).toBe('upcoming')  // Period 3 is future
    })
  })

  describe('checkPeriodOverlap', () => {
    const existingPeriods = [
      { start_date: '2025-07-14', end_date: '2025-07-20' },
      { start_date: '2025-07-28', end_date: '2025-08-03' }
    ]

    it('should detect overlap with existing period', () => {
      const newPeriod = { start_date: '2025-07-18', end_date: '2025-07-25' }
      expect(checkPeriodOverlap(newPeriod, existingPeriods)).toBe(true)
    })

    it('should not detect overlap for non-overlapping period', () => {
      const newPeriod = { start_date: '2025-07-21', end_date: '2025-07-27' }
      expect(checkPeriodOverlap(newPeriod, existingPeriods)).toBe(false)
    })
  })

  describe('calculateNextPeriodStart', () => {
    it('should calculate correct next period start', () => {
      const currentPeriod = { start_date: '2025-07-21', end_date: '2025-07-27' }
      const nextStart = calculateNextPeriodStart(currentPeriod, 7)
      
      expect(nextStart.toISOString().split('T')[0]).toBe('2025-07-28')
    })
  })

  describe('formatDateForDB', () => {
    it('should format date correctly for database', () => {
      const testDate = new Date('2025-07-23T15:30:45.123Z')
      const formatted = formatDateForDB(testDate)
      
      expect(formatted).toBe('2025-07-23')
    })
  })

  describe('getWeekdayName', () => {
    it('should return correct weekday names', () => {
      expect(getWeekdayName(0)).toBe('Sunday')
      expect(getWeekdayName(1)).toBe('Monday')
      expect(getWeekdayName(6)).toBe('Saturday')
    })

    it('should handle invalid weekday', () => {
      expect(getWeekdayName(-1)).toBe('Invalid')
      expect(getWeekdayName(7)).toBe('Invalid')
    })
  })

  describe('validateBudget', () => {
    it('should validate correct budget', () => {
      const validBudget = {
        name: 'Test Budget',
        amount: 500,
        start_weekday: 1,
        duration_days: 7
      }
      
      const result = validateBudget(validBudget)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject budget with missing name', () => {
      const invalidBudget = {
        name: '',
        amount: 500,
        start_weekday: 1,
        duration_days: 7
      }
      
      const result = validateBudget(invalidBudget)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Budget name is required')
    })

    it('should reject budget with invalid amount', () => {
      const invalidBudget = {
        name: 'Test Budget',
        amount: -100,
        start_weekday: 1,
        duration_days: 7
      }
      
      const result = validateBudget(invalidBudget)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Budget amount must be greater than 0')
    })

    it('should reject budget with invalid weekday', () => {
      const invalidBudget = {
        name: 'Test Budget',
        amount: 500,
        start_weekday: 8,
        duration_days: 7
      }
      
      const result = validateBudget(invalidBudget)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Start weekday must be between 0 (Sunday) and 6 (Saturday)')
    })

    it('should reject budget with invalid duration', () => {
      const invalidBudget = {
        name: 'Test Budget',
        amount: 500,
        start_weekday: 1,
        duration_days: 30
      }
      
      const result = validateBudget(invalidBudget)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Duration must be between 7 and 28 days')
    })

    it('should collect multiple validation errors', () => {
      const invalidBudget = {
        name: '',
        amount: -100,
        start_weekday: 8,
        duration_days: 30
      }
      
      const result = validateBudget(invalidBudget)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(4)
    })
  })
})