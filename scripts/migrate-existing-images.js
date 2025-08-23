import { databaseService } from '../server/database.js'
import { imageProcessor } from '../server/image-processor.js'
import { logger } from '../server/logger.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Migration script to convert existing database images to optimized WebP format
 * with proper orientation correction
 */
class ImageMigration {
  constructor() {
    this.stats = {
      totalImages: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      totalSizeBefore: 0,
      totalSizeAfter: 0,
      startTime: Date.now()
    }
  }

  /**
   * Get user confirmation before running migration
   */
  async getUserConfirmation() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise((resolve) => {
      console.log('\n🚨 IMAGE MIGRATION WARNING 🚨')
      console.log('=====================================')
      console.log('This script will:')
      console.log('• Convert all existing images to WebP format with compression')
      console.log('• Apply orientation correction to fix rotated images')
      console.log('• Potentially reduce image file sizes by 60-75%')
      console.log('• PERMANENTLY modify your database images')
      console.log('\n⚠️  IMPORTANT:')
      console.log('• Make sure you have a database backup before proceeding')
      console.log('• This operation cannot be undone')
      console.log('• The migration may take several minutes depending on image count')
      console.log('\n📋 Current database:', databaseService.getDatabasePath())
      
      rl.question('\nDo you want to proceed with the migration? (yes/no): ', (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
      })
    })
  }

  /**
   * Create a database backup before migration
   */
  async createBackup() {
    try {
      const dbPath = databaseService.getDatabasePath()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(path.dirname(dbPath), `expenses-backup-before-image-migration-${timestamp}.db`)
      
      console.log(`\n📥 Creating backup: ${backupPath}`)
      
      if (!fs.existsSync(dbPath)) {
        throw new Error('Database file not found')
      }
      
      fs.copyFileSync(dbPath, backupPath)
      const stats = fs.statSync(backupPath)
      
      console.log(`✅ Backup created successfully (${(stats.size / 1024 / 1024).toFixed(2)}MB)`)
      return backupPath
    } catch (error) {
      console.error('❌ Failed to create backup:', error.message)
      throw error
    }
  }

  /**
   * Get all expenses that have images
   */
  async getExpensesWithImages() {
    try {
      const expenses = await databaseService.getAllExpenses()
      return expenses.filter(expense => expense.has_image)
    } catch (error) {
      console.error('❌ Failed to get expenses:', error.message)
      throw error
    }
  }

  /**
   * Process a single image
   */
  async processImage(expenseId) {
    try {
      // Get the original image
      const originalImageBuffer = await databaseService.getExpenseImage(expenseId)
      if (!originalImageBuffer) {
        this.stats.skipped++
        console.log(`⏭️  Expense ${expenseId}: No image found`)
        return
      }

      const originalSize = originalImageBuffer.length
      this.stats.totalSizeBefore += originalSize

      // Get image info to determine format reliably
      const imageInfo = await imageProcessor.getImageInfo(originalImageBuffer)
      console.log(`📸 Expense ${expenseId}: ${imageInfo.format} ${imageInfo.width}x${imageInfo.height} (${(originalSize/1024).toFixed(1)}KB)`)

      // Check if image is already optimized WebP
      if (imageInfo.format === 'webp' && originalSize < 500000) { // If already WebP and under 500KB, probably already optimized
        this.stats.skipped++
        this.stats.totalSizeAfter += originalSize
        console.log(`⏭️  Expense ${expenseId}: Already optimized WebP, skipping`)
        return
      }

      // Validate the image
      const isValid = await imageProcessor.isValidImage(originalImageBuffer)
      if (!isValid) {
        this.stats.failed++
        console.log(`❌ Expense ${expenseId}: Invalid image format`)
        return
      }

      // Process the image with optimization (imageInfo already obtained above)
      const optimalOptions = await imageProcessor.getOptimalOptions(originalImageBuffer)
      const processedImageBuffer = await imageProcessor.processImage(originalImageBuffer, optimalOptions)
      
      const processedSize = processedImageBuffer.length
      this.stats.totalSizeAfter += processedSize
      const compressionRatio = ((originalSize - processedSize) / originalSize * 100).toFixed(1)

      // Update the database with processed image
      console.log(`💾 Expense ${expenseId}: Updating database with ${(processedSize/1024).toFixed(1)}KB processed image...`)
      const success = await databaseService.updateExpenseImage(expenseId, processedImageBuffer)
      
      if (success) {
        this.stats.processed++
        console.log(`✅ Expense ${expenseId}: ${imageInfo.format} ${imageInfo.width}x${imageInfo.height} → WebP (${(originalSize/1024).toFixed(1)}KB → ${(processedSize/1024).toFixed(1)}KB, ${compressionRatio}% compression)`)
        
        // Verify the update by re-reading the image
        const verificationBuffer = await databaseService.getExpenseImage(expenseId)
        if (verificationBuffer && verificationBuffer.length === processedSize) {
          console.log(`✅ Expense ${expenseId}: Database update verified`)
        } else {
          console.log(`⚠️  Expense ${expenseId}: Database verification failed - size mismatch`)
        }
      } else {
        this.stats.failed++
        console.log(`❌ Expense ${expenseId}: Database update failed`)
      }

    } catch (error) {
      this.stats.failed++
      console.log(`❌ Expense ${expenseId}: Processing failed - ${error.message}`)
    }
  }

  /**
   * Run the migration
   */
  async migrate() {
    try {
      // Get user confirmation
      const confirmed = await getUserConfirmation()
      if (!confirmed) {
        console.log('\n❌ Migration cancelled by user')
        return
      }

      // Create backup
      await this.createBackup()

      // Get expenses with images
      console.log('\n🔍 Finding expenses with images...')
      const expensesWithImages = await this.getExpensesWithImages()
      this.stats.totalImages = expensesWithImages.length

      if (this.stats.totalImages === 0) {
        console.log('ℹ️  No images found in database. Nothing to migrate.')
        return
      }

      console.log(`\n📊 Found ${this.stats.totalImages} expenses with images`)
      console.log('🚀 Starting migration...\n')

      // Process each image
      for (let i = 0; i < expensesWithImages.length; i++) {
        const expense = expensesWithImages[i]
        const progress = ((i + 1) / this.stats.totalImages * 100).toFixed(1)
        
        console.log(`\n[${i + 1}/${this.stats.totalImages}] (${progress}%) Processing expense ${expense.id}...`)
        await this.processImage(expense.id)
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Print final statistics
      this.printFinalStats()

      // Reclaim database space if any images were processed
      if (this.stats.processed > 0) {
        await this.reclaimDatabaseSpace()
      }

    } catch (error) {
      console.error('💥 Migration failed:', error.message)
      throw error
    }
  }

  /**
   * Print final migration statistics
   */
  printFinalStats() {
    const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(1)
    const totalSavings = this.stats.totalSizeBefore - this.stats.totalSizeAfter
    const overallCompression = this.stats.totalSizeBefore > 0 
      ? ((totalSavings / this.stats.totalSizeBefore) * 100).toFixed(1)
      : '0'

    console.log('\n🎉 MIGRATION COMPLETED!')
    console.log('========================')
    console.log(`⏱️  Duration: ${duration}s`)
    console.log(`📊 Total images found: ${this.stats.totalImages}`)
    console.log(`✅ Successfully processed: ${this.stats.processed}`)
    console.log(`⏭️  Skipped (already optimized): ${this.stats.skipped}`)
    console.log(`❌ Failed: ${this.stats.failed}`)
    console.log(`📦 Size before: ${(this.stats.totalSizeBefore / 1024 / 1024).toFixed(2)}MB`)
    console.log(`📦 Size after: ${(this.stats.totalSizeAfter / 1024 / 1024).toFixed(2)}MB`)
    console.log(`💾 Total saved: ${(totalSavings / 1024 / 1024).toFixed(2)}MB (${overallCompression}% reduction)`)

    if (this.stats.failed > 0) {
      console.log(`\n⚠️  ${this.stats.failed} images failed to process. Check the logs above for details.`)
    }

    console.log('\n✨ Your database images have been optimized and orientation-corrected!')
  }

  /**
   * Reclaim database space after image optimization
   */
  async reclaimDatabaseSpace() {
    try {
      console.log('\n🗜️  Reclaiming database space...')
      
      // Get database file size before VACUUM
      const dbPath = databaseService.getDatabasePath()
      const fs = await import('fs')
      const statsBefore = fs.statSync(dbPath)
      const sizeBefore = statsBefore.size
      
      console.log(`📦 Database size before cleanup: ${(sizeBefore / 1024 / 1024).toFixed(2)}MB`)
      
      // Access the database instance directly for VACUUM operation
      const db = databaseService.db
      
      console.log('🔄 Running VACUUM operation (this may take a few seconds)...')
      const startTime = Date.now()
      
      // Run VACUUM to reclaim space
      db.exec('VACUUM')
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      
      // Get database file size after VACUUM
      const statsAfter = fs.statSync(dbPath)
      const sizeAfter = statsAfter.size
      const spaceSaved = sizeBefore - sizeAfter
      
      console.log(`✅ VACUUM completed in ${duration}s`)
      console.log(`📦 Database size after cleanup: ${(sizeAfter / 1024 / 1024).toFixed(2)}MB`)
      console.log(`💾 Space reclaimed: ${(spaceSaved / 1024 / 1024).toFixed(2)}MB`)
      
      if (spaceSaved > 0) {
        console.log(`🎉 Total database size reduction: ${((spaceSaved / sizeBefore) * 100).toFixed(1)}%`)
      } else {
        console.log('ℹ️  No additional space could be reclaimed')
      }
      
    } catch (error) {
      console.log('⚠️  Warning: Could not reclaim database space:', error.message)
      console.log('   This is not critical - the image optimization was successful')
      console.log('   You can manually run VACUUM later if needed')
    }
  }
}

