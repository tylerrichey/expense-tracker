import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'

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
    
    console.log(`📁 Using database: ${dbPath}`)
    this.dbPath = dbPath
    this.db = new Database(dbPath)
    this.initializeDatabase()
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
      console.log('Database initialized successfully')
      // Add new columns if they don't exist (for existing databases)
      this.addMissingColumns()
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
          console.error('Error adding column:', err)
        }
      }
    })
  }

  addExpense(expense) {
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Database: Adding expense with data:', JSON.stringify(expense, null, 2))
      }
      
      const stmt = this.db.prepare(`
        INSERT INTO expenses (amount, latitude, longitude, place_id, place_name, place_address, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      
      const result = stmt.run(
        expense.amount, 
        expense.latitude, 
        expense.longitude, 
        expense.place_id,
        expense.place_name,
        expense.place_address,
        expense.timestamp
      )
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('Database: Expense saved with ID:', result.lastInsertRowid)
      }
      return Promise.resolve({ id: result.lastInsertRowid, ...expense })
    } catch (err) {
      console.error('Database: Error adding expense:', err)
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
      
      console.log(`Database: Updated expense ${expenseId} with image (${imageBuffer.length} bytes)`)
      return Promise.resolve(true)
    } catch (err) {
      console.error('Database: Error updating expense image:', err)
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
      console.error('Database: Error retrieving expense image:', err)
      return Promise.reject(err)
    }
  }
}

export const databaseService = new DatabaseService()