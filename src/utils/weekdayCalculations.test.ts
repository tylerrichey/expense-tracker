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

  describe('Sunday average calculation bug', () => {
    it('should correctly calculate Sunday average when there is one Sunday expense', () => {
      // Reproduce the production issue: one expense on a Sunday should show the actual amount, not 0
      const sundayExpenses: Expense[] = [
        { amount: 25.50, timestamp: '2024-01-07T12:00:00Z' }, // Sunday, $25.50
      ]

      const dailyAverages = calculateWeekdayDailyAverages(sundayExpenses)
      
      // Sunday (index 0) should show $25.50, not 0
      expect(dailyAverages[0]).toMatchObject({
        name: 'Sun',
        average: 25.50
      })

      // Verify it's not 0
      expect(dailyAverages[0].average).not.toBe(0)
      expect(dailyAverages[0].average).toBeGreaterThan(0)
    })

    it('should correctly handle single-day expenses across different weekdays', () => {
      // Test each weekday individually to verify none return 0 when they have expenses
      const weekdayExpenses = [
        { amount: 10, timestamp: '2024-01-07T12:00:00Z' }, // Sunday
        { amount: 20, timestamp: '2024-01-08T12:00:00Z' }, // Monday  
        { amount: 30, timestamp: '2024-01-09T12:00:00Z' }, // Tuesday
        { amount: 40, timestamp: '2024-01-10T12:00:00Z' }, // Wednesday
        { amount: 50, timestamp: '2024-01-11T12:00:00Z' }, // Thursday
        { amount: 60, timestamp: '2024-01-12T12:00:00Z' }, // Friday
        { amount: 70, timestamp: '2024-01-13T12:00:00Z' }, // Saturday
      ]

      const dailyAverages = calculateWeekdayDailyAverages(weekdayExpenses)
      
      // Each weekday should show its expense amount, not 0
      expect(dailyAverages[0].average).toBe(10) // Sunday
      expect(dailyAverages[1].average).toBe(20) // Monday
      expect(dailyAverages[2].average).toBe(30) // Tuesday  
      expect(dailyAverages[3].average).toBe(40) // Wednesday
      expect(dailyAverages[4].average).toBe(50) // Thursday
      expect(dailyAverages[5].average).toBe(60) // Friday
      expect(dailyAverages[6].average).toBe(70) // Saturday

      // None should be 0
      dailyAverages.forEach((day, index) => {
        expect(day.average).toBeGreaterThan(0, `${day.name} should not be 0`)
      })
    })

    it('should reproduce production-like scenario with mixed dates spanning multiple weeks', () => {
      // Simulate a more production-like scenario where expenses span multiple weeks/months
      // This might reveal an edge case in the date range calculation
      const productionLikeExpenses: Expense[] = [
        // A single expense on Sunday in a longer time period
        { amount: 50.75, timestamp: '2024-07-21T10:00:00Z' }, // Sunday
        // Some expenses on other days in different weeks
        { amount: 25.00, timestamp: '2024-07-15T12:00:00Z' }, // Monday (different week)
        { amount: 15.50, timestamp: '2024-07-30T14:00:00Z' }, // Tuesday (different week)
      ]

      const dailyAverages = calculateWeekdayDailyAverages(productionLikeExpenses)
      
      
      // Sunday should show the actual amount divided by number of Sundays in the date range
      // Date range: July 15 - July 30, 2024 (16 days)
      // Sundays in that range: July 21 and July 28 (2 Sundays)
      // Expected Sunday average: $50.75 / 2 = $25.375
      expect(dailyAverages[0].average).toBeCloseTo(25.375, 2) // Sunday
      expect(dailyAverages[0].average).not.toBe(0)
    })

    it('should handle potential edge case with very small amounts or precision', () => {
      // Test edge case that might cause precision issues leading to 0
      const edgeCaseExpenses: Expense[] = [
        { amount: 0.01, timestamp: '2024-07-21T10:00:00Z' }, // Sunday - tiny amount
        { amount: 100, timestamp: '2024-07-15T12:00:00Z' }, // Monday - much larger amount
      ]

      const dailyAverages = calculateWeekdayDailyAverages(edgeCaseExpenses)
      
      // Even tiny amounts should not result in 0
      expect(dailyAverages[0].average).toBeGreaterThan(0)
      expect(dailyAverages[0].average).not.toBe(0)
    })

    it('should handle timestamp as number instead of string', () => {
      // Test if the issue is related to timestamp format
      const timestampExpenses: Expense[] = [
        { amount: 25.50, timestamp: new Date('2024-07-21T10:00:00Z').getTime() }, // Sunday as timestamp
        { amount: 30.00, timestamp: new Date('2024-07-22T12:00:00Z').getTime() }, // Monday as timestamp
      ]

      const dailyAverages = calculateWeekdayDailyAverages(timestampExpenses)
      
      // Sunday should not be 0
      expect(dailyAverages[0].average).toBeGreaterThan(0)
      expect(dailyAverages[0].average).not.toBe(0)
    })
  })
})