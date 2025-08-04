/**
 * Migration: Drop Unused Columns
 * Removes unused columns from budget system tables
 * - actual_spent from budget_periods (dynamically calculated instead)
 * - timezone from budgets (global setting used instead)
 */

export function up(db) {
  console.log('🚀 Running migration: Drop Unused Columns (UP)')
  
  try {
    // Execute all migration steps in a transaction
    console.log('  📋 Starting transaction...')
    db.exec('BEGIN TRANSACTION')
    
    // Drop actual_spent column from budget_periods table
    console.log('  📋 Dropping actual_spent column from budget_periods table...')
    try {
      db.exec('ALTER TABLE budget_periods DROP COLUMN actual_spent')
      console.log('    ✅ Successfully dropped actual_spent column from budget_periods')
    } catch (err) {
      if (err.message.includes('no such column')) {
        console.log('    ℹ️ actual_spent column does not exist, skipping...')
      } else {
        console.log('    ⚠️ Error dropping actual_spent column:', err.message)
        throw err
      }
    }
    
    // Drop timezone column from budgets table
    console.log('  📋 Dropping timezone column from budgets table...')
    try {
      db.exec('ALTER TABLE budgets DROP COLUMN timezone')
      console.log('    ✅ Successfully dropped timezone column from budgets')
    } catch (err) {
      if (err.message.includes('no such column')) {
        console.log('    ℹ️ timezone column does not exist, skipping...')
      } else {
        console.log('    ⚠️ Error dropping timezone column:', err.message)
        throw err
      }
    }
    
    // Commit transaction
    console.log('  📋 Committing transaction...')
    db.exec('COMMIT')
    
    console.log('✅ Migration completed successfully: Drop Unused Columns')
    
  } catch (error) {
    console.log('❌ Migration failed: Drop Unused Columns')
    console.error('   Error:', error.message)
    
    try {
      db.exec('ROLLBACK')
      console.log('  📋 Transaction rolled back')
    } catch (rollbackError) {
      console.error('  ❌ Failed to rollback transaction:', rollbackError.message)
    }
    
    throw error
  }
}

export function down(db) {
  console.log('🔄 Running migration: Drop Unused Columns (DOWN)')
  
  try {
    // Execute all rollback steps in a transaction
    console.log('  📋 Starting transaction...')
    db.exec('BEGIN TRANSACTION')
    
    // Add timezone column back to budgets table
    console.log('  📋 Adding timezone column back to budgets table...')
    try {
      db.exec('ALTER TABLE budgets ADD COLUMN timezone TEXT DEFAULT \'UTC\'')
      console.log('    ✅ Successfully added timezone column back to budgets')
    } catch (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('    ℹ️ timezone column already exists, skipping...')
      } else {
        console.log('    ⚠️ Error adding timezone column:', err.message)
        throw err
      }
    }
    
    // Add actual_spent column back to budget_periods table
    console.log('  📋 Adding actual_spent column back to budget_periods table...')
    try {
      db.exec('ALTER TABLE budget_periods ADD COLUMN actual_spent DECIMAL(10,2) DEFAULT 0')
      console.log('    ✅ Successfully added actual_spent column back to budget_periods')
    } catch (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('    ℹ️ actual_spent column already exists, skipping...')
      } else {
        console.log('    ⚠️ Error adding actual_spent column:', err.message)
        throw err
      }
    }
    
    // Commit transaction
    console.log('  📋 Committing transaction...')
    db.exec('COMMIT')
    
    console.log('✅ Migration rollback completed successfully: Drop Unused Columns')
    
  } catch (error) {
    console.log('❌ Migration rollback failed: Drop Unused Columns')
    console.error('   Error:', error.message)
    
    try {
      db.exec('ROLLBACK')
      console.log('  📋 Transaction rolled back')
    } catch (rollbackError) {
      console.error('  ❌ Failed to rollback transaction:', rollbackError.message)
    }
    
    throw error
  }
}