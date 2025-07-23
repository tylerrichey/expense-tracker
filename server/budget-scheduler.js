/**
 * Budget period scheduler and auto-continuation logic
 */

import { databaseService } from './database.js'
import { updatePeriodStatuses, calculateNextPeriodStart, generateBudgetPeriods } from './budget-utils.js'

class BudgetScheduler {
  constructor() {
    this.isRunning = false
    this.intervalId = null
    this.checkInterval = 60 * 60 * 1000 // Check every hour
  }

  start() {
    if (this.isRunning) {
      console.log('Budget scheduler is already running')
      return
    }

    console.log('🕐 Starting budget scheduler...')
    this.isRunning = true
    
    // Run immediate check
    this.performScheduledTasks()
    
    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.performScheduledTasks()
    }, this.checkInterval)
  }

  stop() {
    if (!this.isRunning) {
      return
    }

    console.log('⏹️ Stopping budget scheduler...')
    this.isRunning = false
    
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  async performScheduledTasks() {
    try {
      console.log('🔄 Budget scheduler: Performing scheduled tasks...')
      
      // Update all period statuses
      await this.updatePeriodStatuses()
      
      // Handle period transitions
      await this.handlePeriodTransitions()
      
      // Auto-continue budgets if needed
      await this.autoContinueBudgets()
      
      // Associate unassociated expenses
      await this.associateOrphanExpenses()
      
      console.log('✅ Budget scheduler: Scheduled tasks completed')
      
    } catch (err) {
      console.error('❌ Budget scheduler: Error performing scheduled tasks:', err)
    }
  }

  async updatePeriodStatuses() {
    try {
      await databaseService.updateAllPeriodStatuses()
      console.log('  📊 Updated all budget period statuses')
    } catch (err) {
      console.error('  ❌ Error updating period statuses:', err)
    }
  }

  async handlePeriodTransitions() {
    try {
      // Get periods that just became completed
      const periods = await databaseService.getBudgetPeriods()
      const now = new Date()
      
      for (const period of periods) {
        const endDate = new Date(period.end_date + 'T23:59:59')
        const isJustCompleted = period.status === 'completed' && 
                               Math.abs(now - endDate) < this.checkInterval
        
        if (isJustCompleted) {
          console.log(`  🏁 Period ${period.id} just completed`)
          await this.handlePeriodCompletion(period)
        }
      }
    } catch (err) {
      console.error('  ❌ Error handling period transitions:', err)
    }
  }

  async handlePeriodCompletion(completedPeriod) {
    try {
      // Get the budget for this period
      const budget = await databaseService.getBudgetById(completedPeriod.budget_id)
      if (!budget) {
        console.log(`  ⚠️ Budget ${completedPeriod.budget_id} not found for completed period`)
        return
      }

      // Check if this budget is active and should continue
      if (budget.is_active) {
        // Check if there's an upcoming budget scheduled
        const upcomingBudget = await databaseService.getUpcomingBudget()
        
        if (upcomingBudget) {
          console.log(`  🔄 Transitioning to upcoming budget: ${upcomingBudget.name}`)
          await this.transitionToUpcomingBudget(budget, upcomingBudget)
        } else {
          const periods = await databaseService.getBudgetPeriods(budget.id)
          const hasActivePeriod = periods.some(p => p.status === 'active')
          const hasUpcomingPeriod = periods.some(p => p.status === 'upcoming')

          if (!hasActivePeriod && !hasUpcomingPeriod) {
            if (budget.vacation_mode) {
              console.log(`  🏖️ Auto-continuing budget in vacation mode: ${budget.name}`)
            } else {
              console.log(`  🔄 Auto-continuing budget: ${budget.name}`)
            }
            await this.continueBudget(budget, completedPeriod)
          }
        }
      } else {
        console.log(`  ⏸️ Budget ${budget.name} is inactive, not continuing`)
      }
    } catch (err) {
      console.error('  ❌ Error handling period completion:', err)
    }
  }

  async continueBudget(budget, lastPeriod) {
    try {
      // Calculate next period start date
      const nextStartDate = calculateNextPeriodStart(lastPeriod, budget.duration_days)
      const nextPeriods = generateBudgetPeriods(budget, nextStartDate, 1)
      const nextPeriod = nextPeriods[0]
      
      // Create the next period
      await databaseService.createBudgetPeriod(nextPeriod)
      
      console.log(`  ✅ Created continuation period for budget ${budget.name}`)
    } catch (err) {
      console.error('  ❌ Error continuing budget:', err)
      throw err
    }
  }

  async transitionToUpcomingBudget(currentBudget, upcomingBudget) {
    try {
      // Deactivate current budget and activate upcoming budget
      await databaseService.updateBudget(currentBudget.id, { 
        is_active: false 
      })
      
      await databaseService.updateBudget(upcomingBudget.id, { 
        is_active: true, 
        is_upcoming: false 
      })
      
      // Create first period for the new active budget
      const periods = generateBudgetPeriods(upcomingBudget, new Date(), 1)
      const newPeriod = periods[0]
      
      await databaseService.createBudgetPeriod(newPeriod)
      
      console.log(`  ✅ Transitioned from ${currentBudget.name} to ${upcomingBudget.name}`)
    } catch (err) {
      console.error('  ❌ Error transitioning to upcoming budget:', err)
      throw err
    }
  }

  async autoContinueBudgets() {
    try {
      // Find active budgets that have no upcoming periods (including those in vacation mode)
      const activeBudget = await databaseService.getActiveBudget()
      if (!activeBudget) {
        return
      }

      // Check if active budget has any upcoming or active periods
      const periods = await databaseService.getBudgetPeriods(activeBudget.id)
      const hasActivePeriod = periods.some(p => p.status === 'active')
      const hasUpcomingPeriod = periods.some(p => p.status === 'upcoming')

      if (!hasActivePeriod && !hasUpcomingPeriod) {
        if (activeBudget.vacation_mode) {
          console.log(`  🏖️ Auto-continuing budget in vacation mode ${activeBudget.name} - no active/upcoming periods`)
        } else {
          console.log(`  🔄 Auto-continuing budget ${activeBudget.name} - no active/upcoming periods`)
        }
        
        // Create a new period starting now
        const newPeriods = generateBudgetPeriods(activeBudget, new Date(), 1)
        const newPeriod = newPeriods[0]
        
        await databaseService.createBudgetPeriod(newPeriod)
        console.log(`  ✅ Created auto-continuation period for ${activeBudget.name}`)
      }
    } catch (err) {
      console.error('  ❌ Error auto-continuing budgets:', err)
    }
  }

  async associateOrphanExpenses() {
    try {
      // Find expenses that don't have a budget_period_id
      const orphanExpenses = await databaseService.getOrphanExpenses()
      
      if (orphanExpenses.length === 0) {
        return
      }

      console.log(`  🔗 Found ${orphanExpenses.length} orphan expenses to associate`)
      
      // Get all periods to match against
      const allPeriods = await databaseService.getBudgetPeriods()
      
      let associatedCount = 0
      for (const expense of orphanExpenses) {
        const matchingPeriod = await databaseService.findPeriodForExpense(expense.timestamp)
        if (matchingPeriod) {
          // Get the budget for this period to check vacation mode
          const budget = await databaseService.getBudgetById(matchingPeriod.budget_id)
          if (budget && budget.vacation_mode) {
            // Skip association during vacation mode
            continue
          }
          
          // Associate the expense with the period
          await databaseService.associateExpenseWithPeriod(expense.id, matchingPeriod.id)
          associatedCount++
        }
      }
      
      if (associatedCount > 0) {
        console.log(`  ✅ Associated ${associatedCount} orphan expenses with periods`)
      }
    } catch (err) {
      console.error('  ❌ Error associating orphan expenses:', err)
    }
  }

  // Manual trigger methods for testing/debugging
  async triggerPeriodUpdate() {
    console.log('🔧 Manual trigger: Updating period statuses')
    await this.updatePeriodStatuses()
  }

  async triggerAutoContinue() {
    console.log('🔧 Manual trigger: Auto-continuing budgets')
    await this.autoContinueBudgets()
  }

  async triggerOrphanAssociation() {
    console.log('🔧 Manual trigger: Associating orphan expenses')
    await this.associateOrphanExpenses()
  }
}

// Add helper methods to database service
if (!databaseService.getOrphanExpenses) {
  databaseService.getOrphanExpenses = function() {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM expenses 
        WHERE budget_period_id IS NULL 
        ORDER BY timestamp DESC
      `)
      const expenses = stmt.all()
      return Promise.resolve(expenses)
    } catch (err) {
      console.error('Database: Error fetching orphan expenses:', err)
      return Promise.reject(err)
    }
  }
}

if (!databaseService.associateExpenseWithPeriod) {
  databaseService.associateExpenseWithPeriod = function(expenseId, periodId) {
    try {
      const stmt = this.db.prepare(`
        UPDATE expenses 
        SET budget_period_id = ? 
        WHERE id = ?
      `)
      const result = stmt.run(periodId, expenseId)
      return Promise.resolve(result.changes > 0)
    } catch (err) {
      console.error('Database: Error associating expense with period:', err)
      return Promise.reject(err)
    }
  }
}

export const budgetScheduler = new BudgetScheduler()
export default budgetScheduler