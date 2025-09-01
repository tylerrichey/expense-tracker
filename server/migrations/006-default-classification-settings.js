/**
 * Migration: Default Classification Settings
 * Adds default AI classification settings to user_settings table
 */

export function up(db) {
  console.log('🚀 Running migration: Default Classification Settings (UP)')
  
  // Default cuisine types
  const defaultCuisineTypes = [
    "Italian",
    "Mexican", 
    "Chinese",
    "American",
    "Fast Food",
    "Coffee",
    "Bakery",
    "Bar",
    "Grocery",
    "Pharmacy",
    "Gas Station",
    "Other"
  ]
  
  // Default meal times
  const defaultMealTimes = [
    "breakfast",
    "lunch", 
    "dinner",
    "snack",
    "drink"
  ]
  
  // Default AI settings
  const defaultSettings = [
    {
      key: 'cuisine_types',
      value: JSON.stringify(defaultCuisineTypes)
    },
    {
      key: 'meal_times', 
      value: JSON.stringify(defaultMealTimes)
    },
    {
      key: 'ai_provider_base_url',
      value: 'https://api.openai.com/v1'
    },
    {
      key: 'ai_model',
      value: 'gpt-3.5-turbo'
    },
    {
      key: 'ai_classification_enabled',
      value: 'false'
    },
    {
      key: 'ai_provider_api_key',
      value: ''
    }
  ]
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Adding default classification settings...')
    
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO user_settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `)
    
    defaultSettings.forEach(setting => {
      insertStmt.run(setting.key, setting.value)
      console.log(`    ✓ Added setting: ${setting.key}`)
    })
    
    db.exec('COMMIT;')
    console.log('✅ Default classification settings migration completed successfully')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Default classification settings migration failed:', error)
    throw error
  }
}

export function down(db) {
  console.log('🔄 Running migration: Default Classification Settings (DOWN)')
  
  const settingsToRemove = [
    'cuisine_types',
    'meal_times', 
    'ai_provider_base_url',
    'ai_model',
    'ai_classification_enabled',
    'ai_provider_api_key'
  ]
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Removing default classification settings...')
    
    const deleteStmt = db.prepare('DELETE FROM user_settings WHERE key = ?')
    
    settingsToRemove.forEach(key => {
      deleteStmt.run(key)
      console.log(`    ✓ Removed setting: ${key}`)
    })
    
    db.exec('COMMIT;')
    console.log('✅ Default classification settings migration rollback completed')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Default classification settings migration rollback failed:', error)
    throw error
  }
}