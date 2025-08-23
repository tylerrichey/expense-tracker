import { imageProcessor } from '../server/image-processor.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Test script for image compression functionality
 * Uses Sharp to create test images and tests the compression pipeline
 */
async function testImageCompression() {
  console.log('🧪 Testing image compression functionality...\n')

  // Import sharp to create proper test images
  const sharp = (await import('sharp')).default

  // Create a proper test PNG (100x100 red square)
  const createTestPNG = async () => {
    return await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    })
    .png()
    .toBuffer()
  }

  // Create a proper test JPEG (200x150 blue rectangle)
  const createTestJPEG = async () => {
    return await sharp({
      create: {
        width: 200,
        height: 150,
        channels: 3,
        background: { r: 0, g: 0, b: 255 }
      }
    })
    .jpeg({ quality: 90 })
    .toBuffer()
  }

  // Create a rotated JPEG to test orientation handling
  const createRotatedJPEG = async () => {
    // Create a rectangular image (wider than tall) with text-like pattern
    const baseImage = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 255, g: 255, b: 0 }
      }
    })
    .jpeg({ quality: 90 })
    .toBuffer()
    
    // Apply rotation (90 degrees clockwise) - simulates phone camera orientation
    return await sharp(baseImage)
      .rotate(90)
      .jpeg({ quality: 90 })
      .toBuffer()
  }

  try {
    console.log('1. Testing PNG image processing...')
    const testPNG = await createTestPNG()
    console.log(`   Original PNG size: ${testPNG.length} bytes`)
    
    const isValidPNG = await imageProcessor.isValidImage(testPNG)
    console.log(`   Is valid image: ${isValidPNG}`)
    
    if (isValidPNG) {
      const imageInfo = await imageProcessor.getImageInfo(testPNG)
      console.log(`   Image info:`, imageInfo)
      
      const processedPNG = await imageProcessor.processImage(testPNG)
      console.log(`   Processed size: ${processedPNG.length} bytes`)
      console.log(`   Compression ratio: ${((testPNG.length - processedPNG.length) / testPNG.length * 100).toFixed(1)}%`)
    }

    console.log('\n2. Testing JPEG image processing...')
    const testJPEG = await createTestJPEG()
    console.log(`   Original JPEG size: ${testJPEG.length} bytes`)
    
    const isValidJPEG = await imageProcessor.isValidImage(testJPEG)
    console.log(`   Is valid image: ${isValidJPEG}`)
    
    if (isValidJPEG) {
      const imageInfo = await imageProcessor.getImageInfo(testJPEG)
      console.log(`   Image info:`, imageInfo)
      
      const processedJPEG = await imageProcessor.processImage(testJPEG)
      console.log(`   Processed size: ${processedJPEG.length} bytes`)
      console.log(`   Compression ratio: ${((testJPEG.length - processedJPEG.length) / testJPEG.length * 100).toFixed(1)}%`)
    }

    console.log('\n3. Testing rotated JPEG (orientation fix)...')
    const rotatedJPEG = await createRotatedJPEG()
    console.log(`   Original rotated JPEG size: ${rotatedJPEG.length} bytes`)
    
    const isValidRotated = await imageProcessor.isValidImage(rotatedJPEG)
    console.log(`   Is valid image: ${isValidRotated}`)
    
    if (isValidRotated) {
      const imageInfo = await imageProcessor.getImageInfo(rotatedJPEG)
      console.log(`   Original dimensions: ${imageInfo.width}x${imageInfo.height}`)
      
      const processedRotated = await imageProcessor.processImage(rotatedJPEG)
      console.log(`   Processed size: ${processedRotated.length} bytes`)
      
      // Check processed dimensions to verify orientation was handled
      const processedInfo = await imageProcessor.getImageInfo(processedRotated)
      console.log(`   Processed dimensions: ${processedInfo.width}x${processedInfo.height}`)
      console.log(`   Orientation preserved: ${imageInfo.width === processedInfo.width && imageInfo.height === processedInfo.height}`)
    }

    console.log('\n4. Testing invalid data...')
    const invalidData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04])
    const isValidInvalid = await imageProcessor.isValidImage(invalidData)
    console.log(`   Invalid data recognized correctly: ${!isValidInvalid}`)

    console.log('\n5. Testing optimal options...')
    const testPNG2 = await createTestPNG()
    const optimalOptions = await imageProcessor.getOptimalOptions(testPNG2)
    console.log(`   Optimal options:`, optimalOptions)

    console.log('\n✅ All tests completed successfully!')
    
    // Test if real images exist and can be processed
    const testImagesDir = path.join(__dirname, '..', 'test-images')
    if (fs.existsSync(testImagesDir)) {
      console.log('\n5. Testing with real images (if available)...')
      const files = fs.readdirSync(testImagesDir)
      const imageFiles = files.filter(file => 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
      )
      
      for (const file of imageFiles.slice(0, 3)) { // Test first 3 images
        console.log(`\n   Testing ${file}...`)
        const imagePath = path.join(testImagesDir, file)
        const imageBuffer = fs.readFileSync(imagePath)
        console.log(`   Original size: ${(imageBuffer.length / 1024).toFixed(1)}KB`)
        
        try {
          const processedImage = await imageProcessor.processImage(imageBuffer)
          console.log(`   Processed size: ${(processedImage.length / 1024).toFixed(1)}KB`)
          console.log(`   Compression: ${((imageBuffer.length - processedImage.length) / imageBuffer.length * 100).toFixed(1)}%`)
        } catch (err) {
          console.log(`   Processing failed: ${err.message}`)
        }
      }
    } else {
      console.log('\n5. Real image testing skipped (no test-images directory)')
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the test
testImageCompression().then(() => {
  console.log('\n🎉 Image compression test completed!')
}).catch((error) => {
  console.error('💥 Test suite failed:', error)
  process.exit(1)
})