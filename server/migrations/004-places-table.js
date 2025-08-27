/**
 * Migration: Places Table
 * Creates places table to store Google Places data with types information
 */

export function up(db) {
  console.log('🚀 Running migration: Places Table (UP)')
  
  // Create places table with Google place_id as primary key
  const createPlacesTable = `
    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      types TEXT,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `
  
  // Create indexes for performance
  const createIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_places_name ON places(name);',
    'CREATE INDEX IF NOT EXISTS idx_places_types ON places(types);',
    'CREATE INDEX IF NOT EXISTS idx_places_updated_at ON places(updated_at);'
  ]
  
  try {
    // Execute all migration steps in a transaction
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Creating places table...')
    db.exec(createPlacesTable)
    
    console.log('  📋 Creating performance indexes...')
    createIndexes.forEach(indexQuery => {
      db.exec(indexQuery)
    })
    
    db.exec('COMMIT;')
    console.log('✅ Places table migration completed successfully')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Places table migration failed:', error)
    throw error
  }
}

export function down(db) {
  console.log('🔄 Running migration: Places Table (DOWN)')
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Dropping indexes...')
    const dropIndexes = [
      'DROP INDEX IF EXISTS idx_places_name;',
      'DROP INDEX IF EXISTS idx_places_types;',
      'DROP INDEX IF EXISTS idx_places_updated_at;'
    ]
    
    dropIndexes.forEach(dropQuery => {
      db.exec(dropQuery)
    })
    
    console.log('  📋 Dropping places table...')
    db.exec('DROP TABLE IF EXISTS places;')
    
    db.exec('COMMIT;')
    console.log('✅ Places table migration rollback completed')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Places table migration rollback failed:', error)
    throw error
  }
}