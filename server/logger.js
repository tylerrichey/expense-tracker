import { writeFileSync, appendFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Logger {
  constructor() {
    // Get current date for filename
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    // Use the same path logic as the database
    let logPath;
    if (process.env.NODE_ENV === "production") {
      logPath = `/app/data/application-${dateStr}.log`;
    } else if (process.env.NODE_ENV === "development") {
      logPath = join(__dirname, `application-test-${dateStr}.log`);
    } else {
      logPath = join(__dirname, `application-${dateStr}.log`);
    }

    this.logPath = logPath;

    // In-memory storage for last 100 log entries
    this.recentLogs = [];
    this.maxRecentLogs = 100;

    // Cache debug setting to avoid DB queries on every log
    this.debugEnabled = process.env.DEBUG_EXPENSES === "true";
    this.debugSettingLoaded = false;

    // Initialize log file if it doesn't exist
    if (!existsSync(logPath)) {
      writeFileSync(
        logPath,
        `Application Log - Started ${new Date().toISOString()}\n${"=".repeat(
          80
        )}\n\n`
      );
    }
  }

  /**
   * Initialize debug setting from database (called once at startup)
   * @param {Object} db - Database instance from main application
   */
  async initializeDebugSetting(db) {
    try {
      const stmt = db.prepare("SELECT value FROM user_settings WHERE key = ?");
      const row = stmt.get("debug_logging");
      if (row) {
        this.debugEnabled = row.value === "true";
      }
      this.debugSettingLoaded = true;
      this.info(
        `Debug logging initialized: ${
          this.debugEnabled ? "enabled" : "disabled"
        }`
      );
    } catch (error) {
      // Use console.warn here to avoid circular logging
      console.warn(
        "Failed to load debug setting from database, using environment variable:",
        error.message
      );
      this.debugSettingLoaded = true;
    }
  }

  /**
   * Update debug setting (called when setting is changed via API)
   * @param {boolean} enabled - Whether debug logging should be enabled
   */
  setDebugEnabled(enabled) {
    this.debugEnabled = enabled;
    this.info(`Debug logging ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Check if debug logging is enabled (now uses cached value)
   * @returns {boolean} True if debug logging is enabled
   */
  isDebugLoggingEnabled() {
    return this.debugEnabled;
  }

  addToRecentLogs(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      context: Object.keys(context).length > 0 ? context : undefined,
    };

    this.recentLogs.push(logEntry);

    // Keep only the last maxRecentLogs entries
    if (this.recentLogs.length > this.maxRecentLogs) {
      this.recentLogs.shift();
    }
  }

  getRecentLogs() {
    return [...this.recentLogs]; // Return a copy to prevent external modification
  }

  formatTimestamp() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    let timeZone;
    try {
      timeZone =
        new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
          .formatToParts(now)
          .find((part) => part.type === "timeZoneName")?.value || "";
    } catch (error) {
      // Fallback for older environments that might not support timeZoneName
      const offset = -now.getTimezoneOffset() / 60;
      timeZone = `UTC${offset >= 0 ? "+" : ""}${offset}`;
    }

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timeZone}`;
  }

  logGooglePlacesRequest(url, headers, body) {
    const timestamp = this.formatTimestamp();
    const logEntry = `
🌍 === GOOGLE PLACES API REQUEST [${timestamp} PST] ===
URL: ${url}
Headers: ${JSON.stringify(
      {
        ...headers,
        "X-Goog-Api-Key": "[REDACTED]", // Hide API key in logs
      },
      null,
      2
    )}
Request Body: ${JSON.stringify(body, null, 2)}
${"=".repeat(50)}

`;

    appendFileSync(this.logPath, logEntry);
  }

  logGooglePlacesResponse(status, statusText, headers, data) {
    const timestamp = this.formatTimestamp();
    const logEntry = `
🌍 === GOOGLE PLACES API RESPONSE [${timestamp} PST] ===
Status: ${status} ${statusText}
Response Headers: ${JSON.stringify(headers, null, 2)}
Response Data: ${JSON.stringify(data, null, 2)}
Total Places Found: ${data.places?.length || 0}
${"=".repeat(50)}

`;

    appendFileSync(this.logPath, logEntry);
  }

  logGooglePlacesError(error) {
    const timestamp = this.formatTimestamp();
    let logEntry = `
❌ === GOOGLE PLACES API ERROR [${timestamp} PST] ===
Error Message: ${error.message}
`;

    if (error.response) {
      logEntry += `Error Status: ${error.response.status} ${
        error.response.statusText
      }
Error Headers: ${JSON.stringify(error.response.headers, null, 2)}
Error Data: ${JSON.stringify(error.response.data, null, 2)}
`;
    } else if (error.request) {
      logEntry += `Request made but no response received
Request Details: ${error.request}
`;
    }

    logEntry += `${"=".repeat(50)}

`;

    appendFileSync(this.logPath, logEntry);

    // Also log to console in development and for errors
    console.log(logEntry);
  }

  log(level, message, context = {}) {
    const timestamp = this.formatTimestamp();
    const levelUpper = level.toUpperCase();

    const icons = {
      DEBUG: "🐛",
      INFO: "ℹ️",
      WARN: "⚠️",
      ERROR: "❌",
    };

    const logEntry = `${icons[levelUpper] || "ℹ️"} ${timestamp}: ${message}${
      Object.keys(context).length > 0
        ? `\nContext: ${JSON.stringify(context, null, 2)}\n`
        : ""
    }`;

    // Add to in-memory storage
    this.addToRecentLogs(level, message, context);

    // Always output to console
    console.log(logEntry);

    // Write to file for non-debug messages or when debug is enabled
    if (levelUpper !== "DEBUG" || this.isDebugLoggingEnabled()) {
      try {
        appendFileSync(this.logPath, logEntry + "\n");
      } catch (error) {
        // Use console.error here to avoid circular logging when file write fails
        console.error("Failed to write to log file:", error);
      }
    }
  }

  debug(message, data = null) {
    if (this.isDebugLoggingEnabled()) {
      this.addToRecentLogs("debug", message, data !== null ? { data } : {});
      this.log("debug", message, data ?? {});
    }
  }

  info(message, context = {}) {
    this.log("info", message, context);
  }

  warn(message, context = {}) {
    this.log("warn", message, context);
  }

  error(message, context = {}) {
    this.log("error", message, context);
  }
}

export const logger = new Logger();
