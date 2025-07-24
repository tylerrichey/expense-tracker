import Database from 'better-sqlite3'
import { join, dirname } from 'path' 
import { fileURLToPath } from 'url'
import { existsSync, unlinkSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create a test-specific database instance
export function createTestDatabase() {
  const testDbPath = join(__dirname, '../../server/expenses-integration-test.db')
  
  // Remove existing test database
  if (existsSync(testDbPath)) {
    unlinkSync(testDbPath)
  }
  
  const db = new Database(testDbPath)
  
  // Initialize with the same schema as the main database
  const createTablesSQL = `
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
    );

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
    );

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
    );

    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `
  
  db.exec(createTablesSQL)
  
  return { db, dbPath: testDbPath }
}

export function cleanupTestDatabase(dbPath) {
  if (existsSync(dbPath)) {
    unlinkSync(dbPath)
  }
}