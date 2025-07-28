import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync, readdirSync } from 'fs'
import { 
  generateBudgetPeriods, 
  generateRetroactivePeriod, 
  updatePeriodStatuses,
  findPeriodForDate,
  calculateNextPeriodStart,
  validateBudget,
  formatDateForDB,
  setDatabaseInstance
} from './budget-utils.js'
import { logger } from './logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class DatabaseService {
  constructor() {
    // Use different database paths based on environment
    let dbPath
    if (process.env.NODE_ENV === 'production') {
      dbPath = '/app/data/expenses.db'
    } else if (process.env.NODE_ENV === 'development') {
      // Use test database in development mode
      dbPath = join(__dirname, 'expenses-test.db')
    } else {
      // Default to regular database
      dbPath = join(__dirname, 'expenses.db')
    }
    
    // Ensure data directory exists in production
    if (process.env.NODE_ENV === 'production') {
      const dataDir = dirname(dbPath)
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true })
      }
    }
    
    logger.log('info', `📁 Using database: ${dbPath}`)
    this.dbPath = dbPath
    this.db = new Database(dbPath)
    this.initializeDatabase()
    
    // Set database instance for timezone-aware budget utilities
    setDatabaseInstance(this.db)
  }

  initializeDatabase() {
    const createTableQuery = `
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
    `
    
    try {
      this.db.exec(createTableQuery)
      logger.log('info', 'Database initialized successfully')
      // Add new columns if they don't exist (for existing databases)
      this.addMissingColumns()
      // Run migrations
      this.runMigrations()
    } catch (err) {
      console.error('Error creating table:', err)
    }
  }

  getDatabasePath() {
    return this.dbPath
  }

  addMissingColumns() {
    const columns = [
      'ALTER TABLE expenses ADD COLUMN place_id TEXT',
      'ALTER TABLE expenses ADD COLUMN place_name TEXT', 
      'ALTER TABLE expenses ADD COLUMN place_address TEXT',
      'ALTER TABLE expenses ADD COLUMN receipt_image BLOB'
    ]
    
    columns.forEach(query => {
      try {
        this.db.exec(query)
      } catch (err) {
        // Ignore errors for existing columns
        if (!err.message.includes('duplicate column name')) {
          logger.log('error', 'Error adding column:', { error: err.message })
        }
      }
    })
  }

  async runMigrations() {
    // Create migrations table to track applied migrations
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Get list of applied migrations
    const appliedMigrations = this.db.prepare('SELECT name FROM migrations').all().map(row => row.name)
    
    // Get list of available migrations
    const migrationsDir = join(__dirname, 'migrations')
    if (!existsSync(migrationsDir)) {
      logger.log('info', 'No migrations directory found, skipping migrations')
      return
    }

    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort()

    for (const migrationFile of migrationFiles) {
      const migrationName = migrationFile.replace('.js', '')
      
      if (appliedMigrations.includes(migrationName)) {
        continue // Skip already applied migrations
      }

      logger.log('info', `🔄 Running migration: ${migrationName}`)
      
      try {
        const migration = await import(`./migrations/${migrationFile}`)
        if (migration.up) {
          await migration.up(this.db)
          
          // Record that this migration was applied
          this.db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationName)
          logger.log('info', `✅ Migration completed: ${migrationName}`)
        } else {
          logger.log('warn', `⚠️ Migration ${migrationName} has no 'up' function`)
        }
      } catch (err) {
        logger.log('error', `❌ Migration failed: ${migrationName}`, { error: err.message })
        throw err
      }
    }
  }

  async addExpense(expense) {
    try {
      // Log expense addition for debugging (only when DEBUG_EXPENSES is set)
      if (process.env.DEBUG_EXPENSES) {
        logger.log('info', '🔍 EXPENSE DEBUG: Adding expense with data:', { 
          amount: expense.amount, 
          timestamp: expense.timestamp, 
          place_name: expense.place_name 
        })
      }
      
      // Find the correct budget period based on expense timestamp
      let budgetPeriodId = null
      try {
        // First, get all available periods for debugging
        const allPeriods = await this.getBudgetPeriods()
        if (process.env.DEBUG_EXPENSES) {
          logger.log('info', '🔍 EXPENSE DEBUG: Available budget periods:', 
            allPeriods.map(p => ({
              id: p.id,
              start_date: p.start_date,
              end_date: p.end_date,
              status: p.status,
              budget_name: p.budget_name
            }))
          )
        }
        
        const matchingPeriod = await this.findPeriodForExpense(expense.timestamp)
        if (process.env.DEBUG_EXPENSES) {
          logger.log('info', '🔍 EXPENSE DEBUG: findPeriodForExpense result:', matchingPeriod ? {
            id: matchingPeriod.id,
            start_date: matchingPeriod.start_date,
            end_date: matchingPeriod.end_date,
            status: matchingPeriod.status,
            budget_id: matchingPeriod.budget_id
          } : 'NO MATCHING PERIOD')
        }
        
        if (matchingPeriod) {
          // Check if the associated budget is in vacation mode
          const budget = await this.getBudgetById(matchingPeriod.budget_id)
          if (process.env.DEBUG_EXPENSES) {
            logger.log('info', '🔍 EXPENSE DEBUG: Associated budget:', budget ? {
              id: budget.id,
              name: budget.name,
              vacation_mode: budget.vacation_mode,
              is_active: budget.is_active
            } : 'NO BUDGET FOUND')
          }
          
          if (budget && budget.vacation_mode) {
            if (process.env.DEBUG_EXPENSES) {
              logger.log('info', '🔍 EXPENSE DEBUG: Budget is in vacation mode, creating orphan expense')
            }
            budgetPeriodId = null // Don't associate with budget period during vacation
          } else {
            budgetPeriodId = matchingPeriod.id
            if (process.env.DEBUG_EXPENSES) {
              logger.log('info', '🔍 EXPENSE DEBUG: Associating expense with budget period:', { 
                budgetPeriodId, 
                expenseDate: expense.timestamp,
                periodStart: matchingPeriod.start_date,
                periodEnd: matchingPeriod.end_date,
                periodStatus: matchingPeriod.status
              })
            }
          }
        } else {
          if (process.env.DEBUG_EXPENSES) {
            logger.log('info', '🔍 EXPENSE DEBUG: No matching budget period found for expense date:', { 
              expenseDate: expense.timestamp,
              expenseDateParsed: new Date(expense.timestamp).toISOString()
            })
          }
        }
      } catch (err) {
        // If no matching period exists, expense will be created as orphan
        if (process.env.DEBUG_EXPENSES) {
          logger.log('error', '🔍 EXPENSE DEBUG: Error finding budget period for expense date:', { 
            error: err.message,
            expenseDate: expense.timestamp,
            stack: err.stack
          })
        }
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
      
      // Log the final result for debugging (only when DEBUG_EXPENSES is set)
      if (process.env.DEBUG_EXPENSES) {
        logger.log('info', '🔍 EXPENSE DEBUG: Expense saved successfully:', { 
          expenseId: result.lastInsertRowid,
          assignedToBudgetPeriodId: budgetPeriodId,
          timestamp: expense.timestamp,
          amount: expense.amount
        })
      }
      
      return Promise.resolve({ id: result.lastInsertRowid, ...expense })
    } catch (err) {
      logger.log('error', 'Database: Error adding expense:', { error: err.message })
      return Promise.reject(err)
    }
  }

  getAllExpenses() {
    try {
      const stmt = this.db.prepare('SELECT *, (receipt_image IS NOT NULL) as has_image FROM expenses ORDER BY timestamp DESC')
      const rows = stmt.all()
      
      const expenses = rows.map(row => ({
        id: row.id,
        amount: row.amount,
        latitude: row.latitude,
        longitude: row.longitude,
        place_id: row.place_id,
        place_name: row.place_name,
        place_address: row.place_address,
        has_image: Boolean(row.has_image),
        timestamp: new Date(row.timestamp)
      }))
      
      return Promise.resolve(expenses)
    } catch (err) {
      return Promise.reject(err)
    }
  }

  getRecentExpenses(days = 7) {
    try {
      const stmt = this.db.prepare(`
        SELECT *, (receipt_image IS NOT NULL) as has_image FROM expenses 
        WHERE timestamp >= datetime('now', '-${days} days')
        ORDER BY timestamp DESC
      `)
      const rows = stmt.all()
      
      const expenses = rows.map(row => ({
        id: row.id,
        amount: row.amount,
        latitude: row.latitude,
        longitude: row.longitude,
        place_id: row.place_id,
        place_name: row.place_name,
        place_address: row.place_address,
        has_image: Boolean(row.has_image),
        timestamp: new Date(row.timestamp)
      }))
      
      return Promise.resolve(expenses)
    } catch (err) {
      return Promise.reject(err)
    }
  }

  deleteExpense(id) {
    try {
      const stmt = this.db.prepare('DELETE FROM expenses WHERE id = ?')
      const result = stmt.run(id)
      
      return Promise.resolve({ deleted: result.changes > 0, id })
    } catch (err) {
      return Promise.reject(err)
    }
  }

  getExpenseSummary(days) {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COALESCE(SUM(amount), 0) as total,
          COUNT(*) as count
        FROM expenses 
        WHERE timestamp >= datetime('now', '-${days} days')
      `)
      const result = stmt.get()
      
      return Promise.resolve({
        total: result.total || 0,
        count: result.count || 0
      })
    } catch (err) {
      return Promise.reject(err)
    }
  }

  getCurrentMonthSummary() {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COALESCE(SUM(amount), 0) as total,
          COUNT(*) as count
        FROM expenses 
        WHERE strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')
      `)
      const result = stmt.get()
      
      return Promise.resolve({
        total: result.total || 0,
        count: result.count || 0
      })
    } catch (err) {
      return Promise.reject(err)
    }
  }

  getAllUniquePlaces() {
    try {
      const stmt = this.db.prepare(`
        SELECT DISTINCT place_name
        FROM expenses 
        WHERE place_name IS NOT NULL AND place_name != ''
        ORDER BY place_name ASC
      `)
      const rows = stmt.all()
      
      const places = rows.map(row => row.place_name)
      
      return Promise.resolve(places)
    } catch (err) {
      return Promise.reject(err)
    }
  }

  updateExpenseImage(expenseId, imageBuffer) {
    try {
      const stmt = this.db.prepare(`
        UPDATE expenses 
        SET receipt_image = ?
        WHERE id = ?
      `)
      
      const result = stmt.run(imageBuffer, expenseId)
      
      if (result.changes === 0) {
        return Promise.resolve(false) // Expense not found
      }
      
      logger.log('info', `Database: Updated expense ${expenseId} with image (${imageBuffer.length} bytes)`)
      return Promise.resolve(true)
    } catch (err) {
      logger.log('error', 'Database: Error updating expense image:', { error: err.message })
      return Promise.reject(err)
    }
  }

  getExpenseImage(expenseId) {
    try {
      const stmt = this.db.prepare(`
        SELECT receipt_image 
        FROM expenses 
        WHERE id = ? AND receipt_image IS NOT NULL
      `)
      
      const result = stmt.get(expenseId)
      
      if (!result || !result.receipt_image) {
        return Promise.resolve(null)
      }
      
      return Promise.resolve(result.receipt_image)
    } catch (err) {
      logger.log('error', 'Database: Error retrieving expense image:', { error: err.message })
      return Promise.reject(err)
    }
  }

  // ==================== BUDGET CRUD OPERATIONS ====================

  createBudget(budget) {
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
      logger.log('info', 'Database: Budget created with ID:', { id: result.lastInsertRowid })
      return Promise.resolve(newBudget)
    } catch (err) {
      logger.log('error', 'Database: Error creating budget:', { error: err.message })
      return Promise.reject(err)
    }
  }

  getAllBudgets() {
    try {
      const stmt = this.db.prepare(`
        SELECT b.*, 
               CASE WHEN bp.budget_id IS NOT NULL THEN 1 ELSE 0 END as has_history
        FROM budgets b
        LEFT JOIN (
          SELECT DISTINCT budget_id 
          FROM budget_periods 
          WHERE status != 'pending'
        ) bp ON b.id = bp.budget_id
        ORDER BY b.created_at DESC
      `)
      const budgets = stmt.all()
      return Promise.resolve(budgets)
    } catch (err) {
      logger.log('error', 'Database: Error fetching budgets:', { error: err.message })
      return Promise.reject(err)
    }
  }

  getBudgetById(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM budgets WHERE id = ?')
      const budget = stmt.get(id)
      return Promise.resolve(budget || null)
    } catch (err) {
      logger.log('error', 'Database: Error fetching budget:', { error: err.message })
      return Promise.reject(err)
    }
  }

  getActiveBudget() {
    try {
      const stmt = this.db.prepare('SELECT * FROM budgets WHERE is_active = true LIMIT 1')
      const budget = stmt.get()
      return Promise.resolve(budget || null)
    } catch (err) {
      logger.log('error', 'Database: Error fetching active budget:', { error: err.message })
      return Promise.reject(err)
    }
  }

  getUpcomingBudget() {
    try {
      const stmt = this.db.prepare('SELECT * FROM budgets WHERE is_upcoming = true LIMIT 1')
      const budget = stmt.get()
      return Promise.resolve(budget || null)
    } catch (err) {
      logger.log('error', 'Database: Error fetching upcoming budget:', { error: err.message })
      return Promise.reject(err)
    }
  }

  updateBudget(id, updates) {
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
      
      if (result.changes > 0) {
        // If amount was updated and this is an active budget, sync current period target
        if (updates.amount !== undefined) {
          const budgetStmt = this.db.prepare('SELECT * FROM budgets WHERE id = ?')
          const budget = budgetStmt.get(id)
          if (budget && budget.is_active) {
            const currentPeriodStmt = this.db.prepare(`
              SELECT id FROM budget_periods 
              WHERE budget_id = ? AND status = 'active'
              LIMIT 1
            `)
            const currentPeriod = currentPeriodStmt.get(id)
            
            if (currentPeriod) {
              const updatePeriodStmt = this.db.prepare(`
                UPDATE budget_periods 
                SET target_amount = ?
                WHERE id = ?
              `)
              updatePeriodStmt.run(updates.amount, currentPeriod.id)
              logger.log('info', `Updated current period target_amount to ${updates.amount} for budget ${id}`)
            }
          }
        }
        
        this.db.exec('COMMIT')
        return this.getBudgetById(id)
      } else {
        this.db.exec('ROLLBACK')
        return Promise.resolve(null)
      }
    } catch (err) {
      this.db.exec('ROLLBACK')
      logger.log('error', 'Database: Error updating budget:', { error: err.message })
      return Promise.reject(err)
    }
  }

  deleteBudget(id) {
    try {
      // Check if budget is currently active
      const budgetStmt = this.db.prepare('SELECT is_active FROM budgets WHERE id = ?')
      const budget = budgetStmt.get(id)
      
      if (!budget) {
        return Promise.reject(new Error('Budget not found'))
      }
      
      if (budget.is_active) {
        return Promise.reject(new Error('Cannot delete active budget. Deactivate it first.'))
      }
      
      // For inactive budgets, orphan the associated expenses before deletion
      const orphanExpensesStmt = this.db.prepare(`
        UPDATE expenses 
        SET budget_period_id = NULL 
        WHERE budget_period_id IN (
          SELECT id FROM budget_periods WHERE budget_id = ?
        )
      `)
      orphanExpensesStmt.run(id)
      
      const stmt = this.db.prepare('DELETE FROM budgets WHERE id = ?')
      const result = stmt.run(id)
      
      return Promise.resolve({ deleted: result.changes > 0, id })
    } catch (err) {
      logger.log('error', 'Database: Error deleting budget:', { error: err.message })
      return Promise.reject(err)
    }
  }

  // ==================== BUDGET PERIOD OPERATIONS ====================

  createBudgetPeriod(period) {
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
      logger.log('info', 'Database: Budget period created with ID:', { id: result.lastInsertRowid })
      return Promise.resolve(newPeriod)
    } catch (err) {
      logger.log('error', 'Database: Error creating budget period:', { error: err.message })
      return Promise.reject(err)
    }
  }

  getBudgetPeriods(budgetId = null) {
    try {
      let query = `
        SELECT bp.*, b.name as budget_name,
               COALESCE(SUM(e.amount), 0) as actual_spent
        FROM budget_periods bp
        JOIN budgets b ON b.id = bp.budget_id
        LEFT JOIN expenses e ON e.budget_period_id = bp.id
      `
      const params = []
      
      if (budgetId) {
        query += ' WHERE bp.budget_id = ?'
        params.push(budgetId)
      }
      
      query += ' GROUP BY bp.id ORDER BY bp.start_date DESC'
      
      const stmt = this.db.prepare(query)
      const periods = stmt.all(...params)
      return Promise.resolve(periods)
    } catch (err) {
      logger.log('error', 'Database: Error fetching budget periods:', { error: err.message })
      return Promise.reject(err)
    }
  }

  getCurrentBudgetPeriod() {
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
      logger.log('error', 'Database: Error fetching current budget period:', { error: err.message })
      return Promise.reject(err)
    }
  }

  updateBudgetPeriodStatus(id, status) {
    try {
      const stmt = this.db.prepare(`
        UPDATE budget_periods 
        SET status = ?
        WHERE id = ?
      `)
      
      const result = stmt.run(status, id)
      return Promise.resolve(result.changes > 0)
    } catch (err) {
      logger.log('error', 'Database: Error updating budget period status:', { error: err.message })
      return Promise.reject(err)
    }
  }

  // ==================== ADVANCED BUDGET PERIOD OPERATIONS ====================

  async createBudgetWithInitialPeriod(budgetData, retroactive = false) {
    try {
      // Validate budget data
      const validation = validateBudget(budgetData)
      if (!validation.isValid) {
        return Promise.reject(new Error(`Invalid budget: ${validation.errors.join(', ')}`))
      }

      this.db.exec('BEGIN TRANSACTION')

      // Create the budget
      const budget = await this.createBudget(budgetData)

      // Generate initial period
      let period
      if (retroactive) {
        // Create retroactive period that covers current date
        period = generateRetroactivePeriod(budget)
      } else {
        // Create normal forward period
        const periods = generateBudgetPeriods(budget, new Date(), 1)
        period = periods[0]
      }

      // Save the period
      const savedPeriod = await this.createBudgetPeriod(period)

      // If retroactive, associate existing expenses with this period
      if (retroactive) {
        await this.associateExpensesWithPeriod(savedPeriod)
      }

      this.db.exec('COMMIT')
      logger.log('info', `Database: Created budget with ${retroactive ? 'retroactive' : 'normal'} period`)
      
      return Promise.resolve({
        budget,
        period: savedPeriod
      })

    } catch (err) {
      this.db.exec('ROLLBACK')
      logger.log('error', 'Database: Error creating budget with period:', { error: err.message })
      return Promise.reject(err)
    }
  }

  async createNextBudgetPeriod(budgetId) {
    try {
      // Get current active period
      const currentPeriod = await this.getCurrentBudgetPeriodForBudget(budgetId)
      if (!currentPeriod) {
        return Promise.reject(new Error('No active period found to continue from'))
      }

      // Get budget details
      const budget = await this.getBudgetById(budgetId)
      if (!budget) {
        return Promise.reject(new Error('Budget not found'))
      }

      // Calculate next period
      const nextStartDate = calculateNextPeriodStart(currentPeriod, budget.duration_days)
      const periods = generateBudgetPeriods(budget, nextStartDate, 1)
      const nextPeriod = periods[0]

      // Create the next period
      const savedPeriod = await this.createBudgetPeriod(nextPeriod)

      logger.log('info', 'Database: Created next budget period:', { id: savedPeriod.id })
      return Promise.resolve(savedPeriod)

    } catch (err) {
      logger.log('error', 'Database: Error creating next budget period:', { error: err.message })
      return Promise.reject(err)
    }
  }

  async getCurrentBudgetPeriodForBudget(budgetId) {
    try {
      const stmt = this.db.prepare(`
        SELECT bp.*, b.name as budget_name,
               COALESCE(SUM(e.amount), 0) as actual_spent
        FROM budget_periods bp
        JOIN budgets b ON b.id = bp.budget_id
        LEFT JOIN expenses e ON e.budget_period_id = bp.id
        WHERE bp.budget_id = ? AND bp.status = 'active'
        GROUP BY bp.id
        LIMIT 1
      `)
      const period = stmt.get(budgetId)
      return Promise.resolve(period || null)
    } catch (err) {
      logger.log('error', 'Database: Error fetching current budget period for budget:', { error: err.message })
      return Promise.reject(err)
    }
  }

  async associateExpensesWithPeriod(period) {
    try {
      // Find expenses that fall within this period's date range
      const stmt = this.db.prepare(`
        UPDATE expenses 
        SET budget_period_id = ?
        WHERE budget_period_id IS NULL
        AND DATE(timestamp) >= DATE(?)
        AND DATE(timestamp) <= DATE(?)
      `)

      const result = stmt.run(
        period.id,
        period.start_date,
        period.end_date
      )

      logger.log('info', `Database: Associated ${result.changes} expenses with period ${period.id}`)
      return Promise.resolve(result.changes)

    } catch (err) {
      logger.log('error', 'Database: Error associating expenses with period:', { error: err.message })
      return Promise.reject(err)
    }
  }

  async updateAllPeriodStatuses() {
    try {
      // Get all periods
      const periods = await this.getBudgetPeriods()
      
      // Update statuses based on current date
      const updatedPeriods = updatePeriodStatuses(periods)
      
      // Save updated statuses
      const updatePromises = updatedPeriods.map(period => {
        if (period.status !== periods.find(p => p.id === period.id)?.status) {
          return this.updateBudgetPeriodStatus(period.id, period.status)
        }
        return Promise.resolve(true)
      })

      await Promise.all(updatePromises)
      logger.log('info', 'Database: Updated all budget period statuses')
      return Promise.resolve(updatedPeriods)

    } catch (err) {
      logger.log('error', 'Database: Error updating period statuses:', { error: err.message })
      return Promise.reject(err)
    }
  }

  async findPeriodForExpense(expenseDate) {
    try {
      // Get all active and recent periods
      const periods = await this.getBudgetPeriods()
      const targetDate = new Date(expenseDate)
      
      if (process.env.DEBUG_EXPENSES) {
        logger.log('info', '🔍 EXPENSE DEBUG: findPeriodForExpense called:', {
          expenseDate,
          targetDateParsed: targetDate.toISOString(),
          availablePeriodsCount: periods.length
        })
      }
      
      // Log detailed period checking for debugging
      if (process.env.DEBUG_EXPENSES) {
        periods.forEach(period => {
          const startDate = new Date(period.start_date + 'T00:00:00Z')
          const endDate = new Date(period.end_date + 'T23:59:59Z')
          const inRange = targetDate >= startDate && targetDate <= endDate
          
          logger.log('info', '🔍 EXPENSE DEBUG: Checking period:', {
            periodId: period.id,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            target: targetDate.toISOString(),
            inRange: inRange,
            status: period.status
          })
        })
      }
      
      // Find the period that contains this date
      const matchingPeriod = findPeriodForDate(targetDate, periods)
      
      if (process.env.DEBUG_EXPENSES) {
        logger.log('info', '🔍 EXPENSE DEBUG: findPeriodForDate returned:', matchingPeriod ? {
          id: matchingPeriod.id,
          start_date: matchingPeriod.start_date,
          end_date: matchingPeriod.end_date,
          status: matchingPeriod.status
        } : 'NO MATCH')
      }
      
      return Promise.resolve(matchingPeriod)
    } catch (err) {
      logger.log('error', 'Database: Error finding period for expense:', { error: err.message })
      return Promise.reject(err)
    }
  }

  async activateBudget(budgetId) {
    try {
      this.db.exec('BEGIN TRANSACTION')

      // Deactivate current active budget
      const deactivateStmt = this.db.prepare('UPDATE budgets SET is_active = false WHERE is_active = true')
      deactivateStmt.run()

      // Activate the new budget
      const activateStmt = this.db.prepare('UPDATE budgets SET is_active = true WHERE id = ?')
      const result = activateStmt.run(budgetId)

      if (result.changes === 0) {
        throw new Error('Budget not found')
      }

      this.db.exec('COMMIT')
      logger.log('info', `Database: Activated budget ${budgetId}`)
      return Promise.resolve(true)

    } catch (err) {
      this.db.exec('ROLLBACK')
      logger.log('error', 'Database: Error activating budget:', { error: err.message })
      return Promise.reject(err)
    }
  }

  async scheduleUpcomingBudget(budgetId) {
    try {
      this.db.exec('BEGIN TRANSACTION')

      // Remove current upcoming budget
      const removeUpcomingStmt = this.db.prepare('UPDATE budgets SET is_upcoming = false WHERE is_upcoming = true')
      removeUpcomingStmt.run()

      // Set the new upcoming budget
      const setUpcomingStmt = this.db.prepare('UPDATE budgets SET is_upcoming = true WHERE id = ?')
      const result = setUpcomingStmt.run(budgetId)

      if (result.changes === 0) {
        throw new Error('Budget not found')
      }

      this.db.exec('COMMIT')
      logger.log('info', `Database: Scheduled upcoming budget ${budgetId}`)
      return Promise.resolve(true)

    } catch (err) {
      this.db.exec('ROLLBACK')
      logger.log('error', 'Database: Error scheduling upcoming budget:', { error: err.message })
      return Promise.reject(err)
    }
  }

  // Budget Analytics Methods
  getCurrentBudgetAnalytics() {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          b.name as budget_name,
          b.amount as target_amount,
          bp.id as period_id,
          bp.start_date,
          bp.end_date,
          bp.target_amount as period_target,
          bp.status,
          COALESCE(SUM(e.amount), 0) as actual_spent,
          COUNT(e.id) as expense_count
        FROM budgets b
        JOIN budget_periods bp ON b.id = bp.budget_id
        LEFT JOIN expenses e ON e.budget_period_id = bp.id
        WHERE b.is_active = true AND bp.status = 'active'
        GROUP BY b.id, bp.id
        LIMIT 1
      `)
      
      return stmt.get()
    } catch (err) {
      logger.log('error', 'Database: Error getting current budget analytics:', { error: err.message })
      return null
    }
  }

  getBudgetHistory(limit = 10) {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          bp.id,
          bp.start_date,
          bp.end_date,
          bp.target_amount,
          bp.status,
          bp.created_at,
          b.name as budget_name,
          COALESCE(SUM(e.amount), 0) as actual_spent,
          COUNT(e.id) as expense_count
        FROM budget_periods bp
        JOIN budgets b ON b.id = bp.budget_id
        LEFT JOIN expenses e ON e.budget_period_id = bp.id
        WHERE bp.status = 'completed'
        GROUP BY bp.id
        ORDER BY bp.end_date DESC
        LIMIT ?
      `)
      
      return stmt.all(limit)
    } catch (err) {
      logger.log('error', 'Database: Error getting budget history:', { error: err.message })
      return []
    }
  }

  getBudgetTrends() {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          DATE(bp.start_date) as period_start,
          bp.target_amount,
          COALESCE(SUM(e.amount), 0) as actual_spent,
          COUNT(e.id) as expense_count,
          b.name as budget_name,
          CASE 
            WHEN COALESCE(SUM(e.amount), 0) > bp.target_amount THEN 'over'
            WHEN COALESCE(SUM(e.amount), 0) > bp.target_amount * 0.8 THEN 'warning'
            ELSE 'good'
          END as performance
        FROM budget_periods bp
        JOIN budgets b ON b.id = bp.budget_id
        LEFT JOIN expenses e ON e.budget_period_id = bp.id
        WHERE bp.status IN ('completed', 'active')
        GROUP BY bp.id
        ORDER BY bp.start_date DESC
        LIMIT 12
      `)
      
      return stmt.all()
    } catch (err) {
      logger.log('error', 'Database: Error getting budget trends:', { error: err.message })
      return []
    }
  }

  // Settings Methods
  getAllSettings() {
    try {
      const stmt = this.db.prepare('SELECT key, value FROM user_settings ORDER BY key')
      const rows = stmt.all()
      
      // Convert to object format
      const settings = {}
      rows.forEach(row => {
        settings[row.key] = row.value
      })
      
      return settings
    } catch (err) {
      console.error('Database: Error fetching all settings:', err)
      throw err
    }
  }

  getSetting(key) {
    try {
      const stmt = this.db.prepare('SELECT key, value FROM user_settings WHERE key = ?')
      const row = stmt.get(key)
      
      if (!row) {
        return null
      }
      
      return { key: row.key, value: row.value }
    } catch (err) {
      console.error('Database: Error fetching setting:', err)
      throw err
    }
  }

  setSetting(key, value) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO user_settings (key, value, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `)
      
      const result = stmt.run(key, value)
      
      if (result.changes > 0) {
        return { key, value }
      } else {
        throw new Error('Failed to update setting')
      }
    } catch (err) {
      console.error('Database: Error setting value:', err)
      throw err
    }
  }

  deleteSetting(key) {
    try {
      const stmt = this.db.prepare('DELETE FROM user_settings WHERE key = ?')
      const result = stmt.run(key)
      
      return result.changes > 0
    } catch (err) {
      console.error('Database: Error deleting setting:', err)
      throw err
    }
  }
}

export const databaseService = new DatabaseService()
