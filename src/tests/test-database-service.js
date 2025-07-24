import { createTestDatabase, cleanupTestDatabase } from './test-database-setup.js'
import { 
  generateBudgetPeriods, 
  generateRetroactivePeriod, 
  updatePeriodStatuses,
  findPeriodForDate,
  calculateNextPeriodStart,
  validateBudget,
  formatDateForDB
} from '../../server/budget-utils.js'

/**
 * Test-specific database service that mimics the main DatabaseService
 * but uses an isolated test database
 */
export class TestDatabaseService {
  constructor() {
    const { db, dbPath } = createTestDatabase()
    this.db = db
    this.dbPath = dbPath
  }

  close() {
    if (this.db) {
      this.db.close()
      cleanupTestDatabase(this.dbPath)
    }
  }

  // Budget CRUD operations
  async createBudget(budget) {
    try {
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
      
      const newBudget = { id: result.lastInsertRowid, ...budget }
      console.log('Test Database: Budget created with ID:', result.lastInsertRowid)
      return Promise.resolve(newBudget)
    } catch (err) {
      console.error('Test Database: Error creating budget:', err)
      return Promise.reject(err)
    }
  }

  async updateBudget(id, updates) {
    try {
      const allowedFields = ['name', 'amount', 'start_weekday', 'duration_days', 'is_active', 'is_upcoming', 'vacation_mode']
      const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key))
      
      if (updateFields.length === 0) {
        return Promise.reject(new Error('No valid fields to update'))
      }
      
      this.db.exec('BEGIN TRANSACTION')
      
      const setClause = updateFields.map(field => `${field} = ?`).join(', ')
      const values = updateFields.map(field => {
        const value = updates[field]
        // Convert boolean values to integers for SQLite
        if (typeof value === 'boolean') {
          return value ? 1 : 0
        }
        return value
      })
      values.push(new Date().toISOString()) // updated_at
      values.push(id)
      
      const stmt = this.db.prepare(`
        UPDATE budgets 
        SET ${setClause}, updated_at = ?
        WHERE id = ?
      `)
      
      const result = stmt.run(...values)
      
      // If deactivating budget, also deactivate its active periods
      if (result.changes > 0 && updates.is_active === false) {
        const deactivatePeriodsStmt = this.db.prepare(`
          UPDATE budget_periods 
          SET status = 'completed' 
          WHERE budget_id = ? AND status = 'active'
        `)
        deactivatePeriodsStmt.run(id)
        console.log('Test Database: Deactivated budget periods for budget', id)
      }
      
      this.db.exec('COMMIT')
      
      if (result.changes > 0) {
        return this.getBudgetById(id)
      } else {
        return Promise.resolve(null)
      }
    } catch (err) {
      this.db.exec('ROLLBACK')
      console.error('Test Database: Error updating budget:', err)
      return Promise.reject(err)
    }
  }

  async getBudgetById(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM budgets WHERE id = ?')
      const budget = stmt.get(id)
      return Promise.resolve(budget || null)
    } catch (err) {
      console.error('Test Database: Error fetching budget:', err)
      return Promise.reject(err)
    }
  }

  async activateBudget(id) {
    try {
      this.db.exec('BEGIN TRANSACTION')

      // Deactivate current active budget
      const deactivateStmt = this.db.prepare('UPDATE budgets SET is_active = 0 WHERE is_active = 1')
      deactivateStmt.run()

      // Activate the new budget
      const activateStmt = this.db.prepare('UPDATE budgets SET is_active = 1 WHERE id = ?')
      const result = activateStmt.run(id)

      if (result.changes === 0) {
        throw new Error('Budget not found')
      }

      // Create initial budget period for the activated budget
      const budget = await this.getBudgetById(id)
      if (budget) {
        const periods = generateBudgetPeriods(budget, new Date(), 1)
        if (periods.length > 0) {
          await this.createBudgetPeriod(periods[0])
        }
      }

      this.db.exec('COMMIT')
      console.log(`Test Database: Activated budget ${id}`)
      return Promise.resolve(true)
    } catch (err) {
      this.db.exec('ROLLBACK')
      console.error('Test Database: Error activating budget:', err)
      return Promise.reject(err)
    }
  }

  async createBudgetPeriod(period) {
    try {
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
      
      const newPeriod = { id: result.lastInsertRowid, ...period }
      console.log('Test Database: Budget period created with ID:', result.lastInsertRowid)
      return Promise.resolve(newPeriod)
    } catch (err) {
      console.error('Test Database: Error creating budget period:', err)
      return Promise.reject(err)
    }
  }

  async getCurrentBudgetPeriod() {
    try {
      const stmt = this.db.prepare(`
        SELECT bp.*, b.name as budget_name, b.vacation_mode,
               COALESCE(SUM(e.amount), 0) as actual_spent
        FROM budget_periods bp
        JOIN budgets b ON b.id = bp.budget_id
        LEFT JOIN expenses e ON e.budget_period_id = bp.id
        WHERE bp.status = 'active'
        GROUP BY bp.id
        LIMIT 1
      `)
      const period = stmt.get()
      return Promise.resolve(period || null)
    } catch (err) {
      console.error('Test Database: Error fetching current budget period:', err)
      return Promise.reject(err)
    }
  }

  async addExpense(expense) {
    try {
      console.log('Test Database: Adding expense with data:', JSON.stringify(expense, null, 2))
      
      // Get current active budget period for immediate association
      let budgetPeriodId = null
      try {
        const currentPeriod = await this.getCurrentBudgetPeriod()
        if (currentPeriod) {
          // Check if budget is in vacation mode
          if (currentPeriod.vacation_mode) {
            console.log('Test Database: Budget is in vacation mode, creating orphan expense')
            budgetPeriodId = null // Don't associate with budget period during vacation
          } else {
            budgetPeriodId = currentPeriod.id
            console.log('Test Database: Associating expense with budget period:', budgetPeriodId)
          }
        }
      } catch (err) {
        // If no current period exists, expense will be created as orphan
        console.log('Test Database: No active budget period found, creating orphan expense')
      }
      
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
        budgetPeriodId
      )
      
      console.log('Test Database: Expense saved with ID:', result.lastInsertRowid)
      return Promise.resolve({ id: result.lastInsertRowid, ...expense })
    } catch (err) {
      console.error('Test Database: Error adding expense:', err)
      return Promise.reject(err)
    }
  }
}