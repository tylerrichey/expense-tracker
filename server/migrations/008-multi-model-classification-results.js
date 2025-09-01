/**
 * Migration: Multi-Model Classification Results
 * Updates expense_classifications table to store results from multiple AI models
 */

export function up(db) {
  console.log('🚀 Running migration: Multi-Model Classification Results (UP)')
  
  // Add new columns for multi-model results
  const addColumnsQueries = [
    // Model 1 results (existing fields become final results, add model-specific ones)
    'ALTER TABLE expense_classifications ADD COLUMN model_1_cuisine TEXT;',
    'ALTER TABLE expense_classifications ADD COLUMN model_1_meal_time TEXT;', 
    'ALTER TABLE expense_classifications ADD COLUMN model_1_confidence_cuisine REAL;',
    'ALTER TABLE expense_classifications ADD COLUMN model_1_confidence_meal REAL;',
    'ALTER TABLE expense_classifications ADD COLUMN model_1_name TEXT;',
    
    // Model 2 results  
    'ALTER TABLE expense_classifications ADD COLUMN model_2_cuisine TEXT;',
    'ALTER TABLE expense_classifications ADD COLUMN model_2_meal_time TEXT;',
    'ALTER TABLE expense_classifications ADD COLUMN model_2_confidence_cuisine REAL;',
    'ALTER TABLE expense_classifications ADD COLUMN model_2_confidence_meal REAL;',
    'ALTER TABLE expense_classifications ADD COLUMN model_2_name TEXT;',
    
    // Model 3 results
    'ALTER TABLE expense_classifications ADD COLUMN model_3_cuisine TEXT;',
    'ALTER TABLE expense_classifications ADD COLUMN model_3_meal_time TEXT;',
    'ALTER TABLE expense_classifications ADD COLUMN model_3_confidence_cuisine REAL;',
    'ALTER TABLE expense_classifications ADD COLUMN model_3_confidence_meal REAL;',
    'ALTER TABLE expense_classifications ADD COLUMN model_3_name TEXT;',
    
    // Multi-model metadata
    'ALTER TABLE expense_classifications ADD COLUMN final_decision_method TEXT DEFAULT "single_model";',
    'ALTER TABLE expense_classifications ADD COLUMN models_used INTEGER DEFAULT 1;',
    'ALTER TABLE expense_classifications ADD COLUMN combined_confidence_cuisine REAL;',
    'ALTER TABLE expense_classifications ADD COLUMN combined_confidence_meal REAL;'
  ]
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Adding multi-model result columns...')
    
    addColumnsQueries.forEach((query, index) => {
      try {
        db.exec(query)
        console.log(`    ✓ Added column ${index + 1}/${addColumnsQueries.length}`)
      } catch (error) {
        // Column might already exist, that's okay
        if (!error.message.includes('duplicate column name')) {
          throw error
        }
        console.log(`    ⚠️  Column ${index + 1} already exists, skipping`)
      }
    })
    
    // Migrate existing data to model_1_* fields
    console.log('  📋 Migrating existing classification data to model_1 fields...')
    const migrateExistingData = `
      UPDATE expense_classifications 
      SET 
        model_1_cuisine = cuisine_type,
        model_1_meal_time = meal_time,
        model_1_confidence_cuisine = ai_confidence_cuisine,
        model_1_confidence_meal = ai_confidence_meal,
        model_1_name = 'gpt-3.5-turbo',
        final_decision_method = 'single_model',
        models_used = 1,
        combined_confidence_cuisine = ai_confidence_cuisine,
        combined_confidence_meal = ai_confidence_meal
      WHERE model_1_cuisine IS NULL
    `
    db.exec(migrateExistingData)
    
    console.log('  📋 Creating indexes for new columns...')
    const createNewIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_expense_classifications_final_decision_method ON expense_classifications(final_decision_method);',
      'CREATE INDEX IF NOT EXISTS idx_expense_classifications_models_used ON expense_classifications(models_used);'
    ]
    
    createNewIndexes.forEach(indexQuery => {
      db.exec(indexQuery)
    })
    
    db.exec('COMMIT;')
    console.log('✅ Multi-model classification results migration completed successfully')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Multi-model classification results migration failed:', error)
    throw error
  }
}

export function down(db) {
  console.log('🔄 Running migration: Multi-Model Classification Results (DOWN)')
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 This migration cannot be safely rolled back (would lose data)')
    console.log('  📋 Multi-model columns will remain but will not be used')
    
    // We can't safely drop columns in SQLite without recreating the table
    // Instead, we'll just clear the multi-model specific data
    const clearMultiModelData = `
      UPDATE expense_classifications 
      SET 
        model_1_cuisine = NULL,
        model_1_meal_time = NULL,
        model_1_confidence_cuisine = NULL,
        model_1_confidence_meal = NULL,
        model_1_name = NULL,
        model_2_cuisine = NULL,
        model_2_meal_time = NULL,
        model_2_confidence_cuisine = NULL,
        model_2_confidence_meal = NULL,
        model_2_name = NULL,
        model_3_cuisine = NULL,
        model_3_meal_time = NULL,
        model_3_confidence_cuisine = NULL,
        model_3_confidence_meal = NULL,
        model_3_name = NULL,
        final_decision_method = 'single_model',
        models_used = 1,
        combined_confidence_cuisine = ai_confidence_cuisine,
        combined_confidence_meal = ai_confidence_meal
    `
    db.exec(clearMultiModelData)
    
    db.exec('COMMIT;')
    console.log('✅ Multi-model classification results migration rollback completed')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Multi-model classification results migration rollback failed:', error)
    throw error
  }
}