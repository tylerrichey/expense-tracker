import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// @ts-ignore - No types available for database module
import { TestDatabaseService } from './test-database-service.js'

describe('Budget-Expense Integration', () => {
  let app: express.Application
  let testDb: TestDatabaseService
  let activeBudgetId: number
  const testPassword = 'test-password'

  beforeEach(async () => {
    // Create fresh test database for each test
    testDb = new TestDatabaseService()

    // Set up Express app with routes (simplified version)
    app = express()
    app.use(express.json())

    // Simple auth middleware for testing
    const authenticateRequest = (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization
      if (!authHeader || authHeader !== `Bearer ${testPassword}`) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      next()
    }

    // Add expense endpoint
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

        const savedExpense = await testDb.addExpense(expense)
        res.status(201).json(savedExpense)
      } catch (error) {
        console.error('Error saving expense:', error)
        res.status(500).json({ error: 'Failed to save expense' })
      }
    })

    // Get current budget period endpoint
    app.get('/api/budget-periods/current', authenticateRequest, async (_req, res) => {
      try {
        const period = await testDb.getCurrentBudgetPeriod()
        
        if (!period) {
          return res.status(404).json({ error: 'No current budget period found' })
        }
        
        res.json(period)
      } catch (error) {
        console.error('Error fetching current budget period:', error)
        res.status(500).json({ error: 'Failed to fetch current budget period' })
      }
    })

    // Create test budget and period
    const testBudget = await testDb.createBudget({
      name: 'Test Weekly Budget',
      amount: 100.00,
      start_weekday: 1, // Monday
      duration_days: 7
    })
    activeBudgetId = testBudget.id

    // Activate the budget
    await testDb.activateBudget(activeBudgetId)

    // Verify that a current period was created
    const currentPeriod = await testDb.getCurrentBudgetPeriod()
    if (!currentPeriod) {
      throw new Error('No current period found after activating budget')
    }
  })

  afterEach(async () => {
    // Clean up test database
    if (testDb) {
      testDb.close()
    }
  })

  it('should associate new expenses with current budget period and update totals', async () => {
    // Step 1: Get initial budget period totals
    const initialResponse = await request(app)
      .get('/api/budget-periods/current')
      .set('Authorization', `Bearer ${testPassword}`)
      .expect(200)

    const initialPeriod = initialResponse.body
    expect(initialPeriod.actual_spent).toBe(0) // Should start at 0

    // Step 2: Add a new expense
    const expenseData = {
      amount: 25.50,
      place_name: 'Test Store',
      latitude: 40.7128,
      longitude: -74.0060
    }

    const expenseResponse = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${testPassword}`)
      .send(expenseData)
      .expect(201)

    const savedExpense = expenseResponse.body
    expect(savedExpense.amount).toBe(25.50)

    // Step 3: Get updated budget period totals
    const updatedResponse = await request(app)
      .get('/api/budget-periods/current')
      .set('Authorization', `Bearer ${testPassword}`)
      .expect(200)

    const updatedPeriod = updatedResponse.body
    
    // This should pass but currently fails because expenses aren't associated with budget periods
    expect(updatedPeriod.actual_spent).toBe(25.50)
    
    // Step 4: Add another expense
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${testPassword}`)
      .send({ amount: 15.75, place_name: 'Another Store' })
      .expect(201)

    // Step 5: Verify cumulative total
    const finalResponse = await request(app)
      .get('/api/budget-periods/current')
      .set('Authorization', `Bearer ${testPassword}`)
      .expect(200)

    const finalPeriod = finalResponse.body
    expect(finalPeriod.actual_spent).toBe(41.25) // 25.50 + 15.75
  })

  it('should handle expenses when no active budget exists', async () => {
    // Deactivate the budget
    await testDb.updateBudget(activeBudgetId, { is_active: false })

    // Try to add an expense
    const expenseResponse = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${testPassword}`)
      .send({
        amount: 10.00,
        place_name: 'Test Store'
      })
      .expect(201)

    // Expense should be created but not associated with any budget period
    const savedExpense = expenseResponse.body
    expect(savedExpense.amount).toBe(10.00)

    // Current budget period should not exist
    await request(app)
      .get('/api/budget-periods/current')
      .set('Authorization', `Bearer ${testPassword}`)
      .expect(404)
  })
})