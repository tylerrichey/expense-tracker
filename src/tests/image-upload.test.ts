import { describe, it, expect, beforeEach, vi } from 'vitest'
import { databaseService } from '../services/database'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('Image Upload Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue('test-token')
  })

  it('should successfully upload expense and then upload image separately', async () => {
    // Create a mock File object for the image
    const mockFile = new File(['fake image data'], 'test.png', { type: 'image/png' })

    const expenseData = {
      amount: 25.50,
      latitude: 37.7749,
      longitude: -122.4194,
      place_name: 'Test Coffee Shop',
      place_address: '123 Test St',
      timestamp: new Date()
    }

    const mockExpenseResponse = {
      id: 1,
      ...expenseData,
      timestamp: '2024-01-01T12:00:00Z'
    }

    // Mock the expense creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockExpenseResponse
    })

    // Mock the image upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Image uploaded successfully' })
    })

    // Test expense creation
    const result = await databaseService.addExpense(expenseData)

    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/expenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        amount: expenseData.amount,
        latitude: expenseData.latitude,
        longitude: expenseData.longitude,
        place_name: expenseData.place_name,
        place_address: expenseData.place_address,
        timestamp: expenseData.timestamp
      })
    })
    expect(result).toEqual(mockExpenseResponse)

    // Test image upload
    await databaseService.uploadExpenseImage(1, mockFile)

    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/expenses/upload-image', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'
      },
      body: expect.any(FormData)
    })
  })

  it('should handle expense creation without image', async () => {
    const expenseData = {
      amount: 15.75,
      latitude: 34.0522,
      longitude: -118.2437,
      place_name: 'Test Cafe',
      place_address: '789 Oak St',
      timestamp: new Date()
    }

    const mockResponse = {
      id: 3,
      ...expenseData,
      timestamp: '2024-01-01T16:00:00Z'
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    })

    const result = await databaseService.addExpense(expenseData)

    expect(mockFetch).toHaveBeenCalledWith('/api/expenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        amount: expenseData.amount,
        latitude: expenseData.latitude,
        longitude: expenseData.longitude,
        place_name: expenseData.place_name,
        place_address: expenseData.place_address,
        timestamp: expenseData.timestamp
      })
    })
    expect(result).toEqual(mockResponse)
  })

  it('should handle image upload error response', async () => {
    const mockFile = new File(['fake image data'], 'test.png', { type: 'image/png' })

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ error: 'File too large' })
    })

    await expect(databaseService.uploadExpenseImage(1, mockFile)).rejects.toThrow('Failed to upload image')
  })

  it('should handle image upload success', async () => {
    const mockFile = new File(['fake image data'], 'test.png', { type: 'image/png' })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Image uploaded successfully' })
    })

    await expect(databaseService.uploadExpenseImage(1, mockFile)).resolves.not.toThrow()

    expect(mockFetch).toHaveBeenCalledWith('/api/expenses/upload-image', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'
      },
      body: expect.any(FormData)
    })
  })
})