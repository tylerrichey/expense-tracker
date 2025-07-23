/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Server module declarations for tests
declare module '../../server/database.js' {
  export class DatabaseService {
    constructor(dbPath?: string)
    init(): Promise<void>
    close(): void
    addExpense(expense: any): Promise<any>
    getAllExpenses(): Promise<any[]>
    getCurrentBudgetPeriod(): Promise<any>
    createBudget(budget: any): Promise<any>
    activateBudget(id: number): Promise<boolean>
    deactivateBudget(id: number): Promise<boolean>
    getBudgetById(id: number): Promise<any>
    getActiveBudget(): Promise<any>
    getUpcomingBudget(): Promise<any>
    updateBudget(id: number, updates: any): Promise<any>
    deleteBudget(id: number): Promise<any>
    getBudgetPeriods(budgetId?: number): Promise<any[]>
    createBudgetPeriod(period: any): Promise<any>
    updateBudgetPeriodStatus(id: number, status: string): Promise<boolean>
    findPeriodForExpense(timestamp: string): Promise<any>
    associateExpenseWithPeriod(expenseId: number, periodId: number): Promise<boolean>
    getOrphanExpenses(): Promise<any[]>
    [key: string]: any
  }
  export const databaseService: DatabaseService
}

declare module '../../server/budget-utils.js' {
  export function generateBudgetPeriods(budget: any, startDate: Date, count: number): any[]
  export function generateRetroactivePeriod(budget: any): any
  export function updatePeriodStatuses(periods: any[]): any[]
  export function findPeriodForDate(date: Date, periods: any[]): any
  export function calculateNextPeriodStart(period: any, durationDays: number): Date
  export function validateBudget(budget: any): { isValid: boolean; errors: string[] }
  export function formatDateForDB(date: Date): string
}

declare module '../../server/migrations/001-budget-system.js' {
  export function up(db: any): Promise<void>
  export function down(db: any): Promise<void>
}

interface ImportMetaEnv {
  readonly VITE_GOOGLE_PLACES_API_KEY: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}