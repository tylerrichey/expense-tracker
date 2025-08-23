import { databaseService } from '../server/database.js'
import { logger } from '../server/logger.js'
import fs from 'fs'
import readline from 'readline'

/**
 * Database maintenance script for SQLite operations
 * Includes VACUUM, ANALYZE, and integrity checks
 */
class DatabaseMaintenance {
  constructor() {
    this.stats = {
      startTime: Date.now(),
      sizeBefore: 0,
      sizeAfter: 0
    }
  }

  /**
   * Get user confirmation for maintenance operations
   */
  async getUserConfirmation(operation) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise((resolve) => {
      const dbPath = databaseService.getDatabasePath()
      const isProduction = process.env.NODE_ENV === 'production'
      const environment = isProduction ? 'PRODUCTION' : 'DEVELOPMENT'
      
      console.log('\n🔧 DATABASE MAINTENANCE')
      console.log('=========================')
      console.log(`Operation: ${operation}`)
      console.log(`Environment: ${environment}`)
      console.log(`Database: ${dbPath}`)
      
      if (isProduction) {
        console.log('\n🔴 PRODUCTION ENVIRONMENT DETECTED!')
        console.log('• Consider stopping the application during maintenance')
        console.log('• Maintenance operations may temporarily lock the database')
      }
      
      console.log('\n⚠️  IMPORTANT:')
      console.log('• VACUUM will temporarily lock the database')
      console.log('• The operation may take several seconds to complete')
      console.log('• A backup is recommended before major maintenance')
      
      rl.question(`\nProceed with ${operation}? (yes/no): `, (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
      })
    })
  }

  /**
   * Get database file size
   */
  getDatabaseSize() {
    try {
      const dbPath = databaseService.getDatabasePath()
      const stats = fs.statSync(dbPath)
      return stats.size
    } catch (error) {
      console.log('⚠️  Could not get database size:', error.message)
      return 0
    }
  }

  /**
   * Run VACUUM operation to reclaim space and defragment
   */
  async vacuum() {
    try {
      console.log('\n🗜️  Starting VACUUM operation...')
      
      this.stats.sizeBefore = this.getDatabaseSize()
      console.log(`📦 Database size before: ${(this.stats.sizeBefore / 1024 / 1024).toFixed(2)}MB`)
      
      const startTime = Date.now()
      console.log('🔄 Running VACUUM (this may take a few seconds)...')
      
      // Run VACUUM operation
      const db = databaseService.db
      db.exec('VACUUM')
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      this.stats.sizeAfter = this.getDatabaseSize()
      
      const spaceSaved = this.stats.sizeBefore - this.stats.sizeAfter
      const percentReduction = this.stats.sizeBefore > 0 ? ((spaceSaved / this.stats.sizeBefore) * 100).toFixed(1) : '0'
      
      console.log(`✅ VACUUM completed in ${duration}s`)
      console.log(`📦 Database size after: ${(this.stats.sizeAfter / 1024 / 1024).toFixed(2)}MB`)
      console.log(`💾 Space reclaimed: ${(spaceSaved / 1024 / 1024).toFixed(2)}MB (${percentReduction}%)`)
      
      if (spaceSaved > 0) {
        console.log('🎉 Database successfully compacted!')
      } else {
        console.log('ℹ️  Database was already optimal - no space to reclaim')
      }
      
    } catch (error) {
      console.log('❌ VACUUM operation failed:', error.message)
      throw error
    }
  }

  /**
   * Run ANALYZE to update table statistics for better query performance
   */
  async analyze() {
    try {
      console.log('\n📊 Running ANALYZE operation...')
      
      const startTime = Date.now()
      const db = databaseService.db
      
      // Run ANALYZE on all tables
      db.exec('ANALYZE')
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`✅ ANALYZE completed in ${duration}s`)
      console.log('📈 Table statistics updated for better query performance')
      
    } catch (error) {
      console.log('❌ ANALYZE operation failed:', error.message)
      throw error
    }
  }

  /**
   * Check database integrity
   */
  async integrityCheck() {
    try {
      console.log('\n🔍 Running integrity check...')
      
      const db = databaseService.db
      const result = db.prepare('PRAGMA integrity_check').get()
      
      if (result.integrity_check === 'ok') {
        console.log('✅ Database integrity check passed')
        console.log('🎯 No corruption detected')
      } else {
        console.log('❌ Database integrity issues found:')
        console.log(result.integrity_check)
      }
      
      return result.integrity_check === 'ok'
    } catch (error) {
      console.log('❌ Integrity check failed:', error.message)
      return false
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      console.log('\n📋 Database Statistics')
      console.log('=======================')
      
      const db = databaseService.db
      
      // Get table info
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
      
      console.log('📊 Tables:')
      for (const table of tables) {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get()
        console.log(`   ${table.name}: ${count.count} rows`)
      }
      
      // Database size
      const size = this.getDatabaseSize()
      console.log(`📦 Database size: ${(size / 1024 / 1024).toFixed(2)}MB`)
      
      // Page info
      const pageCount = db.prepare('PRAGMA page_count').get()
      const pageSize = db.prepare('PRAGMA page_size').get()
      console.log(`📄 Pages: ${pageCount.page_count} (${pageSize.page_size} bytes each)`)
      
      // Free pages (unused space)
      const freelist = db.prepare('PRAGMA freelist_count').get()
      const freeSpace = freelist.freelist_count * pageSize.page_size
      console.log(`🗑️  Free space: ${(freeSpace / 1024).toFixed(1)}KB (${freelist.freelist_count} pages)`)
      
      if (freeSpace > 1024 * 1024) { // More than 1MB of free space
        console.log('💡 Tip: Run VACUUM to reclaim free space')
      }
      
    } catch (error) {
      console.log('❌ Could not get database statistics:', error.message)
    }
  }

  /**
   * Run full maintenance routine
   */
  async fullMaintenance() {
    try {
      console.log('\n🔧 Running full database maintenance...')
      
      // 1. Integrity check first
      const isHealthy = await this.integrityCheck()
      if (!isHealthy) {
        console.log('❌ Stopping maintenance - database integrity issues detected')
        return
      }
      
      // 2. Show current stats
      await this.getStats()
      
      // 3. Run VACUUM
      await this.vacuum()
      
      // 4. Run ANALYZE
      await this.analyze()
      
      // 5. Final stats
      console.log('\n📈 Maintenance completed successfully!')
      
    } catch (error) {
      console.log('❌ Full maintenance failed:', error.message)
      throw error
    }
  }
}

