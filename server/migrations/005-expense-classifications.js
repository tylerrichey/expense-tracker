/**
 * Migration: Expense Classifications Table
 * Creates expense_classifications table for AI-powered cuisine and meal time classification
 */

export function up(db) {
  console.log('🚀 Running migration: Expense Classifications Table (UP)')
  
  // Create expense_classifications table
  const createClassificationsTable = `
    CREATE TABLE IF NOT EXISTS expense_classifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id INTEGER NOT NULL,
      cuisine_type TEXT,
      meal_time TEXT,
      ai_classified_at DATETIME,
      ai_confidence_cuisine REAL,
      ai_confidence_meal REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
    );
  `
  
  // Create indexes for performance
  const createIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_expense_classifications_expense_id ON expense_classifications(expense_id);',
    'CREATE INDEX IF NOT EXISTS idx_expense_classifications_cuisine_type ON expense_classifications(cuisine_type);',
    'CREATE INDEX IF NOT EXISTS idx_expense_classifications_meal_time ON expense_classifications(meal_time);',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_classifications_unique ON expense_classifications(expense_id);'
  ]
  
  try {
    // Execute all migration steps in a transaction
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Creating expense_classifications table...')
    db.exec(createClassificationsTable)
    
    console.log('  📋 Creating performance indexes...')
    createIndexes.forEach(indexQuery => {
      db.exec(indexQuery)
    })
    
    db.exec('COMMIT;')
    console.log('✅ Expense classifications table migration completed successfully')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Expense classifications table migration failed:', error)
    throw error
  }
}

export function down(db) {
  console.log('🔄 Running migration: Expense Classifications Table (DOWN)')
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Dropping indexes...')
    const dropIndexes = [
      'DROP INDEX IF EXISTS idx_expense_classifications_expense_id;',
      'DROP INDEX IF EXISTS idx_expense_classifications_cuisine_type;',
      'DROP INDEX IF EXISTS idx_expense_classifications_meal_time;',
      'DROP INDEX IF EXISTS idx_expense_classifications_unique;'
    ]
    
    dropIndexes.forEach(dropQuery => {
      db.exec(dropQuery)
    })
    
    console.log('  📋 Dropping expense_classifications table...')
    db.exec('DROP TABLE IF EXISTS expense_classifications;')
    
    db.exec('COMMIT;')
    console.log('✅ Expense classifications table migration rollback completed')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Expense classifications table migration rollback failed:', error)
    throw error
  }
}