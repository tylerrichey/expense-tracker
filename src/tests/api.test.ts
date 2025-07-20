import { describe, it, expect, beforeEach, vi } from 'vitest'
import { databaseService } from '../services/database'
import { AuthService } from '../services/auth'

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

describe('API Client Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue('test-token')
  })

  describe('AuthService', () => {
    it('should login with valid password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          token: 'test-token',
          message: 'Authentication successful'
        })
      })

      const result = await AuthService.login('valid-password')

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'valid-password' })
      })
      expect(result).toEqual({
        success: true,
        token: 'test-token',
        message: 'Authentication successful'
      })
      expect(localStorageMock.setItem).toHaveBeenCalledWith('expense_tracker_auth_token', 'test-token')
    })

    it('should reject invalid password', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid password' })
      })

      const result = await AuthService.login('wrong-password')

      expect(result).toEqual({
        success: false,
        error: 'Invalid password'
      })
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await AuthService.login('password')

      expect(result).toEqual({
        success: false,
        error: 'Network error occurred'
      })
    })

    it('should check authentication status', () => {
      localStorageMock.getItem.mockReturnValue('test-token')
      expect(AuthService.isAuthenticated()).toBe(true)

      localStorageMock.getItem.mockReturnValue(null)
      expect(AuthService.isAuthenticated()).toBe(false)
    })

    it('should logout and remove token', () => {
      AuthService.logout()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('expense_tracker_auth_token')
    })

    it('should get auth headers when token exists', () => {
      localStorageMock.getItem.mockReturnValue('test-token')
      const headers = AuthService.getAuthHeaders()
      expect(headers).toEqual({ Authorization: 'Bearer test-token' })
    })

    it('should return empty headers when no token', () => {
      localStorageMock.getItem.mockReturnValue(null)
      const headers = AuthService.getAuthHeaders()
      expect(headers).toEqual({})
    })
  })

  describe('DatabaseService - Expense Operations', () => {
    it('should add expense successfully', async () => {
      const expenseData = {
        amount: 25.50,
        latitude: 37.7749,
        longitude: -122.4194,
        place_name: 'Test Coffee Shop',
        place_address: '123 Test St',
        timestamp: new Date()
      }

      const mockResponse = {
        id: 1,
        ...expenseData,
        timestamp: '2024-01-01T12:00:00Z'
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
          place_address: expenseData.place_address
        })
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle expense creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400
      })

      await expect(databaseService.addExpense({ 
        amount: 10, 
        timestamp: new Date() 
      })).rejects.toThrow('Failed to save expense')
    })

    it('should get all expenses', async () => {
      const mockExpenses = [
        { id: 1, amount: 25.50, timestamp: '2024-01-01T12:00:00Z' },
        { id: 2, amount: 15.75, timestamp: '2024-01-02T14:30:00Z' }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockExpenses
      })

      const result = await databaseService.getAllExpenses()

      expect(mockFetch).toHaveBeenCalledWith('/api/expenses', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
      expect(result).toHaveLength(2)
      expect(result[0].timestamp).toBeInstanceOf(Date)
    })

    it('should get recent expenses with default days', async () => {
      const mockExpenses = [
        { id: 1, amount: 25.50, timestamp: '2024-01-01T12:00:00Z' }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockExpenses
      })

      const result = await databaseService.getRecentExpenses()

      expect(mockFetch).toHaveBeenCalledWith('/api/expenses/recent?days=7', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
      expect(result).toHaveLength(1)
    })

    it('should get recent expenses with custom days', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      await databaseService.getRecentExpenses(30)

      expect(mockFetch).toHaveBeenCalledWith('/api/expenses/recent?days=30', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
    })

    it('should delete expense successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Expense deleted successfully', id: 1 })
      })

      await databaseService.deleteExpense(1)

      expect(mockFetch).toHaveBeenCalledWith('/api/expenses/1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
    })

    it('should handle delete expense failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Expense not found' })
      })

      await expect(databaseService.deleteExpense(999)).rejects.toThrow('Expense not found')
    })

    it('should get expense summary', async () => {
      const mockSummary = { total: 150.25, count: 5 }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary
      })

      const result = await databaseService.getExpenseSummary(7)

      expect(mockFetch).toHaveBeenCalledWith('/api/expenses/summary/7', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
      expect(result).toEqual(mockSummary)
    })

    it('should get current month summary', async () => {
      const mockSummary = { total: 450.75, count: 12 }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummary
      })

      const result = await databaseService.getCurrentMonthSummary()

      expect(mockFetch).toHaveBeenCalledWith('/api/expenses/summary/month/current', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
      expect(result).toEqual(mockSummary)
    })
  })

  describe('DatabaseService - Places Operations', () => {
    it('should get nearby places with default radius', async () => {
      const mockPlaces = [
        { place_id: '1', name: 'Coffee Shop', address: '123 Main St' },
        { place_id: '2', name: 'Restaurant', address: '456 Oak Ave' }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlaces
      })

      const result = await databaseService.getNearbyPlaces(37.7749, -122.4194)

      expect(mockFetch).toHaveBeenCalledWith('/api/places/nearby?latitude=37.7749&longitude=-122.4194', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
      expect(result).toEqual(mockPlaces)
    })

    it('should get nearby places with custom radius', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      await databaseService.getNearbyPlaces(37.7749, -122.4194, 1000)

      expect(mockFetch).toHaveBeenCalledWith('/api/places/nearby?latitude=37.7749&longitude=-122.4194&radius=1000', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
    })

    it('should handle nearby places API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Latitude and longitude are required' })
      })

      await expect(databaseService.getNearbyPlaces(37.7749, -122.4194)).rejects.toThrow('Latitude and longitude are required')
    })

    it('should get all unique places', async () => {
      const mockPlaces = ['Coffee Shop', 'Restaurant', 'Gas Station']

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlaces
      })

      const result = await databaseService.getAllUniquePlaces()

      expect(mockFetch).toHaveBeenCalledWith('/api/places/all', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
      expect(result).toEqual(mockPlaces)
    })

    it('should handle get all places failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(databaseService.getAllUniquePlaces()).rejects.toThrow('Failed to fetch places')
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(databaseService.getAllExpenses()).rejects.toThrow('Network error')
    })

    it('should handle authentication errors', async () => {
      localStorageMock.getItem.mockReturnValue(null) // No token

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      })

      await expect(databaseService.getAllExpenses()).rejects.toThrow('Failed to fetch expenses')
    })

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(databaseService.getAllExpenses()).rejects.toThrow('Failed to fetch expenses')
    })
  })
})