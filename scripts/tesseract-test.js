import Tesseract from 'tesseract.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isUrl(str) {
  // Check if it's an HTTP/HTTPS URL
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function downloadImage(imageUrl, outputPath) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  
  const buffer = await response.buffer();
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

async function runOCR(imagePath) {
  console.log('Processing image with Tesseract...\n');
  
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\rProgress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    console.log('\n\n=== TESSERACT OUTPUT ===\n');
    console.log(text);
    console.log('\n=== END OUTPUT ===');
    
    return text;
  } catch (error) {
    console.error('OCR Error:', error.message);
    throw error;
  }
}

function showUsage() {
  console.log('Usage:');
  console.log('  npm run tesseract <image-url>     # Process image from HTTP URL');
  console.log('  npm run tesseract <file-path>     # Process local image file');
  console.log('');
  console.log('Examples:');
  console.log('  npm run tesseract https://example.com/receipt.jpg');
  console.log('  npm run tesseract ./receipts/receipt1.png');
  console.log('  npm run tesseract C:\\Users\\Tyler\\Pictures\\receipt.jpg');
}

async function main() {
  const imagePath = process.argv[2];
  
  if (!imagePath) {
    showUsage();
    process.exit(1);
  }
  
  const tempDir = path.join(__dirname, '..', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  let finalImagePath;
  let shouldCleanup = false;
  
  try {
    if (isUrl(imagePath)) {
      // Handle URL
      console.log(`Downloading image from: ${imagePath}`);
      const tempImagePath = path.join(tempDir, `temp-receipt-${Date.now()}.jpg`);
      finalImagePath = await downloadImage(imagePath, tempImagePath);
      shouldCleanup = true;
      console.log('Image downloaded successfully');
    } else {
      // Handle local file
      if (!fs.existsSync(imagePath)) {
        throw new Error(`File not found: ${imagePath}`);
      }
      console.log(`Using local file: ${imagePath}`);
      finalImagePath = imagePath;
    }
    
    await runOCR(finalImagePath);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    // Clean up temp file only if we downloaded it
    if (shouldCleanup && fs.existsSync(finalImagePath)) {
      fs.unlinkSync(finalImagePath);
    }
  }
}

main();