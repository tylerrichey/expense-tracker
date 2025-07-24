import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

interface Budget {
  id: number;
  name: string;
  amount: number;
  start_weekday: number;
  duration_days: number;
  is_active: boolean;
  is_upcoming: boolean;
  vacation_mode: boolean;
}

interface Expense {
  id: number;
  amount: number;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  place_name: string | null;
  place_address: string | null;
  receipt_image: Buffer | null;
  timestamp: string;
  budget_period_id: number | null;
}

// We need to create a test database service instance
class TestDatabaseService {
  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.initializeTestDatabase()
  }

  db: Database.Database

  initializeTestDatabase() {
    // Create expenses table
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

    // Create budgets table
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

    // Create budget_periods table
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

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets(is_active) WHERE is_active = true',
      'CREATE INDEX IF NOT EXISTS idx_budgets_upcoming ON budgets(is_upcoming) WHERE is_upcoming = true',
      'CREATE INDEX IF NOT EXISTS idx_budget_periods_status ON budget_periods(status)',
      'CREATE INDEX IF NOT EXISTS idx_budget_periods_dates ON budget_periods(start_date, end_date)',
      'CREATE INDEX IF NOT EXISTS idx_budget_periods_budget_id ON budget_periods(budget_id)',
      'CREATE INDEX IF NOT EXISTS idx_expenses_budget_period_id ON expenses(budget_period_id)',
      'CREATE INDEX IF NOT EXISTS idx_expenses_timestamp ON expenses(timestamp)'
    ]

    indexes.forEach(indexQuery => {
      this.db.exec(indexQuery)
    })
  }

  // Budget CRUD methods
  createBudget(budget: Partial<Budget>): Budget {
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
    
    return this.getBudgetById(Number(result.lastInsertRowid)) as Budget
  }

  getAllBudgets(): Budget[] {
    const stmt = this.db.prepare('SELECT * FROM budgets ORDER BY created_at DESC')
    return stmt.all() as Budget[]
  }

  getBudgetById(id: number): Budget | undefined {
    const stmt = this.db.prepare('SELECT * FROM budgets WHERE id = ?')
    return stmt.get(id) as Budget | undefined
  }

  getActiveBudget(): Budget | undefined {
    const stmt = this.db.prepare('SELECT * FROM budgets WHERE is_active = true LIMIT 1')
    return stmt.get() as Budget | undefined
  }

  getUpcomingBudget(): Budget | undefined {
    const stmt = this.db.prepare('SELECT * FROM budgets WHERE is_upcoming = true LIMIT 1')
    return stmt.get() as Budget | undefined
  }

  updateBudget(id: number, updates: Partial<Budget>): Budget | null {
    const allowedFields = ['name', 'amount', 'start_weekday', 'duration_days', 'is_active', 'is_upcoming', 'vacation_mode']
    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key))
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update')
    }
    
    const setClause = updateFields.map(field => `${field} = ?`).join(', ')
    const values = updateFields.map(field => {
      const value = updates[field as keyof typeof updates]
      // Convert boolean values to integers for SQLite
      if (typeof value === 'boolean') {
        return value ? 1 : 0
      }
      return value
    })
    values.push(new Date().toISOString())
    values.push(id)
    
    const stmt = this.db.prepare(`
      UPDATE budgets 
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `)
    
    const result = stmt.run(...values)
    return result.changes > 0 ? this.getBudgetById(id) as Budget : null
  }

  deleteBudget(id: number): { deleted: boolean, id: number } {
    const stmt = this.db.prepare('DELETE FROM budgets WHERE id = ?')
    const result = stmt.run(id)
    return { deleted: result.changes > 0, id }
  }

  // Budget period methods
  createBudgetPeriod(period: any): any {
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

  getBudgetPeriods(budgetId?: number): any[] {
    let query = `
      SELECT bp.*, b.name as budget_name,
             COALESCE(SUM(e.amount), 0) as actual_spent
      FROM budget_periods bp
      JOIN budgets b ON b.id = bp.budget_id
      LEFT JOIN expenses e ON e.budget_period_id = bp.id
    `
    const params: any[] = []
    
    if (budgetId) {
      query += ' WHERE bp.budget_id = ?'
      params.push(budgetId)
    }
    
    query += ' GROUP BY bp.id ORDER BY bp.start_date DESC'
    
    const stmt = this.db.prepare(query)
    return stmt.all(...params)
  }

  getCurrentBudgetPeriod(): any {
    const stmt = this.db.prepare(`
      SELECT bp.*, b.name as budget_name,
             COALESCE(SUM(e.amount), 0) as actual_spent
      FROM budget_periods bp
      JOIN budgets b ON b.id = bp.budget_id
      LEFT JOIN expenses e ON e.budget_period_id = bp.id
      WHERE bp.status = 'active'
      GROUP BY bp.id
      LIMIT 1
    `)
    return stmt.get()
  }

  updateBudgetPeriodStatus(id: number, status: string): boolean {
    const stmt = this.db.prepare('UPDATE budget_periods SET status = ? WHERE id = ?')
    const result = stmt.run(status, id)
    return result.changes > 0
  }

  // Expense methods
  addExpense(expense: Partial<Expense>): Expense {
    const stmt = this.db.prepare(`
      INSERT INTO expenses (amount, latitude, longitude, place_id, place_name, place_address, timestamp, budget_period_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      expense.amount,
      expense.latitude,
      expense.longitude,
      expense.place_id,
      expense.place_name,
      expense.place_address,
      expense.timestamp,
      expense.budget_period_id || null
    )
    
    return this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid) as Expense
  }

  getOrphanExpenses() {
    const stmt = this.db.prepare('SELECT * FROM expenses WHERE budget_period_id IS NULL ORDER BY timestamp DESC')
    return stmt.all()
  }

  associateExpenseWithPeriod(expenseId: number, periodId: number) {
    const stmt = this.db.prepare('UPDATE expenses SET budget_period_id = ? WHERE id = ?')
    const result = stmt.run(periodId, expenseId)
    return result.changes > 0
  }

  close() {
    this.db.close()
  }
}

describe('Budget Database CRUD Tests', () => {
  let testDbService: TestDatabaseService
  let testDbPath: string

  beforeAll(() => {
    testDbPath = path.join(process.cwd(), 'test-budget-db.sqlite')
    
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    
    testDbService = new TestDatabaseService(testDbPath)
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

  describe('Budget CRUD Operations', () => {
    const sampleBudget = {
      name: 'Test Weekly Budget',
      amount: 500,
      start_weekday: 1,
      duration_days: 7
    }

    it('should create a budget successfully', () => {
      const created = testDbService.createBudget(sampleBudget)
      
      expect(created).toMatchObject(sampleBudget)
      expect(created.id).toBeTypeOf('number')
      expect(created.is_active).toBe(0)
      expect(created.is_upcoming).toBe(0)
      expect(created.vacation_mode).toBe(0)
    })

    it('should retrieve all budgets', () => {
      testDbService.createBudget(sampleBudget)
      testDbService.createBudget({ ...sampleBudget, name: 'Budget 2' })
      
      const budgets = testDbService.getAllBudgets()
      
      expect(budgets).toHaveLength(2)
      expect(budgets.map(b => b.name)).toContain('Budget 2')
      expect(budgets.map(b => b.name)).toContain('Test Weekly Budget')
    })

    it('should retrieve budget by ID', () => {
      const created = testDbService.createBudget(sampleBudget)
      const retrieved = testDbService.getBudgetById(created.id)
      
      expect(retrieved).toMatchObject(sampleBudget)
      expect((retrieved as any).id).toBe(created.id)
    })

    it('should return null for non-existent budget ID', () => {
      const retrieved = testDbService.getBudgetById(999)
      expect(retrieved).toBeUndefined()
    })

    it('should get active budget', () => {
      testDbService.createBudget(sampleBudget)
      testDbService.createBudget({ ...sampleBudget, name: 'Active Budget', is_active: true })
      
      const activeBudget = testDbService.getActiveBudget()
      
      expect(activeBudget).not.toBeUndefined()
      expect((activeBudget as any).name).toBe('Active Budget')
      expect((activeBudget as any).is_active).toBe(1) // SQLite returns 1 for true
    })

    it('should get upcoming budget', () => {
      testDbService.createBudget(sampleBudget)
      testDbService.createBudget({ ...sampleBudget, name: 'Upcoming Budget', is_upcoming: true })
      
      const upcomingBudget = testDbService.getUpcomingBudget()
      
      expect(upcomingBudget).not.toBeUndefined()
      expect((upcomingBudget as any).name).toBe('Upcoming Budget')
      expect((upcomingBudget as any).is_upcoming).toBe(1) // SQLite returns 1 for true
    })

    it('should update budget successfully', () => {
      const created = testDbService.createBudget(sampleBudget)
      const updates = { name: 'Updated Budget', amount: 750 }
      
      const updated = testDbService.updateBudget(created.id, updates)
      
      expect(updated).not.toBeNull()
      expect((updated as any).name).toBe('Updated Budget')
      expect((updated as any).amount).toBe(750)
      expect((updated as any).start_weekday).toBe(1) // Unchanged fields remain
    })

    it('should reject update with no valid fields', () => {
      const created = testDbService.createBudget(sampleBudget)
      
      expect(() => {
        testDbService.updateBudget(created.id, { invalid_field: 'value' } as any)
      }).toThrow('No valid fields to update')
    })

    it('should return null when updating non-existent budget', () => {
      const updated = testDbService.updateBudget(999, { name: 'Non-existent' })
      expect(updated).toBeNull()
    })

    it('should delete budget successfully', () => {
      const created = testDbService.createBudget(sampleBudget)
      const deleteResult = testDbService.deleteBudget(created.id)
      
      expect(deleteResult.deleted).toBe(true)
      expect(deleteResult.id).toBe(created.id)
      
      // Verify budget is actually deleted
      const retrieved = testDbService.getBudgetById(created.id)
      expect(retrieved).toBeUndefined()
    })

    it('should handle deleting non-existent budget', () => {
      const deleteResult = testDbService.deleteBudget(999)
      expect(deleteResult.deleted).toBe(false)
    })
  })

  describe('Budget Period CRUD Operations', () => {
    let testBudget: any

    beforeEach(() => {
      testBudget = testDbService.createBudget({
        name: 'Test Budget',
        amount: 500,
        start_weekday: 1,
        duration_days: 7
      })
    })

    const samplePeriod = {
      budget_id: 0, // Will be set in tests
      start_date: '2025-07-21',
      end_date: '2025-07-27',
      target_amount: 500,
      status: 'active'
    }

    it('should create budget period successfully', () => {
      const periodData = { ...samplePeriod, budget_id: testBudget.id }
      const created = testDbService.createBudgetPeriod(periodData)
      
      expect(created).toMatchObject(periodData)
      expect(created.id).toBeTypeOf('number')
    })

    it('should retrieve budget periods', () => {
      const periodData = { ...samplePeriod, budget_id: testBudget.id }
      testDbService.createBudgetPeriod(periodData)
      
      const periods = testDbService.getBudgetPeriods()
      
      expect(periods).toHaveLength(1)
      expect(periods[0]).toMatchObject(periodData)
      expect((periods[0] as any).budget_name).toBe('Test Budget')
      expect((periods[0] as any).actual_spent).toBe(0)
    })

    it('should retrieve periods for specific budget', () => {
      const secondBudget = testDbService.createBudget({
        name: 'Second Budget',
        amount: 300,
        start_weekday: 2,
        duration_days: 14
      })

      testDbService.createBudgetPeriod({ ...samplePeriod, budget_id: testBudget.id })
      testDbService.createBudgetPeriod({ ...samplePeriod, budget_id: secondBudget.id, start_date: '2025-07-28', end_date: '2025-08-10' })
      
      const periods = testDbService.getBudgetPeriods(testBudget.id)
      
      expect(periods).toHaveLength(1)
      expect((periods[0] as any).budget_id).toBe(testBudget.id)
    })

    it('should get current active budget period', () => {
      testDbService.createBudgetPeriod({ ...samplePeriod, budget_id: testBudget.id, status: 'completed' })
      testDbService.createBudgetPeriod({ ...samplePeriod, budget_id: testBudget.id, status: 'active', start_date: '2025-07-22', end_date: '2025-07-28' })
      
      const currentPeriod = testDbService.getCurrentBudgetPeriod()
      
      expect(currentPeriod).not.toBeUndefined()
      expect((currentPeriod as any).status).toBe('active')
      expect((currentPeriod as any).start_date).toBe('2025-07-22')
    })

    it('should update budget period status', () => {
      const periodData = { ...samplePeriod, budget_id: testBudget.id }
      const created = testDbService.createBudgetPeriod(periodData)
      
      const updated = testDbService.updateBudgetPeriodStatus(created.id, 'completed')
      
      expect(updated).toBe(true)
      
      // Verify status was updated
      const periods = testDbService.getBudgetPeriods()
      expect((periods[0] as any).status).toBe('completed')
    })

    it('should calculate actual spent with expenses', () => {
      const periodData = { ...samplePeriod, budget_id: testBudget.id }
      const period = testDbService.createBudgetPeriod(periodData)
      
      // Add expenses associated with this period
      testDbService.addExpense({
        amount: 25.50,
        timestamp: '2025-07-22T10:00:00',
        budget_period_id: period.id
      })
      testDbService.addExpense({
        amount: 15.75,
        timestamp: '2025-07-23T14:30:00',
        budget_period_id: period.id
      })
      
      const periods = testDbService.getBudgetPeriods()
      
      expect(periods).toHaveLength(1)
      expect((periods[0] as any).actual_spent).toBe(41.25)
    })
  })

  describe('Expense-Budget Period Association', () => {
    let testBudget: any
    let testPeriod: any

    beforeEach(() => {
      testBudget = testDbService.createBudget({
        name: 'Test Budget',
        amount: 500,
        start_weekday: 1,
        duration_days: 7
      })
      
      testPeriod = testDbService.createBudgetPeriod({
        budget_id: testBudget.id,
        start_date: '2025-07-21',
        end_date: '2025-07-27',
        target_amount: 500,
        status: 'active'
      })
    })

    it('should create expense with budget period association', () => {
      const expense = testDbService.addExpense({
        amount: 45.99,
        timestamp: '2025-07-23T12:00:00',
        budget_period_id: testPeriod.id
      })
      
      expect(expense.budget_period_id).toBe(testPeriod.id)
      expect(expense.amount).toBe(45.99)
    })

    it('should create expense without budget period (orphan)', () => {
      const expense: any = testDbService.addExpense({
        amount: 30.00,
        timestamp: '2025-07-23T15:00:00'
      })
      
      expect(expense.budget_period_id).toBeNull()
    })

    it('should find orphan expenses', () => {
      testDbService.addExpense({
        amount: 25.00,
        timestamp: '2025-07-23T10:00:00',
        budget_period_id: testPeriod.id
      })
      testDbService.addExpense({
        amount: 35.00,
        timestamp: '2025-07-23T12:00:00'
      })
      
      const orphans = testDbService.getOrphanExpenses()
      
      expect(orphans).toHaveLength(1)
      expect((orphans[0] as any).amount).toBe(35.00)
      expect((orphans[0] as any).budget_period_id).toBeNull()
    })

    it('should associate expense with period', () => {
      const expense = testDbService.addExpense({
        amount: 40.00,
        timestamp: '2025-07-24T09:00:00'
      })
      
      const associated = testDbService.associateExpenseWithPeriod(expense.id, testPeriod.id)
      
      expect(associated).toBe(true)
      
      // Verify association
      const orphans = testDbService.getOrphanExpenses()
      expect(orphans).toHaveLength(0)
    })
  })

  describe('Database Constraints', () => {
    it('should enforce budget weekday constraints', () => {
      expect(() => {
        testDbService.createBudget({
          name: 'Invalid Weekday Budget',
          amount: 500,
          start_weekday: 8, // Invalid weekday
          duration_days: 7
        })
      }).toThrow()
    })

    it('should enforce budget duration constraints', () => {
      expect(() => {
        testDbService.createBudget({
          name: 'Invalid Duration Budget',
          amount: 500,
          start_weekday: 1,
          duration_days: 30 // Invalid duration
        })
      }).toThrow()
    })

    it('should enforce period status constraints', () => {
      const budget = testDbService.createBudget({
        name: 'Test Budget',
        amount: 500,
        start_weekday: 1,
        duration_days: 7
      })

      expect(() => {
        testDbService.createBudgetPeriod({
          budget_id: budget.id,
          start_date: '2025-07-21',
          end_date: '2025-07-27',
          target_amount: 500,
          status: 'invalid_status' // Invalid status
        })
      }).toThrow()
    })

    it('should enforce foreign key constraints', () => {
      expect(() => {
        testDbService.createBudgetPeriod({
          budget_id: 999, // Non-existent budget
          start_date: '2025-07-21',
          end_date: '2025-07-27',
          target_amount: 500,
          status: 'active'
        })
      }).toThrow()
    })
  })
})