import sharp from 'sharp'
import { logger } from './logger.js'

/**
 * Image processing service for optimizing uploaded images
 * Converts images to WebP format and applies compression
 */
class ImageProcessor {
  constructor() {
    this.defaultOptions = {
      // WebP quality setting (0-100, lower = smaller file)
      quality: 85,
      // Maximum width for resizing (maintains aspect ratio)
      maxWidth: 1920,
      // Maximum height for resizing (maintains aspect ratio)
      maxHeight: 1920,
      // Output format
      format: 'webp'
    }
  }

  /**
   * Process an image buffer to optimize size while maintaining quality
   * @param {Buffer} imageBuffer - Raw image buffer from multer
   * @param {Object} options - Processing options
   * @returns {Promise<Buffer>} - Processed image buffer
   */
  async processImage(imageBuffer, options = {}) {
    try {
      const opts = { ...this.defaultOptions, ...options }
      
      // Get original image metadata
      const metadata = await sharp(imageBuffer).metadata()
      logger.log('info', '📷 Processing image:', {
        originalFormat: metadata.format,
        originalSize: imageBuffer.length,
        originalDimensions: `${metadata.width}x${metadata.height}`,
        targetFormat: opts.format,
        quality: opts.quality
      })

      // Create Sharp processing pipeline with orientation correction
      let pipeline = sharp(imageBuffer)
        .rotate() // Auto-rotate based on EXIF orientation

      logger.log('info', '🔄 Applied EXIF orientation correction')

      // Resize if image is larger than max dimensions
      // Note: After rotation, we need to check the corrected dimensions
      const rotatedMetadata = await pipeline.metadata()
      if (rotatedMetadata.width > opts.maxWidth || rotatedMetadata.height > opts.maxHeight) {
        pipeline = pipeline.resize(opts.maxWidth, opts.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        logger.log('info', `📏 Resizing image to max ${opts.maxWidth}x${opts.maxHeight}`)
      }

      // Convert to target format with quality optimization
      let processedBuffer
      switch (opts.format) {
        case 'webp':
          processedBuffer = await pipeline
            .webp({ quality: opts.quality })
            .toBuffer()
          break
        case 'jpeg':
          processedBuffer = await pipeline
            .jpeg({ quality: opts.quality })
            .toBuffer()
          break
        case 'png':
          processedBuffer = await pipeline
            .png({ quality: opts.quality })
            .toBuffer()
          break
        default:
          // Default to WebP for best compression
          processedBuffer = await pipeline
            .webp({ quality: opts.quality })
            .toBuffer()
      }

      // Calculate compression metrics
      const originalSize = imageBuffer.length
      const processedSize = processedBuffer.length
      const compressionRatio = ((originalSize - processedSize) / originalSize * 100).toFixed(1)

      logger.log('info', '✅ Image processing completed:', {
        originalSize: `${(originalSize / 1024).toFixed(1)}KB`,
        processedSize: `${(processedSize / 1024).toFixed(1)}KB`,
        compressionRatio: `${compressionRatio}%`,
        format: opts.format
      })

      return processedBuffer

    } catch (error) {
      logger.log('error', '❌ Image processing failed:', { 
        error: error.message,
        stack: error.stack
      })
      throw error
    }
  }

  /**
   * Get optimal processing options based on image characteristics
   * @param {Buffer} imageBuffer - Raw image buffer
   * @returns {Promise<Object>} - Recommended processing options
   */
  async getOptimalOptions(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata()
      const fileSizeKB = imageBuffer.length / 1024

      // Adjust quality based on file size and format
      let quality = this.defaultOptions.quality
      
      // For very large images, use more aggressive compression
      if (fileSizeKB > 2000) {
        quality = 80
      } else if (fileSizeKB > 1000) {
        quality = 82
      }

      // PNG images often benefit from WebP conversion
      let format = 'webp'
      if (metadata.format === 'png' && metadata.channels === 4) {
        // PNG with transparency - keep as WebP for transparency support
        format = 'webp'
      }

      return {
        quality,
        format,
        maxWidth: this.defaultOptions.maxWidth,
        maxHeight: this.defaultOptions.maxHeight
      }
    } catch (error) {
      logger.log('error', 'Error analyzing image for optimal options:', { error: error.message })
      return this.defaultOptions
    }
  }

  /**
   * Validate if buffer contains a valid image
   * @param {Buffer} buffer - Image buffer to validate
   * @returns {Promise<boolean>} - True if valid image
   */
  async isValidImage(buffer) {
    try {
      const metadata = await sharp(buffer).metadata()
      return !!(metadata.width && metadata.height && metadata.format)
    } catch (error) {
      return false
    }
  }

  /**
   * Get image metadata without processing
   * @param {Buffer} buffer - Image buffer
   * @returns {Promise<Object>} - Image metadata
   */
  async getImageInfo(buffer) {
    try {
      const metadata = await sharp(buffer).metadata()
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: buffer.length,
        channels: metadata.channels,
        hasAlpha: metadata.channels === 4
      }
    } catch (error) {
      logger.log('error', 'Error getting image info:', { error: error.message })
      throw error
    }
  }
}

// Export singleton instance
export const imageProcessor = new ImageProcessor()