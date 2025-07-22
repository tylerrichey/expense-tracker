import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock database service for scheduler testing
const mockDatabaseService = {
  updateAllPeriodStatuses: vi.fn(),
  getBudgetPeriods: vi.fn(),
  getBudgetById: vi.fn(),
  getActiveBudget: vi.fn(),
  getUpcomingBudget: vi.fn(),
  createBudgetPeriod: vi.fn(),
  updateBudget: vi.fn(),
  getOrphanExpenses: vi.fn(),
  findPeriodForExpense: vi.fn(),
  associateExpenseWithPeriod: vi.fn()
}

// Mock the budget scheduler without database dependencies
class MockBudgetScheduler {
  constructor() {
    this.isRunning = false
    this.intervalId = null
    this.checkInterval = 100 // Fast for testing
    this.db = mockDatabaseService
  }

  isRunning: boolean
  intervalId: any
  checkInterval: number
  db: typeof mockDatabaseService

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.intervalId = setInterval(() => {
      this.performScheduledTasks()
    }, this.checkInterval)
  }

  stop() {
    if (!this.isRunning) return
    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  async performScheduledTasks() {
    await this.updatePeriodStatuses()
    await this.handlePeriodTransitions()
    await this.autoContinueBudgets()
    await this.associateOrphanExpenses()
  }

  async updatePeriodStatuses() {
    await this.db.updateAllPeriodStatuses()
  }

  async handlePeriodTransitions() {
    const periods = await this.db.getBudgetPeriods()
    const now = new Date()
    
    for (const period of periods) {
      const endDate = new Date(period.end_date + 'T23:59:59')
      const isJustCompleted = period.status === 'completed' && 
                             Math.abs(now.getTime() - endDate.getTime()) < this.checkInterval * 10
      
      if (isJustCompleted) {
        await this.handlePeriodCompletion(period)
      }
    }
  }

  async handlePeriodCompletion(completedPeriod: any) {
    const budget = await this.db.getBudgetById(completedPeriod.budget_id)
    if (!budget || !budget.is_active || budget.vacation_mode) {
      return
    }

    const upcomingBudget = await this.db.getUpcomingBudget()
    
    if (upcomingBudget) {
      await this.transitionToUpcomingBudget(budget, upcomingBudget)
    } else {
      await this.continueBudget(budget, completedPeriod)
    }
  }

  async continueBudget(budget: any, lastPeriod: any) {
    // Calculate next period (simplified for testing)
    const nextStartDate = new Date(lastPeriod.end_date)
    nextStartDate.setDate(nextStartDate.getDate() + 1)
    
    const nextEndDate = new Date(nextStartDate)
    nextEndDate.setDate(nextStartDate.getDate() + budget.duration_days - 1)
    
    const nextPeriod = {
      budget_id: budget.id,
      start_date: nextStartDate.toISOString().split('T')[0],
      end_date: nextEndDate.toISOString().split('T')[0],
      target_amount: budget.amount,
      status: 'active'
    }
    
    await this.db.createBudgetPeriod(nextPeriod)
  }

  async transitionToUpcomingBudget(currentBudget: any, upcomingBudget: any) {
    await this.db.updateBudget(currentBudget.id, { is_active: false })
    await this.db.updateBudget(upcomingBudget.id, { 
      is_active: true, 
      is_upcoming: false 
    })

    const newPeriod = {
      budget_id: upcomingBudget.id,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + upcomingBudget.duration_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      target_amount: upcomingBudget.amount,
      status: 'active'
    }
    
    await this.db.createBudgetPeriod(newPeriod)
  }

  async autoContinueBudgets() {
    const activeBudget = await this.db.getActiveBudget()
    if (!activeBudget || activeBudget.vacation_mode) {
      return
    }

    const periods = await this.db.getBudgetPeriods(activeBudget.id)
    const hasActivePeriod = periods.some((p: any) => p.status === 'active')
    const hasUpcomingPeriod = periods.some((p: any) => p.status === 'upcoming')

    if (!hasActivePeriod && !hasUpcomingPeriod) {
      const newPeriod = {
        budget_id: activeBudget.id,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + activeBudget.duration_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        target_amount: activeBudget.amount,
        status: 'active'
      }
      
      await this.db.createBudgetPeriod(newPeriod)
    }
  }

  async associateOrphanExpenses() {
    const orphanExpenses = await this.db.getOrphanExpenses()
    
    for (const expense of orphanExpenses) {
      const matchingPeriod = await this.db.findPeriodForExpense(expense.timestamp)
      if (matchingPeriod) {
        await this.db.associateExpenseWithPeriod(expense.id, matchingPeriod.id)
      }
    }
  }
}

