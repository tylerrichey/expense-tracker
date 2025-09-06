/**
 * Migration: Places Summaries
 * Adds generativeSummary and reviewSummary columns to places table
 */

export function up(db) {
  console.log('🚀 Running migration: Places Summaries (UP)')
  
  try {
    // Execute all migration steps in a transaction
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Adding generativeSummary column to places table...')
    db.exec(`
      ALTER TABLE places 
      ADD COLUMN generative_summary TEXT;
    `)
    
    console.log('  📋 Adding reviewSummary column to places table...')
    db.exec(`
      ALTER TABLE places 
      ADD COLUMN review_summary TEXT;
    `)
    
    db.exec('COMMIT;')
    console.log('✅ Places summaries migration completed successfully')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Places summaries migration failed:', error)
    throw error
  }
}

export function down(db) {
  console.log('🔄 Running migration: Places Summaries (DOWN)')
  
  try {
    db.exec('BEGIN TRANSACTION;')
    
    console.log('  📋 Dropping generativeSummary column...')
    // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    db.exec(`
      CREATE TABLE places_temp AS 
      SELECT id, name, address, types, location, created_at, updated_at 
      FROM places;
    `)
    
    db.exec('DROP TABLE places;')
    
    db.exec(`
      CREATE TABLE places (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        types TEXT,
        location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
    
    db.exec('INSERT INTO places SELECT * FROM places_temp;')
    db.exec('DROP TABLE places_temp;')
    
    console.log('  📋 Recreating indexes...')
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_places_name ON places(name);',
      'CREATE INDEX IF NOT EXISTS idx_places_types ON places(types);',
      'CREATE INDEX IF NOT EXISTS idx_places_updated_at ON places(updated_at);'
    ]
    
    createIndexes.forEach(indexQuery => {
      db.exec(indexQuery)
    })
    
    db.exec('COMMIT;')
    console.log('✅ Places summaries migration rollback completed')
    
  } catch (error) {
    db.exec('ROLLBACK;')
    console.error('❌ Places summaries migration rollback failed:', error)
    throw error
  }
}