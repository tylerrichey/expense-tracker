/**
 * Migration: Multi-Model AI Classification Settings
 * Adds settings to support multiple AI models running in parallel
 */

export function up(db) {
  console.log('🚀 Running migration: Multi-Model AI Classification Settings (UP)')
  
  // New multi-model settings
  const multiModelSettings = [
    {
      key: 'ai_model_1',
      value: '' // Will be migrated from existing ai_model setting
    },
    {
      key: 'ai_model_2', 
      value: ''
    },
    {
      key: 'ai_model_3',
      value: ''
    },
    {
      key: 'ai_multi_model_enabled',
      value: 'false'
    },
    {
      key: 'ai_multi_model_strategy',
      value: 'weighted_vote'
    }
  ]
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Adding multi-model AI settings...')
    
    // First, migrate existing ai_model to ai_model_1 if it exists
    const existingModel = db.prepare('SELECT value FROM user_settings WHERE key = ?').get('ai_model')
    if (existingModel && existingModel.value) {
      multiModelSettings[0].value = existingModel.value
      console.log(`    ↗️  Migrating existing model "${existingModel.value}" to ai_model_1`)
    }
    
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO user_settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `)
    
    multiModelSettings.forEach(setting => {
      insertStmt.run(setting.key, setting.value)
      console.log(`    ✓ Added setting: ${setting.key} = ${setting.value}`)
    })
    
    db.exec('COMMIT;')
    console.log('✅ Multi-model AI classification settings migration completed successfully')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Multi-model AI classification settings migration failed:', error)
    throw error
  }
}

export function down(db) {
  console.log('🔄 Running migration: Multi-Model AI Classification Settings (DOWN)')
  
  const settingsToRemove = [
    'ai_model_1',
    'ai_model_2',
    'ai_model_3', 
    'ai_multi_model_enabled',
    'ai_multi_model_strategy'
  ]
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Removing multi-model AI settings...')
    
    const deleteStmt = db.prepare('DELETE FROM user_settings WHERE key = ?')
    
    settingsToRemove.forEach(key => {
      deleteStmt.run(key)
      console.log(`    ✓ Removed setting: ${key}`)
    })
    
    db.exec('COMMIT;')
    console.log('✅ Multi-model AI classification settings migration rollback completed')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Multi-model AI classification settings migration rollback failed:', error)
    throw error
  }
}