import { writeFileSync, appendFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class Logger {
  constructor() {
    // Use the same path logic as the database
    let logPath
    if (process.env.NODE_ENV === 'production') {
      logPath = '/app/data/google-places-api.log'
    } else if (process.env.NODE_ENV === 'development') {
      logPath = join(__dirname, 'google-places-api-test.log')
    } else {
      logPath = join(__dirname, 'google-places-api.log')
    }
    
    this.logPath = logPath
    console.log(`📋 Google Places API logs: ${logPath}`)
    
    // Initialize log file if it doesn't exist
    if (!existsSync(logPath)) {
      writeFileSync(logPath, `Google Places API Log - Started ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`)
    }
  }

  formatTimestamp() {
    return new Date().toLocaleString('en-US', { 
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  logRequest(url, headers, body) {
    const timestamp = this.formatTimestamp()
    const logEntry = `
🌍 === GOOGLE PLACES API REQUEST [${timestamp} PST] ===
URL: ${url}
Headers: ${JSON.stringify({
      ...headers,
      'X-Goog-Api-Key': '[REDACTED]' // Hide API key in logs
    }, null, 2)}
Request Body: ${JSON.stringify(body, null, 2)}
${'='.repeat(50)}

`
    
    appendFileSync(this.logPath, logEntry)
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(logEntry)
    }
  }

  logResponse(status, statusText, headers, data) {
    const timestamp = this.formatTimestamp()
    const logEntry = `
🌍 === GOOGLE PLACES API RESPONSE [${timestamp} PST] ===
Status: ${status} ${statusText}
Response Headers: ${JSON.stringify(headers, null, 2)}
Response Data: ${JSON.stringify(data, null, 2)}
Total Places Found: ${data.places?.length || 0}
${'='.repeat(50)}

`
    
    appendFileSync(this.logPath, logEntry)
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(logEntry)
    }
  }

  logError(error) {
    const timestamp = this.formatTimestamp()
    let logEntry = `
❌ === GOOGLE PLACES API ERROR [${timestamp} PST] ===
Error Message: ${error.message}
`
    
    if (error.response) {
      logEntry += `Error Status: ${error.response.status} ${error.response.statusText}
Error Headers: ${JSON.stringify(error.response.headers, null, 2)}
Error Data: ${JSON.stringify(error.response.data, null, 2)}
`
    } else if (error.request) {
      logEntry += `Request made but no response received
Request Details: ${error.request}
`
    }
    
    logEntry += `${'='.repeat(50)}

`
    
    appendFileSync(this.logPath, logEntry)
    
    // Also log to console in development and for errors
    console.log(logEntry)
  }
}

export const logger = new Logger()