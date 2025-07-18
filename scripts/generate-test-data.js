import 'dotenv/config'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Sample places data for realistic test expenses
const samplePlaces = [
  {
    place_name: "Starbucks Coffee",
    place_address: "123 Main St, Downtown",
    latitude: 40.7128,
    longitude: -74.0060
  },
  {
    place_name: "Whole Foods Market", 
    place_address: "456 Oak Ave, Uptown",
    latitude: 40.7589,
    longitude: -73.9851
  },
  {
    place_name: "Shell Gas Station",
    place_address: "789 Broadway, Midtown", 
    latitude: 40.7505,
    longitude: -73.9934
  },
  {
    place_name: "McDonald's",
    place_address: "321 Pine St, Downtown",
    latitude: 40.7282,
    longitude: -74.0776
  },
  {
    place_name: "Target",
    place_address: "654 Elm St, Suburbs",
    latitude: 40.6892,
    longitude: -74.0445
  },
  {
    place_name: "CVS Pharmacy",
    place_address: "987 Cedar Ave, Westside",
    latitude: 40.7614,
    longitude: -73.9776
  },
  {
    place_name: "Local Restaurant",
    place_address: "147 Maple St, East Village",
    latitude: 40.7265,
    longitude: -73.9826
  },
  {
    place_name: "Gas & Go",
    place_address: "258 1st Ave, Lower East Side",
    latitude: 40.7205,
    longitude: -73.9816
  }
]

// Expense amount ranges by category
const expenseRanges = {
  coffee: { min: 3.50, max: 8.99 },
  groceries: { min: 15.00, max: 120.00 },
  gas: { min: 25.00, max: 65.00 },
  fastfood: { min: 8.00, max: 18.00 },
  retail: { min: 10.00, max: 200.00 },
  pharmacy: { min: 5.00, max: 45.00 },
  restaurant: { min: 20.00, max: 85.00 }
}

const placeCategories = {
  "Starbucks Coffee": "coffee",
  "Whole Foods Market": "groceries", 
  "Shell Gas Station": "gas",
  "McDonald's": "fastfood",
  "Target": "retail",
  "CVS Pharmacy": "pharmacy",
  "Local Restaurant": "restaurant",
  "Gas & Go": "gas"
}

function getRandomAmount(placeName) {
  const category = placeCategories[placeName] || "retail"
  const range = expenseRanges[category]
  const amount = Math.random() * (range.max - range.min) + range.min
  return Math.round(amount * 100) / 100 // Round to 2 decimal places
}

function generateRandomExpense(date) {
  const place = samplePlaces[Math.floor(Math.random() * samplePlaces.length)]
  const amount = getRandomAmount(place.place_name)
  
  // Add some random variation to coordinates (within ~100m)
  const latVariation = (Math.random() - 0.5) * 0.002
  const lngVariation = (Math.random() - 0.5) * 0.002
  
  return {
    amount,
    latitude: place.latitude + latVariation,
    longitude: place.longitude + lngVariation,
    place_id: `test_${Math.random().toString(36).substr(2, 9)}`,
    place_name: place.place_name,
    place_address: place.place_address,
    timestamp: date.toISOString()
  }
}

function generateTestData() {
  console.log('🚀 Generating test data...')
  
  // Create test database path
  const testDbPath = join(__dirname, '../server/expenses-test.db')
  console.log(`📁 Database path: ${testDbPath}`)
  
  // Initialize database
  const db = new Database(testDbPath)
  
  // Create table
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      latitude REAL,
      longitude REAL,
      place_id TEXT,
      place_name TEXT,
      place_address TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  
  db.exec(createTableQuery)
  console.log('✅ Database table created')
  
  // Clear existing test data
  db.exec('DELETE FROM expenses')
  console.log('🗑️  Cleared existing data')
  
  const insertStmt = db.prepare(`
    INSERT INTO expenses (amount, latitude, longitude, place_id, place_name, place_address, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  
  let totalExpenses = 0
  const today = new Date()
  
  // Generate data for the last 60 days
  for (let day = 0; day < 60; day++) {
    const currentDate = new Date(today)
    currentDate.setDate(today.getDate() - day)
    
    // Generate 0-2 expenses per day (weighted towards 1-2)
    const numExpenses = Math.random() < 0.1 ? 0 : Math.random() < 0.4 ? 1 : 2
    
    for (let i = 0; i < numExpenses; i++) {
      // Randomize time of day
      const hours = Math.floor(Math.random() * 14) + 7 // Between 7 AM and 9 PM
      const minutes = Math.floor(Math.random() * 60)
      
      const expenseDate = new Date(currentDate)
      expenseDate.setHours(hours, minutes, 0, 0)
      
      const expense = generateRandomExpense(expenseDate)
      
      insertStmt.run(
        expense.amount,
        expense.latitude,
        expense.longitude,
        expense.place_id,
        expense.place_name,
        expense.place_address,
        expense.timestamp
      )
      
      totalExpenses++
    }
  }
  
  db.close()
  
  console.log(`✨ Successfully generated ${totalExpenses} test expenses`)
  console.log(`📊 Data spans 60 days with up to 2 expenses per day`)
  console.log(`🎯 Test database created at: expenses-test.db`)
  console.log('')
  console.log('💡 To use this test database:')
  console.log('   1. Stop your server if running')
  console.log('   2. Rename expenses.db to expenses-backup.db (if you want to keep it)')
  console.log('   3. Rename expenses-test.db to expenses.db')
  console.log('   4. Restart your server')
}

// Run the generator
try {
  generateTestData()
} catch (error) {
  console.error('❌ Error generating test data:', error)
  process.exit(1)
}