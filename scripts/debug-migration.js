import { databaseService } from '../server/database.js'
import { imageProcessor } from '../server/image-processor.js'
import { logger } from '../server/logger.js'

/**
 * Debug script to test image migration functionality step by step
 */
async function debugMigration() {
  try {
    console.log('🔍 DEBUG: Testing migration functionality...\n')
    
    // Step 1: Check database connection and path
    console.log('1. Database Information:')
    console.log('   Path:', databaseService.getDatabasePath())
    console.log('   Environment:', process.env.NODE_ENV || 'development')
    
    // Step 2: Get all expenses
    const allExpenses = await databaseService.getAllExpenses()
    const expensesWithImages = allExpenses.filter(e => e.has_image)
    
    console.log('\n2. Expense Analysis:')
    console.log('   Total expenses:', allExpenses.length)
    console.log('   Expenses with images:', expensesWithImages.length)
    
    if (expensesWithImages.length === 0) {
      console.log('   ❌ No images found to test with')
      return
    }
    
    // Step 3: Test with first image
    const testExpense = expensesWithImages[0]
    console.log('\n3. Testing with expense ID:', testExpense.id)
    console.log('   Amount:', testExpense.amount)
    console.log('   Timestamp:', testExpense.timestamp)
    
    // Step 4: Get original image
    console.log('\n4. Getting original image...')
    const originalImageBuffer = await databaseService.getExpenseImage(testExpense.id)
    
    if (!originalImageBuffer) {
      console.log('   ❌ No image buffer returned from database')
      return
    }
    
    console.log('   ✅ Original image size:', originalImageBuffer.length, 'bytes')
    console.log('   ✅ Original image size:', (originalImageBuffer.length / 1024).toFixed(1), 'KB')
    
    // Step 5: Analyze original image
    console.log('\n5. Analyzing original image...')
    const isValid = await imageProcessor.isValidImage(originalImageBuffer)
    console.log('   Is valid image:', isValid)
    
    if (!isValid) {
      console.log('   ❌ Invalid image format')
      return
    }
    
    const imageInfo = await imageProcessor.getImageInfo(originalImageBuffer)
    console.log('   Format:', imageInfo.format)
    console.log('   Dimensions:', `${imageInfo.width}x${imageInfo.height}`)
    console.log('   Channels:', imageInfo.channels)
    
    // Step 6: Check if already WebP
    const isWebP = originalImageBuffer[0] === 0x52 && 
                   originalImageBuffer[1] === 0x49 && 
                   originalImageBuffer[2] === 0x46 && 
                   originalImageBuffer[3] === 0x46 &&
                   originalImageBuffer[8] === 0x57 && 
                   originalImageBuffer[9] === 0x45 && 
                   originalImageBuffer[10] === 0x42 && 
                   originalImageBuffer[11] === 0x50
    
    console.log('   Is WebP (by header):', isWebP)
    console.log('   Is WebP (by Sharp):', imageInfo.format === 'webp')
    
    if (isWebP && originalImageBuffer.length < 500000) {
      console.log('   ⚠️  Image appears already optimized (WebP < 500KB)')
      console.log('   Would be skipped by migration script')
    }
    
    // Step 7: Process image
    console.log('\n6. Processing image...')
    const optimalOptions = await imageProcessor.getOptimalOptions(originalImageBuffer)
    console.log('   Optimal options:', optimalOptions)
    
    const processedImageBuffer = await imageProcessor.processImage(originalImageBuffer, optimalOptions)
    console.log('   ✅ Processed image size:', processedImageBuffer.length, 'bytes')
    console.log('   ✅ Processed image size:', (processedImageBuffer.length / 1024).toFixed(1), 'KB')
    console.log('   Compression ratio:', ((originalImageBuffer.length - processedImageBuffer.length) / originalImageBuffer.length * 100).toFixed(1) + '%')
    
    // Step 8: Test database update (but don't actually do it)
    console.log('\n7. Database Update Test:')
    console.log('   Original buffer length:', originalImageBuffer.length)
    console.log('   Processed buffer length:', processedImageBuffer.length)
    console.log('   Would update expense ID:', testExpense.id)
    
    // Let's check if the buffers are actually different
    const areBuffersSame = originalImageBuffer.equals(processedImageBuffer)
    console.log('   Buffers are identical:', areBuffersSame)
    
    if (areBuffersSame) {
      console.log('   ⚠️  ISSUE: Processed image is identical to original!')
      console.log('   This explains why database size doesn\'t change')
    }
    
    // Step 9: Ask user if they want to actually update
    console.log('\n8. Actual Update Test:')
    console.log('   Do you want to test updating this ONE image in the database?')
    console.log('   This will modify expense ID', testExpense.id)
    console.log('   Type "yes" to proceed, anything else to skip:')
    
    const readline = await import('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    const answer = await new Promise((resolve) => {
      rl.question('   > ', (answer) => {
        rl.close()
        resolve(answer.toLowerCase())
      })
    })
    
    if (answer === 'yes') {
      console.log('\n   Updating database...')
      const success = await databaseService.updateExpenseImage(testExpense.id, processedImageBuffer)
      
      if (success) {
        console.log('   ✅ Database update successful')
        
        // Verify the update
        const updatedImageBuffer = await databaseService.getExpenseImage(testExpense.id)
        console.log('   Verification: New image size:', updatedImageBuffer.length, 'bytes')
        console.log('   Verification: Size matches processed:', updatedImageBuffer.length === processedImageBuffer.length)
        
        const updatedImageInfo = await imageProcessor.getImageInfo(updatedImageBuffer)
        console.log('   Verification: New format:', updatedImageInfo.format)
      } else {
        console.log('   ❌ Database update failed')
      }
    } else {
      console.log('   Skipped database update')
    }
    
    console.log('\n✅ Debug completed!')
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message)
    console.error('Stack:', error.stack)
  }
}

// Run the debug
debugMigration().then(() => {
  console.log('\n🏁 Debug script completed')
  process.exit(0)
}).catch((error) => {
  console.error('\n💥 Debug script failed:', error)
  process.exit(1)
})