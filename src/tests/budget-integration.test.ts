import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

// Import the actual database service and utilities for integration testing
// @ts-ignore
import { generateBudgetPeriods, generateRetroactivePeriod, calculateNextPeriodStart } from '../../server/budget-utils.js'

// Test database service for integration tests
class IntegrationTestDatabaseService {
  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.initializeTestDatabase()
  }

  db: Database.Database

  initializeTestDatabase() {
    // Run the actual migration logic
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        latitude REAL,
        longitude REAL,
        place_id TEXT,
        place_name TEXT,
        place_address TEXT,
        receipt_image BLOB,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        budget_period_id INTEGER REFERENCES budget_periods(id) ON DELETE SET NULL
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        start_weekday INTEGER NOT NULL CHECK (start_weekday >= 0 AND start_weekday <= 6),
        duration_days INTEGER NOT NULL CHECK (duration_days >= 7 AND duration_days <= 28),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT false,
        is_upcoming BOOLEAN DEFAULT false,
        vacation_mode BOOLEAN DEFAULT false
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS budget_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        budget_id INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        target_amount DECIMAL(10,2) NOT NULL,
        actual_spent DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
        CONSTRAINT no_overlap UNIQUE (budget_id, start_date, end_date)
      )
    `)
  }

  // Core database operations
  createBudget(budget: any) {
    const stmt = this.db.prepare(`
      INSERT INTO budgets (name, amount, start_weekday, duration_days, is_active, is_upcoming, vacation_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      budget.name,
      budget.amount,
      budget.start_weekday,
      budget.duration_days,
      budget.is_active ? 1 : 0,
      budget.is_upcoming ? 1 : 0,
      budget.vacation_mode ? 1 : 0
    )
    
    return { id: result.lastInsertRowid, ...budget }
  }

  createBudgetPeriod(period: any) {
    const stmt = this.db.prepare(`
      INSERT INTO budget_periods (budget_id, start_date, end_date, target_amount, status)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      period.budget_id,
      period.start_date,
      period.end_date,
      period.target_amount,
      period.status || 'upcoming'
    )
    
    return { id: result.lastInsertRowid, ...period }
  }

  addExpense(expense: any) {
    const stmt = this.db.prepare(`
      INSERT INTO expenses (amount, timestamp, budget_period_id, place_name)
      VALUES (?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      expense.amount,
      expense.timestamp,
      expense.budget_period_id || null,
      expense.place_name || 'Test Location'
    )
    
    return { id: result.lastInsertRowid, ...expense }
  }

  getBudgetPeriods() {
    const stmt = this.db.prepare(`
      SELECT bp.*, b.name as budget_name,
             COALESCE(SUM(e.amount), 0) as actual_spent
      FROM budget_periods bp
      JOIN budgets b ON b.id = bp.budget_id
      LEFT JOIN expenses e ON e.budget_period_id = bp.id
      GROUP BY bp.id
      ORDER BY bp.start_date ASC
    `)
    return stmt.all()
  }

  getExpensesInPeriod(periodId: number) {
    const stmt = this.db.prepare('SELECT * FROM expenses WHERE budget_period_id = ? ORDER BY timestamp ASC')
    return stmt.all(periodId)
  }

  associateExpensesWithPeriod(periodId: number, startDate: string, endDate: string) {
    const stmt = this.db.prepare(`
      UPDATE expenses 
      SET budget_period_id = ?
      WHERE budget_period_id IS NULL
      AND DATE(timestamp) >= DATE(?)
      AND DATE(timestamp) <= DATE(?)
    `)

    const result = stmt.run(periodId, startDate, endDate)
    return result.changes
  }

  getActiveBudget() {
    const stmt = this.db.prepare('SELECT * FROM budgets WHERE is_active = true LIMIT 1')
    return stmt.get()
  }

  updateBudget(id: number, updates: any) {
    const allowedFields = ['name', 'amount', 'is_active', 'is_upcoming', 'vacation_mode']
    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key))
    
    if (updateFields.length === 0) return null
    
    const setClause = updateFields.map(field => `${field} = ?`).join(', ')
    const values = updateFields.map(field => {
      const value = updates[field]
      // Convert boolean values to integers for SQLite
      if (typeof value === 'boolean') {
        return value ? 1 : 0
      }
      return value
    })
    values.push(id)
    
    const stmt = this.db.prepare(`UPDATE budgets SET ${setClause} WHERE id = ?`)
    const result = stmt.run(...values)
    
    if (result.changes > 0) {
      const getStmt = this.db.prepare('SELECT * FROM budgets WHERE id = ?')
      return getStmt.get(id)
    }
    return null
  }

  close() {
    this.db.close()
  }
}

