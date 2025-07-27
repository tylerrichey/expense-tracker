import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isUrl(str) {
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

async function processReceipt(imagePath) {
  // Initialize the Document AI client
  const client = new DocumentProcessorServiceClient();

  // You'll need to set these environment variables:
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us'; // or 'eu'
  const processorId = process.env.GOOGLE_CLOUD_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error(
      'Missing required environment variables:\n' +
      '- GOOGLE_CLOUD_PROJECT_ID\n' +
      '- GOOGLE_CLOUD_PROCESSOR_ID\n' +
      '- GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)\n' +
      'Optional:\n' +
      '- GOOGLE_CLOUD_LOCATION (defaults to "us")'
    );
  }

  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  // Read the file
  const imageFile = fs.readFileSync(imagePath);
  const encodedImage = Buffer.from(imageFile).toString('base64');

  // Determine MIME type based on file extension
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf'
  };
  const mimeType = mimeTypeMap[ext] || 'image/jpeg';

  const request = {
    name,
    rawDocument: {
      content: encodedImage,
      mimeType: mimeType,
    },
  };

  console.log('Processing receipt with Google Document AI...\n');

  try {
    const [result] = await client.processDocument(request);
    const { document } = result;

    console.log('=== GOOGLE DOCUMENT AI RESULTS ===\n');

    // Extract receipt-specific entities
    if (document.entities && document.entities.length > 0) {
      console.log('📄 RECEIPT DETAILS:\n');
      
      const entities = {};
      document.entities.forEach(entity => {
        if (!entities[entity.type]) {
          entities[entity.type] = [];
        }
        entities[entity.type].push({
          text: entity.mentionText,
          confidence: entity.confidence || 0
        });
      });

      // Display key receipt information
      const keyFields = [
        'receipt_date',
        'supplier_name', 
        'total_amount',
        'subtotal_amount',
        'tax_amount',
        'tip_amount',
        'line_item'
      ];

      keyFields.forEach(field => {
        if (entities[field]) {
          console.log(`${field.toUpperCase().replace('_', ' ')}:`);
          entities[field].forEach(item => {
            console.log(`  - ${item.text} (confidence: ${(item.confidence * 100).toFixed(1)}%)`);
          });
          console.log('');
        }
      });

      // Display all other entities
      const otherEntities = Object.keys(entities).filter(key => !keyFields.includes(key));
      if (otherEntities.length > 0) {
        console.log('OTHER DETECTED ENTITIES:');
        otherEntities.forEach(field => {
          console.log(`${field.toUpperCase().replace('_', ' ')}:`);
          entities[field].forEach(item => {
            console.log(`  - ${item.text} (confidence: ${(item.confidence * 100).toFixed(1)}%)`);
          });
          console.log('');
        });
      }
    }

    // Also show raw text if no entities found
    if (!document.entities || document.entities.length === 0) {
      console.log('No structured entities found. Raw text:\n');
      console.log(document.text);
    }

    console.log('\n=== END RESULTS ===');

    return document;
  } catch (error) {
    console.error('Document AI Error:', error.message);
    throw error;
  }
}

function showUsage() {
  console.log('Usage:');
  console.log('  npm run google-docai <image-url>     # Process image from HTTP URL');
  console.log('  npm run google-docai <file-path>     # Process local image file');
  console.log('');
  console.log('Required Environment Variables:');
  console.log('  GOOGLE_CLOUD_PROJECT_ID       # Your Google Cloud project ID');
  console.log('  GOOGLE_CLOUD_PROCESSOR_ID     # Document AI processor ID');
  console.log('  GOOGLE_APPLICATION_CREDENTIALS # Path to service account JSON file');
  console.log('');
  console.log('Optional Environment Variables:');
  console.log('  GOOGLE_CLOUD_LOCATION         # Location (default: "us")');
  console.log('');
  console.log('Examples:');
  console.log('  npm run google-docai https://example.com/receipt.jpg');
  console.log('  npm run google-docai ./receipts/receipt1.png');
  console.log('  npm run google-docai C:\\Users\\Tyler\\Pictures\\receipt.jpg');
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
      console.log(`Downloading image from: ${imagePath}`);
      const tempImagePath = path.join(tempDir, `temp-receipt-${Date.now()}.jpg`);
      finalImagePath = await downloadImage(imagePath, tempImagePath);
      shouldCleanup = true;
      console.log('Image downloaded successfully\n');
    } else {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`File not found: ${imagePath}`);
      }
      console.log(`Using local file: ${imagePath}\n`);
      finalImagePath = imagePath;
    }
    
    await processReceipt(finalImagePath);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (shouldCleanup && fs.existsSync(finalImagePath)) {
      fs.unlinkSync(finalImagePath);
    }
  }
}

main();