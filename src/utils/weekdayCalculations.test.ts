import { describe, it, expect } from 'vitest'
import { calculateWeekdayAverages, calculateWeekdayTotals, calculateWeekdayDailyAverages, type Expense } from './weekdayCalculations'

describe('Weekday Calculations', () => {
  const mockExpenses: Expense[] = [
    // Monday expenses (Jan 1 and Jan 8, 2024)
    { amount: 10, timestamp: '2024-01-01T12:00:00Z' }, // Monday, $10
    { amount: 20, timestamp: '2024-01-01T15:00:00Z' }, // Monday, $20
    { amount: 30, timestamp: '2024-01-08T12:00:00Z' }, // Monday, $30
    
    // Tuesday expenses (Jan 2, 2024)
    { amount: 50, timestamp: '2024-01-02T12:00:00Z' }, // Tuesday, $50
    
    // Wednesday (no expenses)
    
    // Thursday expenses (Jan 4, 2024)
    { amount: 15, timestamp: '2024-01-04T12:00:00Z' }, // Thursday, $15
    { amount: 25, timestamp: '2024-01-04T18:00:00Z' }, // Thursday, $25
  ]

  describe('calculateWeekdayAverages', () => {
    it('should calculate average amount per transaction for each weekday', () => {
      const result = calculateWeekdayAverages(mockExpenses)
      
      // Monday: 3 transactions totaling $60, average = $20
      expect(result[1]).toMatchObject({
        name: 'Mon',
        average: 20
      })
      
      // Tuesday: 1 transaction totaling $50, average = $50
      expect(result[2]).toMatchObject({
        name: 'Tue', 
        average: 50
      })
      
      // Wednesday: 0 transactions, average = $0
      expect(result[3]).toMatchObject({
        name: 'Wed',
        average: 0
      })
      
      // Thursday: 2 transactions totaling $40, average = $20
      expect(result[4]).toMatchObject({
        name: 'Thu',
        average: 20
      })
    })
  })

  describe('calculateWeekdayTotals', () => {
    it('should calculate total amount spent for each weekday', () => {
      const result = calculateWeekdayTotals(mockExpenses)
      
      // Monday: 3 transactions totaling $60
      expect(result[1]).toMatchObject({
        name: 'Mon',
        average: 60 // Note: using 'average' field but contains total
      })
      
      // Tuesday: 1 transaction totaling $50
      expect(result[2]).toMatchObject({
        name: 'Tue',
        average: 50
      })
      
      // Wednesday: 0 transactions, total = $0
      expect(result[3]).toMatchObject({
        name: 'Wed',
        average: 0
      })
      
      // Thursday: 2 transactions totaling $40
      expect(result[4]).toMatchObject({
        name: 'Thu',
        average: 40
      })
    })

    it('should calculate correct percentages based on highest total', () => {
      const result = calculateWeekdayTotals(mockExpenses)
      
      // Monday has highest total ($60), so it should be 100%
      expect(result[1].percentage).toBe(100)
      
      // Tuesday has $50, so it should be 83.33% (50/60 * 100)
      expect(result[2].percentage).toBeCloseTo(83.33, 1)
      
      // Thursday has $40, so it should be 66.67% (40/60 * 100)  
      expect(result[4].percentage).toBeCloseTo(66.67, 1)
    })
  })

  describe('calculateWeekdayDailyAverages', () => {
    it('should calculate average daily spending per weekday across date range', () => {
      const result = calculateWeekdayDailyAverages(mockExpenses)
      
      // Date range: Jan 1-8, 2024 (8 days total)
      // Mondays in range: Jan 1, Jan 8 (2 Mondays)
      // Total Monday spending: $60, Average per Monday: $30
      expect(result[1]).toMatchObject({
        name: 'Mon',
        average: 30
      })
      
      // Tuesdays in range: Jan 2 (1 Tuesday) 
      // Total Tuesday spending: $50, Average per Tuesday: $50
      expect(result[2]).toMatchObject({
        name: 'Tue',
        average: 50
      })
      
      // Wednesdays in range: Jan 3 (1 Wednesday)
      // Total Wednesday spending: $0, Average per Wednesday: $0
      expect(result[3]).toMatchObject({
        name: 'Wed',
        average: 0
      })
      
      // Thursdays in range: Jan 4 (1 Thursday)
      // Total Thursday spending: $40, Average per Thursday: $40
      expect(result[4]).toMatchObject({
        name: 'Thu',
        average: 40
      })
    })

    it('should handle empty expense array', () => {
      const result = calculateWeekdayDailyAverages([])
      expect(result).toEqual([])
    })

    it('should calculate correct percentages based on highest average', () => {
      const result = calculateWeekdayDailyAverages(mockExpenses)
      
      // Tuesday has highest average ($50), so it should be 100%
      expect(result[2].percentage).toBe(100)
      
      // Thursday has $40 average, so it should be 80% (40/50 * 100)
      expect(result[4].percentage).toBe(80)
      
      // Monday has $30 average, so it should be 60% (30/50 * 100)
      expect(result[1].percentage).toBe(60)
    })
  })

  describe('Comparison of calculation methods', () => {
    it('should show difference between per-transaction vs daily averages vs totals', () => {
      const transactionAverages = calculateWeekdayAverages(mockExpenses)
      const dailyAverages = calculateWeekdayDailyAverages(mockExpenses)
      const totals = calculateWeekdayTotals(mockExpenses)
      
      // For Monday: 3 transactions ($10, $20, $30), 2 Mondays in range
      expect(transactionAverages[1].average).toBe(20) // Average per transaction: $60/3 = $20
      expect(dailyAverages[1].average).toBe(30)       // Average per Monday: $60/2 = $30
      expect(totals[1].average).toBe(60)              // Total spent: $60
      
      // All three should be different
      expect(transactionAverages[1].average).not.toBe(dailyAverages[1].average)
      expect(dailyAverages[1].average).not.toBe(totals[1].average)
      expect(transactionAverages[1].average).not.toBe(totals[1].average)
    })
  })
})