import { AuthService } from './auth'

export interface Budget {
  id: number
  name: string
  amount: number
  start_weekday: number
  duration_days: number
  created_at: string
  updated_at: string
  is_active: boolean
  is_upcoming: boolean
  vacation_mode: boolean
}

export interface BudgetPeriod {
  id: number
  budget_id: number
  start_date: string
  end_date: string
  target_amount: number
  actual_spent: number
  status: 'upcoming' | 'active' | 'completed'
  created_at: string
  budget_name?: string
}

export interface BudgetCreateData {
  name: string
  amount: number
  start_weekday: number
  duration_days: number
}

export interface BudgetUpdateData {
  name?: string
  amount?: number
}

class BudgetService {
  private baseURL = '/api'

  private getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      ...AuthService.getAuthHeaders()
    }
  }

  // Budget CRUD Operations
  async createBudget(budgetData: BudgetCreateData): Promise<Budget> {
    const response = await fetch(`${this.baseURL}/budgets`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(budgetData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create budget')
    }

    return await response.json()
  }

  async getAllBudgets(): Promise<Budget[]> {
    const response = await fetch(`${this.baseURL}/budgets`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch budgets')
    }

    return await response.json()
  }

  async getBudgetById(id: number): Promise<Budget> {
    const response = await fetch(`${this.baseURL}/budgets/${id}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch budget')
    }

    return await response.json()
  }

  async updateBudget(id: number, updateData: BudgetUpdateData): Promise<Budget> {
    const response = await fetch(`${this.baseURL}/budgets/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update budget')
    }

    return await response.json()
  }

  async deleteBudget(id: number): Promise<void> {
    const response = await fetch(`${this.baseURL}/budgets/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to delete budget')
    }
  }

  // Budget Status Operations
  async activateBudget(id: number): Promise<Budget> {
    const response = await fetch(`${this.baseURL}/budgets/${id}/activate`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to activate budget')
    }

    return await response.json()
  }

  async scheduleBudget(id: number): Promise<Budget> {
    const response = await fetch(`${this.baseURL}/budgets/${id}/schedule`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to schedule budget')
    }

    return await response.json()
  }

  async toggleVacationMode(id: number, vacationMode: boolean): Promise<Budget> {
    const response = await fetch(`${this.baseURL}/budgets/${id}/vacation-mode`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ vacation_mode: vacationMode })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to toggle vacation mode')
    }

    return await response.json()
  }

  // Budget Period Operations
  async getBudgetPeriods(budgetId?: number): Promise<BudgetPeriod[]> {
    const url = budgetId 
      ? `${this.baseURL}/budget-periods?budget_id=${budgetId}`
      : `${this.baseURL}/budget-periods`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch budget periods')
    }

    return await response.json()
  }

  async getCurrentBudgetPeriod(): Promise<BudgetPeriod | null> {
    const response = await fetch(`${this.baseURL}/budget-periods/current`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error('Failed to fetch current budget period')
    }

    return await response.json()
  }

  async getBudgetPeriodById(id: number): Promise<BudgetPeriod> {
    const response = await fetch(`${this.baseURL}/budget-periods/${id}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch budget period')
    }

    return await response.json()
  }

  // Analytics Operations
  async getCurrentBudgetAnalytics() {
    const response = await fetch(`${this.baseURL}/budget-analytics/current`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error('Failed to fetch budget analytics')
    }

    return await response.json()
  }

  async getBudgetHistory(limit: number = 10) {
    const response = await fetch(`${this.baseURL}/budget-analytics/history?limit=${limit}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch budget history')
    }

    return await response.json()
  }

  async getBudgetTrends() {
    const response = await fetch(`${this.baseURL}/budget-analytics/trends`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to fetch budget trends')
    }

    return await response.json()
  }

  // Convenience Methods
  async getActiveBudget(): Promise<Budget | null> {
    const budgets = await this.getAllBudgets()
    return budgets.find(b => b.is_active) || null
  }

  async getUpcomingBudget(): Promise<Budget | null> {
    const budgets = await this.getAllBudgets()
    return budgets.find(b => b.is_upcoming) || null
  }

  async getCurrentBudgetWithPeriod(): Promise<{ budget: Budget | null, period: BudgetPeriod | null }> {
    const [budget, period] = await Promise.all([
      this.getActiveBudget(),
      this.getCurrentBudgetPeriod()
    ])

    return { budget, period }
  }

  // Auto-continuation trigger (for manual testing)
  async triggerAutoContinuation(): Promise<void> {
    const response = await fetch(`${this.baseURL}/budgets/auto-continue`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to trigger auto-continuation')
    }
  }
}

// Export singleton instance
export const budgetService = new BudgetService()
export { BudgetService }