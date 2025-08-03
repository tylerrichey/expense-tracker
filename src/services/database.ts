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
        place_address: expense.place_address,
        timestamp: expense.timestamp,
        // receipt_image handled separately via file upload API
      })
    })

    if (!response.ok) {
      throw new Error('Failed to save expense')
    }

    return await response.json()
  }

  async uploadExpenseImage(expenseId: number, imageFile: File): Promise<void> {
    const formData = new FormData()
    formData.append('image', imageFile)
    formData.append('expenseId', expenseId.toString())

    console.log(`Uploading image for expense ${expenseId}: ${imageFile.name} (${(imageFile.size / 1024).toFixed(1)}KB)`)

    const response = await fetch(`${this.baseURL}/expenses/upload-image`, {
      method: 'POST',
      headers: {
        ...AuthService.getAuthHeaders() // Don't include Content-Type, let browser set it for FormData
      },
      body: formData
    })

    if (!response.ok) {
      let errorMessage = `Failed to upload image (${response.status} ${response.statusText})`
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = `Failed to upload image: ${errorData.error}`
        }
      } catch (e) {
        // If response isn't JSON, use the status text
        errorMessage = `Failed to upload image: ${response.status} ${response.statusText}`
      }
      console.error('Image upload failed:', errorMessage)
      throw new Error(errorMessage)
    }

    console.log(`Image uploaded successfully for expense ${expenseId}`)
  }

  async getExpenseImage(expenseId: number): Promise<string> {
    const response = await fetch(`${this.baseURL}/expenses/${expenseId}/image`, {
      headers: {
        ...AuthService.getAuthHeaders()
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch expense image')
    }

    // Convert response to blob and create object URL
    const blob = await response.blob()
    return URL.createObjectURL(blob)
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

  async getAllUniquePlaces(): Promise<string[]> {
    const response = await fetch(`${this.baseURL}/places/all`, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch places')
    }

    return await response.json()
  }

  async getPlaceAutocomplete(input: string, latitude?: number, longitude?: number): Promise<{id: string, name: string, description: string}[]> {
    const params = new URLSearchParams({
      input: input
    })
    
    if (latitude && longitude) {
      params.set('latitude', latitude.toString())
      params.set('longitude', longitude.toString())
    }

    const response = await fetch(`${this.baseURL}/places/autocomplete?${params}`, {
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch autocomplete suggestions')
    }

    return await response.json()
  }
}

export const databaseService = new DatabaseService()