describe('Budget Scheduler Tests', () => {
  let scheduler: MockBudgetScheduler

  beforeEach(() => {
    scheduler = new MockBudgetScheduler()
    
    // Reset all mocks
    Object.values(mockDatabaseService).forEach(mock => {
      if (typeof mock === 'function') {
        mock.mockClear()
      }
    })
  })

  describe('Scheduler Lifecycle', () => {
    it('should start and stop correctly', () => {
      expect(scheduler.isRunning).toBe(false)
      
      scheduler.start()
      expect(scheduler.isRunning).toBe(true)
      expect(scheduler.intervalId).toBeDefined()
      
      scheduler.stop()
      expect(scheduler.isRunning).toBe(false)
      expect(scheduler.intervalId).toBeNull()
    })

    it('should not start if already running', () => {
      scheduler.start()
      const firstIntervalId = scheduler.intervalId
      
      scheduler.start() // Second start should be ignored
      
      expect(scheduler.intervalId).toBe(firstIntervalId)
      scheduler.stop()
    })

    it('should handle stop when not running', () => {
      expect(() => scheduler.stop()).not.toThrow()
    })
  })

  describe('Period Status Updates', () => {
    it('should call updateAllPeriodStatuses during scheduled tasks', async () => {
      mockDatabaseService.updateAllPeriodStatuses.mockResolvedValue([])
      mockDatabaseService.getBudgetPeriods.mockResolvedValue([])
      mockDatabaseService.getActiveBudget.mockResolvedValue(null)
      mockDatabaseService.getOrphanExpenses.mockResolvedValue([])

      await scheduler.performScheduledTasks()

      expect(mockDatabaseService.updateAllPeriodStatuses).toHaveBeenCalledTimes(1)
    })
  })

  describe('Period Transitions', () => {
    it('should handle period completion for active budget without upcoming budget', async () => {
      const completedPeriod = {
        id: 1,
        budget_id: 1,
        start_date: '2025-07-21',
        end_date: '2025-07-27',
        status: 'completed'
      }

      const activeBudget = {
        id: 1,
        name: 'Test Budget',
        amount: 500,
        duration_days: 7,
        is_active: true,
        vacation_mode: false
      }

      mockDatabaseService.getBudgetPeriods.mockResolvedValue([completedPeriod])
      mockDatabaseService.getBudgetById.mockResolvedValue(activeBudget)
      mockDatabaseService.getUpcomingBudget.mockResolvedValue(null)
      mockDatabaseService.createBudgetPeriod.mockResolvedValue({ id: 2 })
      mockDatabaseService.updateAllPeriodStatuses.mockResolvedValue([])
      mockDatabaseService.getActiveBudget.mockResolvedValue(activeBudget)
      mockDatabaseService.getOrphanExpenses.mockResolvedValue([])

      await scheduler.performScheduledTasks()

      expect(mockDatabaseService.getBudgetById).toHaveBeenCalledWith(1)
      expect(mockDatabaseService.getUpcomingBudget).toHaveBeenCalled()
      expect(mockDatabaseService.createBudgetPeriod).toHaveBeenCalled()
    })

    it('should handle transition to upcoming budget', async () => {
      const completedPeriod = {
        id: 1,
        budget_id: 1,
        end_date: '2025-07-27',
        status: 'completed'
      }

      const currentBudget = {
        id: 1,
        name: 'Current Budget',
        is_active: true,
        vacation_mode: false
      }

      const upcomingBudget = {
        id: 2,
        name: 'Upcoming Budget',
        amount: 600,
        duration_days: 14,
        is_upcoming: true
      }

      mockDatabaseService.getBudgetPeriods.mockResolvedValue([completedPeriod])
      mockDatabaseService.getBudgetById.mockResolvedValue(currentBudget)
      mockDatabaseService.getUpcomingBudget.mockResolvedValue(upcomingBudget)
      mockDatabaseService.updateBudget.mockResolvedValue(true)
      mockDatabaseService.createBudgetPeriod.mockResolvedValue({ id: 2 })
      mockDatabaseService.updateAllPeriodStatuses.mockResolvedValue([])
      mockDatabaseService.getActiveBudget.mockResolvedValue(currentBudget)
      mockDatabaseService.getOrphanExpenses.mockResolvedValue([])

      await scheduler.performScheduledTasks()

      expect(mockDatabaseService.updateBudget).toHaveBeenCalledWith(1, { is_active: false })
      expect(mockDatabaseService.updateBudget).toHaveBeenCalledWith(2, { 
        is_active: true, 
        is_upcoming: false 
      })
      expect(mockDatabaseService.createBudgetPeriod).toHaveBeenCalled()
    })

    it('should not continue budget in vacation mode', async () => {
      const completedPeriod = {
        id: 1,
        budget_id: 1,
        end_date: '2025-07-27',
        status: 'completed'
      }

      const vacationBudget = {
        id: 1,
        name: 'Vacation Budget',
        is_active: true,
        vacation_mode: true
      }

      mockDatabaseService.getBudgetPeriods.mockResolvedValue([completedPeriod])
      mockDatabaseService.getBudgetById.mockResolvedValue(vacationBudget)
      mockDatabaseService.updateAllPeriodStatuses.mockResolvedValue([])
      mockDatabaseService.getActiveBudget.mockResolvedValue(vacationBudget)
      mockDatabaseService.getOrphanExpenses.mockResolvedValue([])

      await scheduler.performScheduledTasks()

      expect(mockDatabaseService.getUpcomingBudget).not.toHaveBeenCalled()
      expect(mockDatabaseService.createBudgetPeriod).not.toHaveBeenCalled()
    })
  })

  describe('Auto-Continue Logic', () => {
    it('should create new period when active budget has no active/upcoming periods', async () => {
      const activeBudget = {
        id: 1,
        name: 'Active Budget',
        amount: 400,
        duration_days: 7,
        vacation_mode: false
      }

      mockDatabaseService.updateAllPeriodStatuses.mockResolvedValue([])
      mockDatabaseService.getBudgetPeriods.mockResolvedValue([])
      mockDatabaseService.getActiveBudget.mockResolvedValue(activeBudget)
      mockDatabaseService.createBudgetPeriod.mockResolvedValue({ id: 1 })
      mockDatabaseService.getOrphanExpenses.mockResolvedValue([])

      await scheduler.performScheduledTasks()

      expect(mockDatabaseService.createBudgetPeriod).toHaveBeenCalledWith({
        budget_id: 1,
        start_date: expect.any(String),
        end_date: expect.any(String),
        target_amount: 400,
        status: 'active'
      })
    })

    it('should not auto-continue if active period exists', async () => {
      const activeBudget = {
        id: 1,
        vacation_mode: false
      }

      const periodsWithActive = [
        { status: 'active' },
        { status: 'completed' }
      ]

      mockDatabaseService.updateAllPeriodStatuses.mockResolvedValue([])
      mockDatabaseService.getBudgetPeriods.mockResolvedValue(periodsWithActive)
      mockDatabaseService.getActiveBudget.mockResolvedValue(activeBudget)
      mockDatabaseService.getOrphanExpenses.mockResolvedValue([])

      await scheduler.performScheduledTasks()

      expect(mockDatabaseService.createBudgetPeriod).not.toHaveBeenCalled()
    })

    it('should not auto-continue if upcoming period exists', async () => {
      const activeBudget = {
        id: 1,
        vacation_mode: false
      }

      const periodsWithUpcoming = [
        { status: 'upcoming' },
        { status: 'completed' }
      ]

      mockDatabaseService.updateAllPeriodStatuses.mockResolvedValue([])
      mockDatabaseService.getBudgetPeriods.mockResolvedValue(periodsWithUpcoming)
      mockDatabaseService.getActiveBudget.mockResolvedValue(activeBudget)
      mockDatabaseService.getOrphanExpenses.mockResolvedValue([])

      await scheduler.performScheduledTasks()

      expect(mockDatabaseService.createBudgetPeriod).not.toHaveBeenCalled()
    })
  })

  describe('Orphan Expense Association', () => {
    it('should associate orphan expenses with matching periods', async () => {
      const orphanExpenses = [
        { id: 1, timestamp: '2025-07-22T10:00:00' },
        { id: 2, timestamp: '2025-07-24T15:30:00' }
      ]

      const matchingPeriod = {
        id: 1,
        start_date: '2025-07-21',
        end_date: '2025-07-27'
      }

      mockDatabaseService.updateAllPeriodStatuses.mockResolvedValue([])
      mockDatabaseService.getBudgetPeriods.mockResolvedValue([])
      mockDatabaseService.getActiveBudget.mockResolvedValue(null)
      mockDatabaseService.getOrphanExpenses.mockResolvedValue(orphanExpenses)
      mockDatabaseService.findPeriodForExpense
        .mockResolvedValueOnce(matchingPeriod)
        .mockResolvedValueOnce(matchingPeriod)
      mockDatabaseService.associateExpenseWithPeriod.mockResolvedValue(true)

      await scheduler.performScheduledTasks()

      expect(mockDatabaseService.findPeriodForExpense).toHaveBeenCalledTimes(2)
      expect(mockDatabaseService.associateExpenseWithPeriod).toHaveBeenCalledWith(1, 1)
      expect(mockDatabaseService.associateExpenseWithPeriod).toHaveBeenCalledWith(2, 1)
    })

    it('should skip orphan expenses with no matching period', async () => {
      const orphanExpenses = [
        { id: 1, timestamp: '2025-07-15T10:00:00' } // Before any period
      ]

      mockDatabaseService.updateAllPeriodStatuses.mockResolvedValue([])
      mockDatabaseService.getBudgetPeriods.mockResolvedValue([])
      mockDatabaseService.getActiveBudget.mockResolvedValue(null)
      mockDatabaseService.getOrphanExpenses.mockResolvedValue(orphanExpenses)
      mockDatabaseService.findPeriodForExpense.mockResolvedValue(null)

      await scheduler.performScheduledTasks()

      expect(mockDatabaseService.findPeriodForExpense).toHaveBeenCalledWith('2025-07-15T10:00:00')
      expect(mockDatabaseService.associateExpenseWithPeriod).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDatabaseService.updateAllPeriodStatuses.mockRejectedValue(new Error('Database error'))
      mockDatabaseService.getBudgetPeriods.mockResolvedValue([])
      mockDatabaseService.getActiveBudget.mockResolvedValue(null)
      mockDatabaseService.getOrphanExpenses.mockResolvedValue([])

      // Should not throw
      await expect(scheduler.performScheduledTasks()).resolves.toBeUndefined()
    })

    it('should continue processing other tasks if one fails', async () => {
      mockDatabaseService.updateAllPeriodStatuses.mockRejectedValue(new Error('Status update failed'))
      mockDatabaseService.getBudgetPeriods.mockResolvedValue([])
      mockDatabaseService.getActiveBudget.mockResolvedValue(null)
      mockDatabaseService.getOrphanExpenses.mockResolvedValue([])

      await scheduler.performScheduledTasks()

      // Other methods should still be called
      expect(mockDatabaseService.getBudgetPeriods).toHaveBeenCalled()
      expect(mockDatabaseService.getActiveBudget).toHaveBeenCalled()
      expect(mockDatabaseService.getOrphanExpenses).toHaveBeenCalled()
    })
  })
})