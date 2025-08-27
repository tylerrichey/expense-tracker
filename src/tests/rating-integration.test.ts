import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { databaseService as dbService } from '../services/database'

// Mock fetch for database service
global.fetch = vi.fn()

describe('Rating Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should send rating in POST request when adding expense with rating', async () => {
    // Mock successful API response
    const mockResponse = { id: 1, amount: 25.5, rating: 4 }
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const expenseData = {
      amount: 25.5,
      latitude: 40.7128,
      longitude: -74.006,
      place_name: 'Test Store',
      rating: 4,
      timestamp: new Date()
    }

    await dbService.addExpense(expenseData)

    // Verify fetch was called with rating included
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/expenses',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"rating":4')
      })
    )
  })

  it('should send undefined rating in POST request when no rating provided', async () => {
    // Mock successful API response
    const mockResponse = { id: 1, amount: 15.25 }
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const expenseData = {
      amount: 15.25,
      latitude: 40.7128,
      longitude: -74.006,
      place_name: 'Another Store',
      rating: undefined,
      timestamp: new Date()
    }

    await dbService.addExpense(expenseData)

    // Verify fetch was called with rating as undefined
    const fetchCall = (global.fetch as any).mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.rating).toBeUndefined()
  })
})