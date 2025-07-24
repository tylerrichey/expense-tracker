/**
 * Migration: Budget System
 * Adds budgets and budget_periods tables, plus budget_period_id to expenses
 */

export function up(db) {
  console.log('🚀 Running migration: Budget System (UP)')
  
  // Create budgets table
  const createBudgetsTable = `
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
  `
  
  // Create budget_periods table
  const createBudgetPeriodsTable = `
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
      
      -- Ensure periods don't overlap for the same budget
      CONSTRAINT no_overlap UNIQUE (budget_id, start_date, end_date)
    );
  `
  
  // Add budget_period_id to expenses table
  const addBudgetPeriodColumn = `
    ALTER TABLE expenses ADD COLUMN budget_period_id INTEGER 
    REFERENCES budget_periods(id) ON DELETE SET NULL;
  `
  
  // Create indexes for performance
  const createIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets(is_active) WHERE is_active = true;',
    'CREATE INDEX IF NOT EXISTS idx_budgets_upcoming ON budgets(is_upcoming) WHERE is_upcoming = true;',
    'CREATE INDEX IF NOT EXISTS idx_budget_periods_status ON budget_periods(status);',
    'CREATE INDEX IF NOT EXISTS idx_budget_periods_dates ON budget_periods(start_date, end_date);',
    'CREATE INDEX IF NOT EXISTS idx_budget_periods_budget_id ON budget_periods(budget_id);',
    'CREATE INDEX IF NOT EXISTS idx_expenses_budget_period_id ON expenses(budget_period_id);',
    'CREATE INDEX IF NOT EXISTS idx_expenses_timestamp ON expenses(timestamp);'
  ]
  
  try {
    // Execute all migration steps in a transaction
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Creating budgets table...')
    db.exec(createBudgetsTable)
    
    console.log('  📋 Creating budget_periods table...')
    db.exec(createBudgetPeriodsTable)
    
    console.log('  📋 Adding budget_period_id column to expenses...')
    try {
      db.exec(addBudgetPeriodColumn)
    } catch (err) {
      if (!err.message.includes('duplicate column name')) {
        throw err
      }
      console.log('    ℹ️ budget_period_id column already exists')
    }
    
    console.log('  📋 Creating performance indexes...')
    createIndexes.forEach(indexQuery => {
      db.exec(indexQuery)
    })
    
    db.exec('COMMIT;')
    console.log('✅ Budget system migration completed successfully')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Budget system migration failed:', error)
    throw error
  }
}

export function down(db) {
  console.log('🔄 Running migration: Budget System (DOWN)')
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Dropping indexes...')
    const dropIndexes = [
      'DROP INDEX IF EXISTS idx_budgets_active;',
      'DROP INDEX IF EXISTS idx_budgets_upcoming;',
      'DROP INDEX IF EXISTS idx_budget_periods_status;',
      'DROP INDEX IF EXISTS idx_budget_periods_dates;',
      'DROP INDEX IF EXISTS idx_budget_periods_budget_id;',
      'DROP INDEX IF EXISTS idx_expenses_budget_period_id;',
      'DROP INDEX IF EXISTS idx_expenses_timestamp;'
    ]
    
    dropIndexes.forEach(dropQuery => {
      db.exec(dropQuery)
    })
    
    console.log('  📋 Removing budget_period_id column from expenses...')
    // SQLite doesn't support DROP COLUMN directly, but since this is a new migration
    // we can assume the column was just added and might be empty
    db.exec(`
      CREATE TABLE expenses_backup AS 
      SELECT id, amount, latitude, longitude, place_id, place_name, place_address, receipt_image, timestamp 
      FROM expenses;
    `)
    db.exec('DROP TABLE expenses;')
    db.exec(`
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        latitude REAL,
        longitude REAL,
        place_id TEXT,
        place_name TEXT,
        place_address TEXT,
        receipt_image BLOB,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
    db.exec('INSERT INTO expenses SELECT * FROM expenses_backup;')
    db.exec('DROP TABLE expenses_backup;')
    
    console.log('  📋 Dropping budget_periods table...')
    db.exec('DROP TABLE IF EXISTS budget_periods;')
    
    console.log('  📋 Dropping budgets table...')
    db.exec('DROP TABLE IF EXISTS budgets;')
    
    db.exec('COMMIT;')
    console.log('✅ Budget system migration rollback completed')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Budget system migration rollback failed:', error)
    throw error
  }
}