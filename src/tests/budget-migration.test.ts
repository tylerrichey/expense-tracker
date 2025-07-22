import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

// Import the actual migration
import { up as budgetMigrationUp, down as budgetMigrationDown } from '../../server/migrations/001-budget-system.js'

describe('Budget Migration Tests', () => {
  let db: Database.Database
  let testDbPath: string

  beforeAll(() => {
    testDbPath = path.join(process.cwd(), 'test-migration.sqlite')
    
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    
    db = new Database(testDbPath)
    
    // Create basic expenses table first (as it would exist before migration)
    db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        latitude REAL,
        longitude REAL,
        place_id TEXT,
        place_name TEXT,
        place_address TEXT,
        receipt_image BLOB,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  })

  afterAll(() => {
    db.close()
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  describe('Migration UP', () => {
    it('should create budgets table with correct schema', async () => {
      await budgetMigrationUp(db)
      
      // Check if budgets table exists with correct columns
      const tableInfo = db.prepare("PRAGMA table_info(budgets)").all()
      
      const columnNames = tableInfo.map((col: any) => col.name)
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('name')
      expect(columnNames).toContain('amount')
      expect(columnNames).toContain('start_weekday')
      expect(columnNames).toContain('duration_days')
      expect(columnNames).toContain('created_at')
      expect(columnNames).toContain('updated_at')
      expect(columnNames).toContain('is_active')
      expect(columnNames).toContain('is_upcoming')
      expect(columnNames).toContain('vacation_mode')
    })

    it('should create budget_periods table with correct schema', () => {
      const tableInfo = db.prepare("PRAGMA table_info(budget_periods)").all()
      
      const columnNames = tableInfo.map((col: any) => col.name)
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('budget_id')
      expect(columnNames).toContain('start_date')
      expect(columnNames).toContain('end_date')
      expect(columnNames).toContain('target_amount')
      expect(columnNames).toContain('actual_spent')
      expect(columnNames).toContain('status')
      expect(columnNames).toContain('created_at')
    })

    it('should add budget_period_id column to expenses table', () => {
      const tableInfo = db.prepare("PRAGMA table_info(expenses)").all()
      
      const columnNames = tableInfo.map((col: any) => col.name)
      expect(columnNames).toContain('budget_period_id')
    })

    it('should create required indexes', () => {
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all()
      
      const indexNames = indexes.map((idx: any) => idx.name)
      expect(indexNames).toContain('idx_budgets_active')
      expect(indexNames).toContain('idx_budgets_upcoming')
      expect(indexNames).toContain('idx_budget_periods_status')
      expect(indexNames).toContain('idx_budget_periods_dates')
      expect(indexNames).toContain('idx_budget_periods_budget_id')
      expect(indexNames).toContain('idx_expenses_budget_period_id')
      expect(indexNames).toContain('idx_expenses_timestamp')
    })

    it('should enforce foreign key constraints', () => {
      // Insert a budget first
      db.prepare(`
        INSERT INTO budgets (name, amount, start_weekday, duration_days)
        VALUES ('Test Budget', 100, 1, 7)
      `).run()

      // Should be able to create period with valid budget_id
      const validInsert = db.prepare(`
        INSERT INTO budget_periods (budget_id, start_date, end_date, target_amount)
        VALUES (1, '2025-07-21', '2025-07-27', 100)
      `)
      expect(() => validInsert.run()).not.toThrow()

      // Should fail with invalid budget_id
      const invalidInsert = db.prepare(`
        INSERT INTO budget_periods (budget_id, start_date, end_date, target_amount)
        VALUES (999, '2025-07-21', '2025-07-27', 100)
      `)
      expect(() => invalidInsert.run()).toThrow()
    })

    it('should enforce check constraints', () => {
      // Invalid weekday should fail
      const invalidWeekday = db.prepare(`
        INSERT INTO budgets (name, amount, start_weekday, duration_days)
        VALUES ('Invalid Weekday', 100, 8, 7)
      `)
      expect(() => invalidWeekday.run()).toThrow()

      // Invalid duration should fail
      const invalidDuration = db.prepare(`
        INSERT INTO budgets (name, amount, start_weekday, duration_days)
        VALUES ('Invalid Duration', 100, 1, 30)
      `)
      expect(() => invalidDuration.run()).toThrow()

      // Invalid status should fail
      const validBudget = db.prepare(`
        INSERT INTO budgets (name, amount, start_weekday, duration_days)
        VALUES ('Valid Budget', 100, 2, 14)
      `).run()

      const invalidStatus = db.prepare(`
        INSERT INTO budget_periods (budget_id, start_date, end_date, target_amount, status)
        VALUES (?, '2025-07-21', '2025-07-27', 100, 'invalid')
      `)
      expect(() => invalidStatus.run(validBudget.lastInsertRowid)).toThrow()
    })
  })

  describe('Basic CRUD Operations After Migration', () => {
    it('should support basic budget operations', () => {
      // Insert budget
      const insertBudget = db.prepare(`
        INSERT INTO budgets (name, amount, start_weekday, duration_days, is_active)
        VALUES ('CRUD Test Budget', 250, 1, 7, true)
      `)
      const budgetResult = insertBudget.run()
      expect(budgetResult.lastInsertRowid).toBeDefined()

      // Read budget
      const selectBudget = db.prepare('SELECT * FROM budgets WHERE id = ?')
      const budget = selectBudget.get(budgetResult.lastInsertRowid)
      expect(budget.name).toBe('CRUD Test Budget')
      expect(budget.amount).toBe(250)
      expect(budget.is_active).toBe(1) // SQLite returns 1 for true

      // Update budget
      const updateBudget = db.prepare(`
        UPDATE budgets SET amount = 300 WHERE id = ?
      `)
      updateBudget.run(budgetResult.lastInsertRowid)

      const updatedBudget = selectBudget.get(budgetResult.lastInsertRowid)
      expect(updatedBudget.amount).toBe(300)

      // Delete budget
      const deleteBudget = db.prepare('DELETE FROM budgets WHERE id = ?')
      const deleteResult = deleteBudget.run(budgetResult.lastInsertRowid)
      expect(deleteResult.changes).toBe(1)
    })

    it('should support budget period operations', () => {
      // Create budget first
      const budgetId = db.prepare(`
        INSERT INTO budgets (name, amount, start_weekday, duration_days)
        VALUES ('Period Test Budget', 400, 2, 14)
      `).run().lastInsertRowid

      // Insert period
      const insertPeriod = db.prepare(`
        INSERT INTO budget_periods (budget_id, start_date, end_date, target_amount, status)
        VALUES (?, '2025-07-22', '2025-08-04', 400, 'active')
      `)
      const periodResult = insertPeriod.run(budgetId)

      // Verify period was created
      const selectPeriod = db.prepare('SELECT * FROM budget_periods WHERE id = ?')
      const period = selectPeriod.get(periodResult.lastInsertRowid)
      expect(period.budget_id).toBe(budgetId)
      expect(period.status).toBe('active')
      expect(period.target_amount).toBe(400)
    })

    it('should support expense-period association', () => {
      // Create budget and period
      const budgetId = db.prepare(`
        INSERT INTO budgets (name, amount, start_weekday, duration_days)
        VALUES ('Expense Test Budget', 150, 3, 7)
      `).run().lastInsertRowid

      const periodId = db.prepare(`
        INSERT INTO budget_periods (budget_id, start_date, end_date, target_amount)
        VALUES (?, '2025-07-23', '2025-07-29', 150)
      `).run(budgetId).lastInsertRowid

      // Create expense with period association
      const expenseId = db.prepare(`
        INSERT INTO expenses (amount, timestamp, budget_period_id)
        VALUES (35.50, '2025-07-24T10:30:00', ?)
      `).run(periodId).lastInsertRowid

      // Verify association
      const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId)
      expect(expense.budget_period_id).toBe(periodId)

      // Test join query
      const joinQuery = db.prepare(`
        SELECT e.amount, bp.target_amount, b.name
        FROM expenses e
        JOIN budget_periods bp ON e.budget_period_id = bp.id
        JOIN budgets b ON bp.budget_id = b.id
        WHERE e.id = ?
      `)
      const joinResult = joinQuery.get(expenseId)
      expect(joinResult.amount).toBe(35.50)
      expect(joinResult.target_amount).toBe(150)
      expect(joinResult.name).toBe('Expense Test Budget')
    })
  })

  describe('Data Integrity', () => {
    it('should maintain referential integrity on cascade delete', () => {
      // Create budget and period
      const budgetId = db.prepare(`
        INSERT INTO budgets (name, amount, start_weekday, duration_days)
        VALUES ('Cascade Test Budget', 100, 1, 7)
      `).run().lastInsertRowid

      const periodId = db.prepare(`
        INSERT INTO budget_periods (budget_id, start_date, end_date, target_amount)
        VALUES (?, '2025-07-21', '2025-07-27', 100)
      `).run(budgetId).lastInsertRowid

      // Verify period exists
      const periodsBefore = db.prepare('SELECT COUNT(*) as count FROM budget_periods WHERE budget_id = ?').get(budgetId)
      expect(periodsBefore.count).toBe(1)

      // Delete budget (should cascade to periods)
      db.prepare('DELETE FROM budgets WHERE id = ?').run(budgetId)

      // Verify period was deleted
      const periodsAfter = db.prepare('SELECT COUNT(*) as count FROM budget_periods WHERE budget_id = ?').get(budgetId)
      expect(periodsAfter.count).toBe(0)
    })

    it('should set expense budget_period_id to NULL when period is deleted', () => {
      // Create budget, period, and expense
      const budgetId = db.prepare(`
        INSERT INTO budgets (name, amount, start_weekday, duration_days)
        VALUES ('Null Test Budget', 100, 1, 7)
      `).run().lastInsertRowid

      const periodId = db.prepare(`
        INSERT INTO budget_periods (budget_id, start_date, end_date, target_amount)
        VALUES (?, '2025-07-21', '2025-07-27', 100)
      `).run(budgetId).lastInsertRowid

      const expenseId = db.prepare(`
        INSERT INTO expenses (amount, timestamp, budget_period_id)
        VALUES (25.00, '2025-07-22T12:00:00', ?)
      `).run(periodId).lastInsertRowid

      // Verify expense is associated
      const expenseBefore = db.prepare('SELECT budget_period_id FROM expenses WHERE id = ?').get(expenseId)
      expect(expenseBefore.budget_period_id).toBe(periodId)

      // Delete budget (cascades to period)
      db.prepare('DELETE FROM budgets WHERE id = ?').run(budgetId)

      // Verify expense budget_period_id is now NULL
      const expenseAfter = db.prepare('SELECT budget_period_id FROM expenses WHERE id = ?').get(expenseId)
      expect(expenseAfter.budget_period_id).toBeNull()
    })
  })

  describe('Migration DOWN (Rollback)', () => {
    it('should successfully rollback migration', async () => {
      // Verify tables exist before rollback
      const tablesBeforeDown = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' 
        AND name IN ('budgets', 'budget_periods')
      `).all()
      expect(tablesBeforeDown).toHaveLength(2)

      // Run migration down
      await budgetMigrationDown(db)

      // Verify budget tables are removed
      const tablesAfterDown = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' 
        AND name IN ('budgets', 'budget_periods')
      `).all()
      expect(tablesAfterDown).toHaveLength(0)

      // Verify expenses table still exists but without budget_period_id
      const expensesTable = db.prepare("PRAGMA table_info(expenses)").all()
      const expenseColumnNames = expensesTable.map((col: any) => col.name)
      expect(expenseColumnNames).not.toContain('budget_period_id')
      
      // But should still have original columns
      expect(expenseColumnNames).toContain('id')
      expect(expenseColumnNames).toContain('amount')
      expect(expenseColumnNames).toContain('timestamp')
    })
  })
})