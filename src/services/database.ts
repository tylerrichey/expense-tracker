import { Expense, Place } from '../types/expense'
import { AuthService } from './auth'

class DatabaseService {
  private baseURL = '/api'

  private getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      ...AuthService.getAuthHeaders()
    }
  }

  async addExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const response = await fetch(`${this.baseURL}/expenses`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        amount: expense.amount,
        latitude: expense.latitude,
        longitude: expense.longitude,
        place_id: expense.place_id,
        place_name: expense.place_name,
        place_address: expense.place_address
      })
    })

    if (!response.ok) {
      throw new Error('Failed to save expense')
    }

    return await response.json()
  }

  async getAllExpenses(): Promise<Expense[]> {
    const response = await fetch(`${this.baseURL}/expenses`, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch expenses')
    }

    const expenses = await response.json()
    return expenses.map((expense: any) => ({
      ...expense,
      timestamp: new Date(expense.timestamp)
    }))
  }

  async getRecentExpenses(days: number = 7): Promise<Expense[]> {
    const response = await fetch(`${this.baseURL}/expenses/recent?days=${days}`, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch recent expenses')
    }

    const expenses = await response.json()
    return expenses.map((expense: any) => ({
      ...expense,
      timestamp: new Date(expense.timestamp)
    }))
  }

  async deleteExpense(id: number): Promise<void> {
    const response = await fetch(`${this.baseURL}/expenses/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete expense')
    }
  }

  async getNearbyPlaces(latitude: number, longitude: number, radius?: number): Promise<Place[]> {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString()
    })
    
    if (radius) {
      params.append('radius', radius.toString())
    }

    const response = await fetch(`${this.baseURL}/places/nearby?${params}`, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch nearby places')
    }

    return await response.json()
  }

  async getExpenseSummary(days: number): Promise<{ total: number; count: number }> {
    const response = await fetch(`${this.baseURL}/expenses/summary/${days}`, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch expense summary')
    }

    return await response.json()
  }

  async getCurrentMonthSummary(): Promise<{ total: number; count: number }> {
    const response = await fetch(`${this.baseURL}/expenses/summary/month/current`, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch current month summary')
    }

    return await response.json()
  }
}

export const databaseService = new DatabaseService()