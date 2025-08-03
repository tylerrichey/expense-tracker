import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create a separate database connection to avoid circular dependencies
let debugDb = null

function getDebugDb() {
  if (!debugDb) {
    // Use the same database path logic as the main database service
    let dbPath
    if (process.env.NODE_ENV === 'production') {
      dbPath = '/app/data/expenses.db'
    } else if (process.env.NODE_ENV === 'development') {
      dbPath = join(__dirname, 'expenses-test.db')
    } else {
      dbPath = join(__dirname, 'expenses.db')
    }
    
    try {
      debugDb = new Database(dbPath, { readonly: true })
    } catch (error) {
      console.warn('Failed to open debug database connection:', error.message)
      return null
    }
  }
  return debugDb
}

/**
 * Check if debug logging is enabled via settings or environment variable
 * Settings take precedence over environment variables
 * @returns {boolean} True if debug logging is enabled
 */
export function isDebugLoggingEnabled() {
  try {
    const db = getDebugDb()
    if (db) {
      try {
        const stmt = db.prepare('SELECT value FROM user_settings WHERE key = ?')
        const row = stmt.get('debug_logging')
        if (row) {
          return row.value === 'true'
        }
      } catch (error) {
        // Table might not exist yet, fall back to env var
      }
    }
    
    // Fall back to environment variable for backwards compatibility
    return process.env.DEBUG_EXPENSES === 'true'
  } catch (error) {
    console.warn('Failed to check debug logging setting, falling back to env var:', error.message)
    return process.env.DEBUG_EXPENSES === 'true'
  }
}

/**
 * Log debug message if debug logging is enabled
 * @param {string} message - Debug message to log
 * @param {any} data - Optional data to include with the message
 */
export function debugLog(message, data = null) {
  if (isDebugLoggingEnabled()) {
    if (data) {
      console.log(message, data)
    } else {
      console.log(message)
    }
  }
}