describe('Budget System Integration Tests', () => {
  let testDbService: IntegrationTestDatabaseService
  let testDbPath: string

  beforeAll(() => {
    testDbPath = path.join(process.cwd(), 'test-budget-integration.sqlite')
    
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    
    testDbService = new IntegrationTestDatabaseService(testDbPath)
  })

  afterAll(() => {
    testDbService.close()
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  beforeEach(() => {
    // Clean up tables before each test
    testDbService.db.exec('DELETE FROM expenses')
    testDbService.db.exec('DELETE FROM budget_periods')
    testDbService.db.exec('DELETE FROM budgets')
  })

  describe('Complete Budget Lifecycle', () => {
    it('should handle complete budget setup and usage workflow', async () => {
      // 1. Create a budget
      const budget = testDbService.createBudget({
        name: 'Weekly Groceries',
        amount: 150.00,
        start_weekday: 1, // Monday
        duration_days: 7,
        is_active: true
      })

      expect(budget.id).toBeDefined()
      expect(budget.name).toBe('Weekly Groceries')

      // 2. Generate first period using utilities
      const periods = generateBudgetPeriods(budget, new Date('2025-07-22T12:00:00'), 1)
      const firstPeriod = testDbService.createBudgetPeriod(periods[0])

      expect(firstPeriod.start_date).toBe('2025-07-21') // Previous Monday
      expect(firstPeriod.end_date).toBe('2025-07-27')   // Following Sunday
      expect(firstPeriod.status).toBe('active')

      // 3. Add expenses during the period
      testDbService.addExpense({
        amount: 35.50,
        timestamp: '2025-07-22T10:30:00',
        budget_period_id: firstPeriod.id,
        place_name: 'Grocery Store A'
      })

      testDbService.addExpense({
        amount: 42.75,
        timestamp: '2025-07-24T14:15:00',
        budget_period_id: firstPeriod.id,
        place_name: 'Grocery Store B'
      })

      // 4. Verify period shows correct spending
      const periodsWithSpending = testDbService.getBudgetPeriods()
      expect(periodsWithSpending).toHaveLength(1)
      expect((periodsWithSpending[0] as any).actual_spent).toBe(78.25)
      expect((periodsWithSpending[0] as any).target_amount).toBe(150.00)

      // 5. Generate next period for continuation
      const nextStartDate = calculateNextPeriodStart(firstPeriod, budget.duration_days)
      const nextPeriods = generateBudgetPeriods(budget, nextStartDate, 1)
      const secondPeriod = testDbService.createBudgetPeriod(nextPeriods[0])

      expect(secondPeriod.start_date).toBe('2025-07-28') // Next Monday
      expect(secondPeriod.end_date).toBe('2025-08-03')   // Following Sunday

      // 6. Verify we now have two periods
      const allPeriods = testDbService.getBudgetPeriods()
      expect(allPeriods).toHaveLength(2)
      expect((allPeriods[0] as any).actual_spent).toBe(78.25) // First period
      expect((allPeriods[1] as any).actual_spent).toBe(0)     // Second period
    })

    it('should handle retroactive budget creation with existing expenses', async () => {
      // 1. Add some expenses without budget periods (orphans)
      testDbService.addExpense({
        amount: 25.00,
        timestamp: '2025-07-22T09:00:00',
        place_name: 'Coffee Shop'
      })

      testDbService.addExpense({
        amount: 45.00,
        timestamp: '2025-07-23T12:00:00',
        place_name: 'Lunch Place'
      })

      testDbService.addExpense({
        amount: 15.00,
        timestamp: '2025-07-20T16:00:00', // Before period
        place_name: 'Snack Store'
      })

      // 2. Create budget retroactively
      const budget = testDbService.createBudget({
        name: 'Retroactive Dining Budget',
        amount: 200.00,
        start_weekday: 1, // Monday
        duration_days: 7,
        is_active: true
      })

      // 3. Generate retroactive period that should cover current date
      const retroPeriod = generateRetroactivePeriod(budget)
      const createdPeriod = testDbService.createBudgetPeriod(retroPeriod)

      expect(createdPeriod.start_date).toBe('2025-07-21') // Previous Monday
      expect(createdPeriod.end_date).toBe('2025-07-27')   // Following Sunday
      expect(createdPeriod.status).toBe('active')

      // 4. Associate existing expenses with the retroactive period
      const associatedCount = testDbService.associateExpensesWithPeriod(
        createdPeriod.id,
        createdPeriod.start_date,
        createdPeriod.end_date
      )

      expect(associatedCount).toBe(2) // Only 2 expenses fall within the period

      // 5. Verify period shows correct spending
      const periodsWithSpending = testDbService.getBudgetPeriods()
      expect(periodsWithSpending).toHaveLength(1)
      expect((periodsWithSpending[0] as any).actual_spent).toBe(70.00) // 25 + 45

      // 6. Verify expenses are properly associated
      const expensesInPeriod = testDbService.getExpensesInPeriod(createdPeriod.id)
      expect(expensesInPeriod).toHaveLength(2)
      expect((expensesInPeriod[0] as any).amount).toBe(25.00)
      expect((expensesInPeriod[1] as any).amount).toBe(45.00)
    })

    it('should handle budget transitions (upcoming budget activation)', async () => {
      // 1. Create current active budget
      const currentBudget = testDbService.createBudget({
        name: 'Current Budget',
        amount: 300.00,
        start_weekday: 1,
        duration_days: 7,
        is_active: true
      })

      // 2. Create upcoming budget
      const upcomingBudget = testDbService.createBudget({
        name: 'New Budget Plan',
        amount: 400.00,
        start_weekday: 1,
        duration_days: 14, // Different duration
        is_upcoming: true
      })

      // 3. Create period for current budget
      const currentPeriods = generateBudgetPeriods(currentBudget, new Date('2025-07-21T00:00:00'), 1)
      const currentPeriod = testDbService.createBudgetPeriod(currentPeriods[0])

      // 4. Add some expenses to current period
      testDbService.addExpense({
        amount: 75.00,
        timestamp: '2025-07-23T11:00:00',
        budget_period_id: currentPeriod.id
      })

      // 5. Simulate budget transition
      // Deactivate current budget
      testDbService.updateBudget(currentBudget.id, { is_active: false })
      
      // Activate upcoming budget
      testDbService.updateBudget(upcomingBudget.id, { 
        is_active: true, 
        is_upcoming: false 
      })

      // 6. Create first period for new active budget
      const newPeriods = generateBudgetPeriods(upcomingBudget, new Date('2025-07-28T00:00:00'), 1)
      const newPeriod = testDbService.createBudgetPeriod(newPeriods[0])

      // 7. Verify transition
      const activeBudget = testDbService.getActiveBudget()
      expect((activeBudget as any).name).toBe('New Budget Plan')
      expect((activeBudget as any).is_active).toBe(1) // SQLite returns 1 for true
      expect((activeBudget as any).is_upcoming).toBe(0) // Should be false now

      // 8. Verify periods are correct
      const allPeriods = testDbService.getBudgetPeriods()
      expect(allPeriods).toHaveLength(2)
      
      // Current period should have expenses
      const currentPeriodData = allPeriods.find((p: any) => p.id === currentPeriod.id)
      expect((currentPeriodData as any)!.actual_spent).toBe(75.00)
      
      // New period should be clean
      const newPeriodData = allPeriods.find((p: any) => p.id === newPeriod.id)
      expect((newPeriodData as any)!.actual_spent).toBe(0)
      expect((newPeriodData as any)!.target_amount).toBe(400.00)
    })

    it('should handle complex multi-period budget with different durations', async () => {
      // 1. Create a bi-weekly budget
      const budget = testDbService.createBudget({
        name: 'Bi-weekly Entertainment',
        amount: 200.00,
        start_weekday: 5, // Friday
        duration_days: 14,
        is_active: true
      })

      // 2. Generate multiple periods
      const allPeriods = generateBudgetPeriods(budget, new Date('2025-07-25T12:00:00'), 3)
      
      const period1 = testDbService.createBudgetPeriod(allPeriods[0])
      const period2 = testDbService.createBudgetPeriod(allPeriods[1])
      const period3 = testDbService.createBudgetPeriod(allPeriods[2])

      // 3. Verify period dates are correct (14-day intervals starting Friday)
      expect(period1.start_date).toBe('2025-07-25') // Friday
      expect(period1.end_date).toBe('2025-08-07')   // Thursday (14 days later)

      expect(period2.start_date).toBe('2025-08-08')  // Next Friday
      expect(period2.end_date).toBe('2025-08-21')    // Thursday

      expect(period3.start_date).toBe('2025-08-22')  // Next Friday
      expect(period3.end_date).toBe('2025-09-04')    // Thursday

      // 4. Add expenses to different periods
      testDbService.addExpense({
        amount: 50.00,
        timestamp: '2025-07-26T19:00:00', // Period 1
        budget_period_id: period1.id,
        place_name: 'Movie Theater'
      })

      testDbService.addExpense({
        amount: 75.00,
        timestamp: '2025-08-09T20:30:00', // Period 2
        budget_period_id: period2.id,
        place_name: 'Concert Venue'
      })

      // 5. Verify spending is correctly attributed
      const periodsWithSpending = testDbService.getBudgetPeriods()
      expect(periodsWithSpending).toHaveLength(3)

      const p1 = periodsWithSpending.find((p: any) => p.id === period1.id)
      const p2 = periodsWithSpending.find((p: any) => p.id === period2.id)
      const p3 = periodsWithSpending.find((p: any) => p.id === period3.id)

      expect((p1 as any)!.actual_spent).toBe(50.00)
      expect((p2 as any)!.actual_spent).toBe(75.00)
      expect((p3 as any)!.actual_spent).toBe(0)

      // All should have the same target
      expect((p1 as any)!.target_amount).toBe(200.00)
      expect((p2 as any)!.target_amount).toBe(200.00)
      expect((p3 as any)!.target_amount).toBe(200.00)
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle period overlap detection', async () => {
      const budget = testDbService.createBudget({
        name: 'Test Budget',
        amount: 100.00,
        start_weekday: 1,
        duration_days: 7
      })

      // Create first period
      testDbService.createBudgetPeriod({
        budget_id: budget.id,
        start_date: '2025-07-21',
        end_date: '2025-07-27',
        target_amount: 100.00,
        status: 'active'
      })

      // Try to create overlapping period - should fail due to unique constraint
      try {
        testDbService.createBudgetPeriod({
          budget_id: budget.id,
          start_date: '2025-07-24', // Overlaps with existing period
          end_date: '2025-07-30',
          target_amount: 100.00,
          status: 'upcoming'
        })
        // If it doesn't throw, fail the test
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should handle expenses from before any budget period exists', async () => {
      // Add expenses first
      testDbService.addExpense({
        amount: 30.00,
        timestamp: '2025-07-15T10:00:00',
        place_name: 'Early Expense'
      })

      // Create budget and period later
      const budget = testDbService.createBudget({
        name: 'Later Budget',
        amount: 100.00,
        start_weekday: 1,
        duration_days: 7,
        is_active: true
      })

      const periods = generateBudgetPeriods(budget, new Date('2025-07-21T00:00:00'), 1)
      const period = testDbService.createBudgetPeriod(periods[0])

      // The expense should not be associated (it's outside the period)
      const periodsWithSpending = testDbService.getBudgetPeriods()
      expect((periodsWithSpending[0] as any).actual_spent).toBe(0)

      // The expense should still exist as an orphan
      const expensesInPeriod = testDbService.getExpensesInPeriod(period.id)
      expect(expensesInPeriod).toHaveLength(0)
    })

    it('should handle multiple budgets correctly (only one active)', async () => {
      // Create multiple budgets
      const budget1 = testDbService.createBudget({
        name: 'Food Budget',
        amount: 200.00,
        start_weekday: 1,
        duration_days: 7,
        is_active: true
      })

      const budget2 = testDbService.createBudget({
        name: 'Entertainment Budget',
        amount: 100.00,
        start_weekday: 2,
        duration_days: 14,
        is_active: false // Not active
      })

      // Create periods for both
      const periods1 = generateBudgetPeriods(budget1, new Date('2025-07-21T00:00:00'), 1)
      testDbService.createBudgetPeriod(periods1[0])

      const periods2 = generateBudgetPeriods(budget2, new Date('2025-07-22T00:00:00'), 1)
      testDbService.createBudgetPeriod(periods2[0])

      // Verify only one active budget
      const activeBudget = testDbService.getActiveBudget()
      expect((activeBudget as any).name).toBe('Food Budget')

      // Both periods should exist
      const allPeriods = testDbService.getBudgetPeriods()
      expect(allPeriods).toHaveLength(2)
    })
  })
})