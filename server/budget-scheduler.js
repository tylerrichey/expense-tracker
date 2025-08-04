/**
 * Budget period scheduler and auto-continuation logic
 */

import { databaseService } from "./database.js";
import {
  updatePeriodStatuses,
  calculateNextPeriodStart,
  generateBudgetPeriods,
  setDatabaseInstance,
} from "./budget-utils.js";
import { logger } from "./logger.js";
import {
  getCurrentTimezone,
  getCurrentDateInTimezone,
  createEndOfDayInTimezone,
  createStartOfDayInTimezone,
} from "./timezone-utils.js";

class BudgetScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 60 * 60 * 1000; // Check every hour
  }

  start() {
    if (this.isRunning) {
      logger.log("info", "Budget scheduler is already running");
      return;
    }

    logger.log("info", "🕐 Starting budget scheduler...");
    this.isRunning = true;

    // Set database instance for timezone-aware operations
    setDatabaseInstance(databaseService.db);

    // Run immediate check
    this.performScheduledTasks();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.performScheduledTasks();
    }, this.checkInterval);
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.log("info", "⏹️ Stopping budget scheduler...");
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async performScheduledTasks() {
    try {
      logger.log("info", "🔄 Budget scheduler: Performing scheduled tasks...");

      // Update all period statuses
      await this.updatePeriodStatuses();

      // Handle period transitions
      await this.handlePeriodTransitions();

      // Auto-continue budgets if needed
      await this.autoContinueBudgets();

      // Associate unassociated expenses
      await this.associateOrphanExpenses();

      logger.log("info", "✅ Budget scheduler: Scheduled tasks completed");
    } catch (err) {
      logger.log(
        "error",
        "Budget scheduler: Error performing scheduled tasks",
        { error: err.message }
      );
    }
  }

  async updatePeriodStatuses() {
    try {
      // Add detailed logging before updating statuses
      const timezone = getCurrentTimezone(databaseService.db);
      const currentDate = getCurrentDateInTimezone(timezone);
      const periods = await databaseService.getBudgetPeriods();

      logger.debug("🔍 DETAILED STATUS UPDATE DEBUG", {
        timezone: timezone,
        currentDateUTC: new Date().toISOString(),
        currentDateInTimezone: currentDate.toISOString(),
        currentDateInTimezoneLocal: currentDate.toLocaleString("en-US", {
          timeZone: timezone,
        }),
        periodsCount: periods.length,
      });

      // Log each period before status update
      for (const period of periods) {
        const startDate = createStartOfDayInTimezone(
          period.start_date,
          timezone
        );
        const endDate = createEndOfDayInTimezone(period.end_date, timezone);
        const isInPeriod = currentDate >= startDate && currentDate <= endDate;

        logger.debug(`🔍 Period ${period.id} analysis`, {
          periodStart: period.start_date,
          periodEnd: period.end_date,
          currentStatus: period.status,
          startDateInTimezone: startDate.toISOString(),
          endDateInTimezone: endDate.toISOString(),
          currentDateInTimezone: currentDate.toISOString(),
          isCurrentDateInPeriod: isInPeriod,
          calculatedStatus:
            currentDate < startDate
              ? "upcoming"
              : isInPeriod
              ? "active"
              : "completed",
        });
      }

      await databaseService.updateAllPeriodStatuses();
      logger.log("info", "  📊 Updated all budget period statuses");
    } catch (err) {
      logger.log("error", "  ❌ Error updating period statuses", {
        error: err.message,
      });
    }
  }

  async handlePeriodTransitions() {
    try {
      // Get periods that just became completed
      const periods = await databaseService.getBudgetPeriods();
      const timezone = getCurrentTimezone(databaseService.db);
      const now = getCurrentDateInTimezone(timezone);

      for (const period of periods) {
        const endDate = createEndOfDayInTimezone(period.end_date, timezone);
        const isJustCompleted =
          period.status === "completed" &&
          Math.abs(now - endDate) < this.checkInterval;

        if (isJustCompleted) {
          logger.log(
            "info",
            `  🏁 Period ${period.id} just completed in timezone ${timezone}`
          );
          await this.handlePeriodCompletion(period);
        }
      }
    } catch (err) {
      logger.log("error", "  ❌ Error handling period transitions", {
        error: err.message,
      });
    }
  }

  async handlePeriodCompletion(completedPeriod) {
    try {
      // Get the budget for this period
      const budget = await databaseService.getBudgetById(
        completedPeriod.budget_id
      );
      if (!budget) {
        logger.log(
          "warn",
          `  ⚠️ Budget ${completedPeriod.budget_id} not found for completed period`
        );
        return;
      }

      // Check if this budget is active and should continue
      if (budget.is_active) {
        // Check if there's an upcoming budget scheduled
        const upcomingBudget = await databaseService.getUpcomingBudget();

        if (upcomingBudget) {
          logger.log(
            "info",
            `  🔄 Transitioning to upcoming budget: ${upcomingBudget.name}`
          );
          await this.transitionToUpcomingBudget(budget, upcomingBudget);
        } else {
          const periods = await databaseService.getBudgetPeriods(budget.id);
          const hasActivePeriod = periods.some((p) => p.status === "active");
          const hasUpcomingPeriod = periods.some(
            (p) => p.status === "upcoming"
          );

          if (!hasActivePeriod && !hasUpcomingPeriod) {
            if (budget.vacation_mode) {
              logger.log(
                "info",
                `  🏖️ Auto-continuing budget in vacation mode: ${budget.name}`
              );
            } else {
              logger.log("info", `  🔄 Auto-continuing budget: ${budget.name}`);
            }
            await this.continueBudget(budget, completedPeriod);
          }
        }
      } else {
        logger.info(`Budget ${budget.name} is inactive, not continuing`);
      }
    } catch (err) {
      logger.error("Error handling period completion", { error: err.message });
    }
  }

  async continueBudget(budget, lastPeriod) {
    try {
      // Calculate next period start date
      const nextStartDate = calculateNextPeriodStart(
        lastPeriod,
        budget.duration_days
      );
      const nextPeriods = generateBudgetPeriods(budget, nextStartDate, 1);
      const nextPeriod = nextPeriods[0];

      // Create the next period
      await databaseService.createBudgetPeriod(nextPeriod);

      // Set budget as upcoming to show continuation on calendar
      await databaseService.updateBudget(budget.id, {
        is_upcoming: true,
      });

      logger.info(`Created continuation period for budget ${budget.name}`);
    } catch (err) {
      logger.error("Error continuing budget", { error: err.message });
      throw err;
    }
  }

  async transitionToUpcomingBudget(currentBudget, upcomingBudget) {
    try {
      // Deactivate current budget and activate upcoming budget
      await databaseService.updateBudget(currentBudget.id, {
        is_active: false,
      });

      await databaseService.updateBudget(upcomingBudget.id, {
        is_active: true,
        is_upcoming: false,
      });

      // Create first period for the new active budget using timezone-aware date
      const timezone = getCurrentTimezone(databaseService.db);
      const currentDate = getCurrentDateInTimezone(timezone);
      const periods = generateBudgetPeriods(upcomingBudget, currentDate, 1);
      const newPeriod = periods[0];

      await databaseService.createBudgetPeriod(newPeriod);

      logger.info(`Transitioned from ${currentBudget.name} to ${upcomingBudget.name}`);
    } catch (err) {
      logger.error("Error transitioning to upcoming budget", { error: err.message });
      throw err;
    }
  }

  async autoContinueBudgets() {
    try {
      // Find active budgets that have no upcoming periods (including those in vacation mode)
      const activeBudget = await databaseService.getActiveBudget();
      if (!activeBudget) {
        return;
      }

      // Get timezone and current date in that timezone
      const timezone = getCurrentTimezone(databaseService.db);
      const currentDate = getCurrentDateInTimezone(timezone);

      // Check if active budget has any upcoming or active periods using timezone-aware logic
      const periods = await databaseService.getBudgetPeriods(activeBudget.id);

      // Re-evaluate period statuses using current timezone-aware date to ensure accuracy
      const now = currentDate;
      let hasActivePeriod = false;
      let hasUpcomingPeriod = false;

      for (const period of periods) {
        const startDate = createStartOfDayInTimezone(
          period.start_date,
          timezone
        );
        const endDate = createEndOfDayInTimezone(period.end_date, timezone);

        if (now >= startDate && now <= endDate) {
          hasActivePeriod = true;
        } else if (now < startDate) {
          hasUpcomingPeriod = true;
        }
      }

      // Only create new period if there are truly no active or upcoming periods
      if (!hasActivePeriod && !hasUpcomingPeriod) {
        if (activeBudget.vacation_mode) {
          logger.log(
            "info",
            `  🏖️ Auto-continuing budget in vacation mode ${activeBudget.name} - no active/upcoming periods`
          );
        } else {
          logger.log(
            "info",
            `  🔄 Auto-continuing budget ${activeBudget.name} - no active/upcoming periods`
          );
        }

        // Create a new period starting now using timezone-aware date
        const newPeriods = generateBudgetPeriods(activeBudget, currentDate, 1);
        const newPeriod = newPeriods[0];

        await databaseService.createBudgetPeriod(newPeriod);

        // Set budget as upcoming to show continuation on calendar
        await databaseService.updateBudget(activeBudget.id, {
          is_upcoming: true,
        });

        logger.log(
          "info",
          `  ✅ Created auto-continuation period for ${activeBudget.name}`
        );
      } else {
        // Log why we're not creating a period for debugging
        logger.log(
          "info",
          `  ℹ️ Not auto-continuing ${
            activeBudget.name
          }: hasActive=${hasActivePeriod}, hasUpcoming=${hasUpcomingPeriod}, currentDate=${currentDate.toISOString()}, timezone=${timezone}`
        );
      }
    } catch (err) {
      logger.log("error", "  ❌ Error auto-continuing budgets", {
        error: err.message,
      });
    }
  }

  async associateOrphanExpenses() {
    try {
      // Find expenses that don't have a budget_period_id
      const orphanExpenses = await databaseService.getOrphanExpenses();

      if (orphanExpenses.length === 0) {
        return;
      }

      logger.log(
        "info",
        `  🔗 Found ${orphanExpenses.length} orphan expenses to associate`
      );

      // Get all periods to match against
      const allPeriods = await databaseService.getBudgetPeriods();

      let associatedCount = 0;
      for (const expense of orphanExpenses) {
        const matchingPeriod = await databaseService.findPeriodForExpense(
          expense.timestamp
        );
        if (matchingPeriod) {
          // Get the budget for this period to check vacation mode
          const budget = await databaseService.getBudgetById(
            matchingPeriod.budget_id
          );
          if (budget && budget.vacation_mode) {
            // Skip association during vacation mode
            continue;
          }

          // Associate the expense with the period
          await databaseService.associateExpenseWithPeriod(
            expense.id,
            matchingPeriod.id
          );
          associatedCount++;
        }
      }

      if (associatedCount > 0) {
        logger.log(
          "info",
          `  ✅ Associated ${associatedCount} orphan expenses with periods`
        );
      }
    } catch (err) {
      logger.log("error", "  ❌ Error associating orphan expenses", {
        error: err.message,
      });
    }
  }

  // Manual trigger methods for testing/debugging
  async triggerPeriodUpdate() {
    logger.log("info", "🔧 Manual trigger: Updating period statuses");
    await this.updatePeriodStatuses();
  }

  async triggerAutoContinue() {
    logger.log("info", "🔧 Manual trigger: Auto-continuing budgets");
    await this.autoContinueBudgets();
  }

  async triggerOrphanAssociation() {
    logger.log("info", "🔧 Manual trigger: Associating orphan expenses");
    await this.associateOrphanExpenses();
  }
}

// Add helper methods to database service
if (!databaseService.getOrphanExpenses) {
  databaseService.getOrphanExpenses = function () {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM expenses 
        WHERE budget_period_id IS NULL 
        ORDER BY timestamp DESC
      `);
      const expenses = stmt.all();
      return Promise.resolve(expenses);
    } catch (err) {
      logger.error("Database: Error fetching orphan expenses", { error: err.message });
      return Promise.reject(err);
    }
  };
}

if (!databaseService.associateExpenseWithPeriod) {
  databaseService.associateExpenseWithPeriod = function (expenseId, periodId) {
    try {
      const stmt = this.db.prepare(`
        UPDATE expenses 
        SET budget_period_id = ? 
        WHERE id = ?
      `);
      const result = stmt.run(periodId, expenseId);
      return Promise.resolve(result.changes > 0);
    } catch (err) {
      logger.error("Database: Error associating expense with period", { error: err.message });
      return Promise.reject(err);
    }
  };
}

export const budgetScheduler = new BudgetScheduler();
export default budgetScheduler;
