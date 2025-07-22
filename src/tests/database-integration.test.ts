import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

// This is an integration test that actually tests database functionality
describe('Database Integration Tests - Image Storage', () => {
  let db: Database.Database
  let testDbPath: string

  beforeAll(() => {
    // Create a temporary test database
    testDbPath = path.join(process.cwd(), 'test-image-db.sqlite')
    
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    
    db = new Database(testDbPath)
    
    // Create the expenses table with receipt_image column
    db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        latitude REAL,
        longitude REAL,
        place_id TEXT,
        place_name TEXT,
        place_address TEXT,
        receipt_image BLOB,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  })

  afterAll(() => {
    if (db) {
      db.close()
    }
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  it('should store and retrieve image data in SQLite database', () => {
    // Create test image data (simulating a PNG)
    const imageData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
      0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01
    ])

    // Insert expense with image
    const stmt = db.prepare(`
      INSERT INTO expenses (amount, latitude, longitude, place_name, place_address, receipt_image, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      25.50,
      37.7749,
      -122.4194,
      'Test Coffee Shop',
      '123 Test St',
      imageData,
      new Date().toISOString()
    )

    expect(result.lastInsertRowid).toBeTruthy()

    // Retrieve the expense and verify image data
    const selectStmt = db.prepare('SELECT * FROM expenses WHERE id = ?')
    const expense = selectStmt.get(result.lastInsertRowid) as any

    expect(expense).toBeTruthy()
    expect(expense.amount).toBe(25.50)
    expect(expense.place_name).toBe('Test Coffee Shop')
    expect(expense.receipt_image).toBeTruthy()
    
    // Verify the image data is identical
    const retrievedImageData = Buffer.from(expense.receipt_image)
    expect(retrievedImageData.length).toBe(imageData.length)
    expect(retrievedImageData.equals(imageData)).toBe(true)
  })

  it('should handle large image data (3MB)', () => {
    // Create a larger image buffer (3MB)
    const largeImageData = Buffer.alloc(3 * 1024 * 1024)
    // Fill with test pattern
    for (let i = 0; i < largeImageData.length; i++) {
      largeImageData[i] = i % 256
    }

    const stmt = db.prepare(`
      INSERT INTO expenses (amount, place_name, receipt_image, timestamp)
      VALUES (?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      45.00,
      'Test Restaurant',
      largeImageData,
      new Date().toISOString()
    )

    expect(result.lastInsertRowid).toBeTruthy()

    // Retrieve and verify
    const selectStmt = db.prepare('SELECT receipt_image FROM expenses WHERE id = ?')
    const expense = selectStmt.get(result.lastInsertRowid) as any

    expect(expense.receipt_image).toBeTruthy()
    const retrievedImageData = Buffer.from(expense.receipt_image)
    expect(retrievedImageData.length).toBe(3 * 1024 * 1024)
    
    // Verify a sample of the data pattern
    expect(retrievedImageData[0]).toBe(0)
    expect(retrievedImageData[255]).toBe(255)
    expect(retrievedImageData[256]).toBe(0)
  })

  it('should handle null image data', () => {
    const stmt = db.prepare(`
      INSERT INTO expenses (amount, place_name, receipt_image, timestamp)
      VALUES (?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      15.75,
      'Test Cafe',
      null,
      new Date().toISOString()
    )

    expect(result.lastInsertRowid).toBeTruthy()

    const selectStmt = db.prepare('SELECT * FROM expenses WHERE id = ?')
    const expense = selectStmt.get(result.lastInsertRowid) as any

    expect(expense).toBeTruthy()
    expect(expense.amount).toBe(15.75)
    expect(expense.place_name).toBe('Test Cafe')
    expect(expense.receipt_image).toBeNull()
  })

  it('should verify database schema includes receipt_image column', () => {
    const stmt = db.prepare("PRAGMA table_info(expenses)")
    const columns = stmt.all() as any[]
    
    const receiptImageColumn = columns.find((col: any) => col.name === 'receipt_image')
    expect(receiptImageColumn).toBeTruthy()
    expect(receiptImageColumn.type).toBe('BLOB')
  })
})