/**
 * Migration: Timezone Setting
 * Adds timezone field to budgets table and creates user settings table
 */

export function up(db) {
  console.log('🚀 Running migration: Timezone Setting (UP)')
  
  try {
    // Execute all migration steps in a transaction
    db.exec('BEGIN TRANSACTION;')
    
    // Create user_settings table for app-wide settings
    console.log('  📋 Creating user_settings table...')
    const createUserSettingsTable = `
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `
    db.exec(createUserSettingsTable)
    
    // Add timezone column to budgets table
    console.log('  📋 Adding timezone column to budgets table...')
    try {
      const addTimezoneColumn = `
        ALTER TABLE budgets ADD COLUMN timezone TEXT DEFAULT 'UTC';
      `
      db.exec(addTimezoneColumn)
    } catch (err) {
      if (!err.message.includes('duplicate column name')) {
        throw err
      }
      console.log('    ℹ️ timezone column already exists')
    }
    
    // Set default timezone setting
    console.log('  📋 Setting default timezone setting...')
    const insertDefaultTimezone = `
      INSERT OR IGNORE INTO user_settings (key, value) 
      VALUES ('timezone', 'UTC');
    `
    db.exec(insertDefaultTimezone)
    
    // Create index for user settings
    console.log('  📋 Creating user_settings index...')
    const createUserSettingsIndex = `
      CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(key);
    `
    db.exec(createUserSettingsIndex)
    
    db.exec('COMMIT;')
    console.log('✅ Timezone setting migration completed successfully')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Timezone setting migration failed:', error)
    throw error
  }
}

export function down(db) {
  console.log('🔄 Running migration: Timezone Setting (DOWN)')
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Dropping user_settings index...')
    db.exec('DROP INDEX IF EXISTS idx_user_settings_key;')
    
    console.log('  📋 Dropping user_settings table...')
    db.exec('DROP TABLE IF EXISTS user_settings;')
    
    console.log('  📋 Removing timezone column from budgets...')
    // SQLite doesn't support DROP COLUMN directly, so we recreate the table
    db.exec(`
      CREATE TABLE budgets_backup AS 
      SELECT id, name, amount, start_weekday, duration_days, created_at, updated_at, 
             is_active, is_upcoming, vacation_mode
      FROM budgets;
    `)
    db.exec('DROP TABLE budgets;')
    db.exec(`
      CREATE TABLE budgets (
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
    `)
    db.exec('INSERT INTO budgets SELECT * FROM budgets_backup;')
    db.exec('DROP TABLE budgets_backup;')
    
    // Recreate indexes that were on the budgets table
    const recreateIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets(is_active) WHERE is_active = true;',
      'CREATE INDEX IF NOT EXISTS idx_budgets_upcoming ON budgets(is_upcoming) WHERE is_upcoming = true;'
    ]
    
    recreateIndexes.forEach(indexQuery => {
      db.exec(indexQuery)
    })
    
    db.exec('COMMIT;')
    console.log('✅ Timezone setting migration rollback completed')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Timezone setting migration rollback failed:', error)
    throw error
  }
}