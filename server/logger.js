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
      logPath = `/app/data/google-places-api-${dateStr}.log`;
    } else if (process.env.NODE_ENV === "development") {
      logPath = join(__dirname, `google-places-api-test-${dateStr}.log`);
    } else {
      logPath = join(__dirname, `google-places-api-${dateStr}.log`);
    }

    this.logPath = logPath;
    this.log("info", `📋 Google Places API logs: ${logPath}`);

    // Initialize log file if it doesn't exist
    if (!existsSync(logPath)) {
      writeFileSync(
        logPath,
        `Google Places API Log - Started ${new Date().toISOString()}\n${"=".repeat(
          80
        )}\n\n`
      );
    }
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

  logRequest(url, headers, body) {
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

  logResponse(status, statusText, headers, data) {
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

  logError(error) {
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
      INFO: "ℹ️",
      WARN: "⚠️",
      ERROR: "❌",
    };

    const logEntry = `${icons[levelUpper] || "ℹ️"} ${timestamp}: ${message}${
      Object.keys(context).length > 0
        ? `\nContext: ${JSON.stringify(context, null, 2)}\n`
        : ""
    }`;

    console.log(logEntry);
  }
}

export const logger = new Logger();
