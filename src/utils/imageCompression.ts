/**
 * Client-side image compression utility using Canvas API
 * Provides compression with fallback to server-side processing
 */

export interface CompressionOptions {
  quality?: number
  maxWidth?: number
  maxHeight?: number
  format?: 'webp' | 'jpeg' | 'png'
}

export interface CompressionResult {
  file: File
  originalSize: number
  compressedSize: number
  compressionRatio: number
  method: 'client' | 'server'
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  quality: 0.85,
  maxWidth: 1920,
  maxHeight: 1920,
  format: 'webp'
}

/**
 * Check if client-side compression is supported
 */
export function isCompressionSupported(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    // Check for Canvas API support
    if (!ctx) return false
    
    // Check for WebP support by trying to create a WebP data URL
    const webpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp')
    
    // Check for File API support
    const fileApiSupported = typeof File !== 'undefined' && typeof Blob !== 'undefined'
    
    return webpSupported && fileApiSupported
  } catch (error) {
    return false
  }
}

/**
 * Compress an image file on the client-side using Canvas API
 */
export async function compressImageClient(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const originalSize = file.size

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        const { width: newWidth, height: newHeight } = calculateDimensions(
          img.width,
          img.height,
          opts.maxWidth,
          opts.maxHeight
        )

        // Set canvas size
        canvas.width = newWidth
        canvas.height = newHeight

        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // Draw the resized image
        ctx.drawImage(img, 0, 0, newWidth, newHeight)

        // Convert to blob with specified format and quality
        const mimeType = `image/${opts.format}`
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }

            // Create a new File from the blob
            const compressedFile = new File([blob], file.name, {
              type: mimeType,
              lastModified: file.lastModified
            })

            const compressedSize = compressedFile.size
            const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100

            resolve({
              file: compressedFile,
              originalSize,
              compressedSize,
              compressionRatio: Math.max(0, compressionRatio),
              method: 'client'
            })
          },
          mimeType,
          opts.quality
        )
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    // Load the image
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight }
  }

  const widthRatio = maxWidth / originalWidth
  const heightRatio = maxHeight / originalHeight
  const ratio = Math.min(widthRatio, heightRatio)

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio)
  }
}

/**
 * Compress image with automatic fallback to server-side compression
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  // Check if file is an image
  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image')
  }

  // Try client-side compression first if supported
  if (isCompressionSupported()) {
    try {
      const result = await compressImageClient(file, options)
      
      // Only use client-side result if it actually reduced file size
      if (result.compressionRatio > 5) {
        return result
      }
      
      // If compression didn't help much, fall back to server
      console.log('Client compression minimal, falling back to server')
    } catch (error) {
      console.warn('Client-side compression failed, falling back to server:', error)
    }
  }

  // Fallback to server-side compression
  return {
    file,
    originalSize: file.size,
    compressedSize: file.size,
    compressionRatio: 0,
    method: 'server'
  }
}

/**
 * Get optimal compression options based on file characteristics
 */
export function getOptimalOptions(file: File): CompressionOptions {
  const fileSizeKB = file.size / 1024
  let quality = DEFAULT_OPTIONS.quality

  // Adjust quality based on file size
  if (fileSizeKB > 2000) {
    quality = 0.80
  } else if (fileSizeKB > 1000) {
    quality = 0.82
  }

  // For PNG files, WebP usually provides better compression
  const format = file.type === 'image/png' ? 'webp' : DEFAULT_OPTIONS.format

  return {
    quality,
    format,
    maxWidth: DEFAULT_OPTIONS.maxWidth,
    maxHeight: DEFAULT_OPTIONS.maxHeight
  }
}