// Helper function for user confirmation (moved outside class for cleaner async handling)
async function getUserConfirmation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    const dbPath = databaseService.getDatabasePath()
    const isProduction = process.env.NODE_ENV === 'production'
    const environment = isProduction ? 'PRODUCTION' : 'DEVELOPMENT'
    
    console.log('\n🚨 IMAGE MIGRATION WARNING 🚨')
    console.log('=====================================')
    console.log('This script will:')
    console.log('• Convert all existing images to WebP format with compression')
    console.log('• Apply orientation correction to fix rotated images')
    console.log('• Potentially reduce image file sizes by 60-75%')
    console.log('• PERMANENTLY modify your database images')
    console.log('\n⚠️  IMPORTANT:')
    console.log('• Make sure you have a database backup before proceeding')
    console.log('• This operation cannot be undone')
    console.log('• The migration may take several minutes depending on image count')
    console.log(`\n🌍 Environment: ${environment}`)
    console.log('📋 Database path:', dbPath)
    
    if (isProduction) {
      console.log('\n🔴 PRODUCTION ENVIRONMENT DETECTED!')
      console.log('• You are about to modify your live production database')
      console.log('• Consider stopping the application during migration to prevent conflicts')
      console.log('• Backup will be created automatically, but ensure you have external backups')
    }
    
    rl.question('\nDo you want to proceed with the migration? (yes/no): ', (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y')
    })
  })
}

// Run the migration
const migration = new ImageMigration()
migration.migrate().then(() => {
  console.log('\n🏁 Migration script completed')
  process.exit(0)
}).catch((error) => {
  console.error('\n💥 Migration script failed:', error)
  process.exit(1)
})