/**
 * Main execution function
 */
async function runMaintenance() {
  const maintenance = new DatabaseMaintenance()
  
  try {
    // Check command line arguments
    const args = process.argv.slice(2)
    const operation = args[0] || 'full'
    
    let confirmed = false
    
    switch (operation.toLowerCase()) {
      case 'vacuum':
        confirmed = await maintenance.getUserConfirmation('VACUUM')
        if (confirmed) await maintenance.vacuum()
        break
        
      case 'analyze':
        confirmed = await maintenance.getUserConfirmation('ANALYZE')
        if (confirmed) await maintenance.analyze()
        break
        
      case 'check':
        confirmed = await maintenance.getUserConfirmation('INTEGRITY CHECK')
        if (confirmed) await maintenance.integrityCheck()
        break
        
      case 'stats':
        await maintenance.getStats()
        break
        
      case 'full':
      default:
        confirmed = await maintenance.getUserConfirmation('FULL MAINTENANCE')
        if (confirmed) await maintenance.fullMaintenance()
        break
    }
    
    if (!confirmed && operation !== 'stats') {
      console.log('\n❌ Operation cancelled by user')
    }
    
  } catch (error) {
    console.error('\n💥 Database maintenance failed:', error.message)
    process.exit(1)
  }
}

// Show usage if --help is provided
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('\n🔧 Database Maintenance Script')
  console.log('===============================')
  console.log('Usage: npm run db-maintenance [operation]')
  console.log('')
  console.log('Operations:')
  console.log('  full     - Run full maintenance (integrity check, vacuum, analyze)')
  console.log('  vacuum   - Reclaim database space and defragment')
  console.log('  analyze  - Update table statistics for better performance')
  console.log('  check    - Run integrity check')
  console.log('  stats    - Show database statistics')
  console.log('')
  console.log('Examples:')
  console.log('  npm run db-maintenance')
  console.log('  npm run db-maintenance vacuum')
  console.log('  docker exec -it <container> npm run db-maintenance vacuum')
  process.exit(0)
}

// Run the maintenance
runMaintenance().then(() => {
  console.log('\n🏁 Database maintenance completed')
  process.exit(0)
}).catch((error) => {
  console.error('\n💥 Database maintenance failed:', error)
  process.exit(1)
})