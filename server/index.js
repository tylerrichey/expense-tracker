import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { databaseService } from './database.js'
import { placesService } from './places.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000
const AUTH_PASSWORD = process.env.AUTH_PASSWORD

if (!AUTH_PASSWORD) {
  console.error('ERROR: AUTH_PASSWORD environment variable is required')
  process.exit(1)
}

app.use(cors())
app.use(express.json())

// Authentication middleware
const authenticateRequest = (req, res, next) => {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  
  const token = authHeader.substring(7)
  if (token !== AUTH_PASSWORD) {
    return res.status(401).json({ error: 'Invalid authentication' })
  }
  
  next()
}

// Serve static files from the dist directory
app.use(express.static(join(__dirname, '../dist')))

// Authentication endpoint
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body
  
  if (!password) {
    return res.status(400).json({ error: 'Password is required' })
  }
  
  if (password === AUTH_PASSWORD) {
    res.json({ 
      success: true, 
      token: AUTH_PASSWORD,
      message: 'Authentication successful' 
    })
  } else {
    res.status(401).json({ error: 'Invalid password' })
  }
})

// API Routes (protected)
app.post('/api/expenses', authenticateRequest, async (req, res) => {
  try {
    const { amount, latitude, longitude, place_id, place_name, place_address } = req.body
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' })
    }

    const expense = {
      amount: parseFloat(amount),
      latitude: latitude || null,
      longitude: longitude || null,
      place_id: place_id || null,
      place_name: place_name || null,
      place_address: place_address || null,
      timestamp: new Date().toISOString()
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('Server: Received expense data:', JSON.stringify(req.body, null, 2))
      console.log('Server: Prepared expense object:', JSON.stringify(expense, null, 2))
    }

    const savedExpense = await databaseService.addExpense(expense)
    res.status(201).json(savedExpense)
  } catch (error) {
    console.error('Error saving expense:', error)
    res.status(500).json({ error: 'Failed to save expense' })
  }
})

app.get('/api/expenses', authenticateRequest, async (req, res) => {
  try {
    const expenses = await databaseService.getAllExpenses()
    res.json(expenses)
  } catch (error) {
    console.error('Error fetching expenses:', error)
    res.status(500).json({ error: 'Failed to fetch expenses' })
  }
})

app.get('/api/expenses/recent', authenticateRequest, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7
    const expenses = await databaseService.getRecentExpenses(days)
    res.json(expenses)
  } catch (error) {
    console.error('Error fetching recent expenses:', error)
    res.status(500).json({ error: 'Failed to fetch recent expenses' })
  }
})

app.delete('/api/expenses/:id', authenticateRequest, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Valid expense ID is required' })
    }

    const result = await databaseService.deleteExpense(id)
    
    if (result.deleted) {
      res.json({ message: 'Expense deleted successfully', id })
    } else {
      res.status(404).json({ error: 'Expense not found' })
    }
  } catch (error) {
    console.error('Error deleting expense:', error)
    res.status(500).json({ error: 'Failed to delete expense' })
  }
})

app.get('/api/places/nearby', authenticateRequest, async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' })
    }

    const places = await placesService.searchNearbyPlaces(
      latitude, 
      longitude, 
      radius ? parseInt(radius) : 500
    )
    
    res.json(places)
  } catch (error) {
    console.error('Error fetching nearby places:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch nearby places' })
  }
})

app.get('/api/expenses/summary/:days', authenticateRequest, async (req, res) => {
  try {
    const days = parseInt(req.params.days)
    
    if (!days || isNaN(days) || days <= 0) {
      return res.status(400).json({ error: 'Valid number of days is required' })
    }

    const summary = await databaseService.getExpenseSummary(days)
    res.json(summary)
  } catch (error) {
    console.error('Error fetching expense summary:', error)
    res.status(500).json({ error: 'Failed to fetch expense summary' })
  }
})

app.get('/api/expenses/summary/month/current', authenticateRequest, async (req, res) => {
  try {
    const summary = await databaseService.getCurrentMonthSummary()
    res.json(summary)
  } catch (error) {
    console.error('Error fetching current month summary:', error)
    res.status(500).json({ error: 'Failed to fetch current month summary' })
  }
})

app.get('/api/places/all', authenticateRequest, async (req, res) => {
  try {
    const places = await databaseService.getAllUniquePlaces()
    res.json(places)
  } catch (error) {
    console.error('Error fetching all places:', error)
    res.status(500).json({ error: 'Failed to fetch places' })
  }
})

// Database backup endpoint
app.get('/api/backup/download', authenticateRequest, (req, res) => {
  try {
    const dbPath = databaseService.getDatabasePath()
    
    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' })
    }
    
    // Get file stats for size
    const stats = fs.statSync(dbPath)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `expenses-backup-${timestamp}.db`
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', stats.size)
    
    // Stream the database file
    const readStream = fs.createReadStream(dbPath)
    readStream.pipe(res)
    
    readStream.on('error', (error) => {
      console.error('Error streaming backup file:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download backup' })
      }
    })
    
    console.log(`📥 Database backup downloaded: ${filename} (${stats.size} bytes)`)
  } catch (error) {
    console.error('Error creating backup:', error)
    res.status(500).json({ error: 'Failed to create backup' })
  }
})

// Health check endpoint for deployment monitoring
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  })
})

// Serve the Vue app for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})