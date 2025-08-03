<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>Settings</h1>
    </div>

    <div class="settings-sections">
      <!-- Timezone Setting -->
      <div class="settings-section">
        <h2>Timezone</h2>
        <p>
          Set your timezone to ensure budget periods roll over at the correct
          local time.
        </p>

        <div class="timezone-selector">
          <label for="timezone-select">
            Current Timezone: {{ currentTimezone || "UTC" }}
          </label>

          <select
            id="timezone-select"
            v-model="selectedTimezone"
            @change="updateTimezone"
            :disabled="updatingTimezone"
          >
            <option v-for="tz in timezones" :key="tz.value" :value="tz.value">
              {{ tz.label }}
            </option>
          </select>

          <div v-if="updatingTimezone" class="update-message text-gray-500">
            Updating timezone...
          </div>

          <div
            v-if="updateMessageTimezone"
            class="update-message"
            :class="updateMessageClass"
          >
            {{ updateMessageTimezone }}
          </div>
        </div>

        <div class="mt-4 p-3 bg-blue-50">
          <p class="text-blue-800">
            <strong>Note:</strong> Changing your timezone will affect when
            budget periods start and end. Existing budget periods will continue
            using their original timezone until they complete.
          </p>
        </div>
      </div>

      <!-- Debug Logging Setting -->
      <div class="settings-section">
        <h2>Debug Logging</h2>
        <p>
          Enable detailed debug logging for troubleshooting. This will show
          additional information in server logs about expense processing,
          timezone calculations, and budget period operations.
        </p>

        <div class="debug-toggle">
          <label class="toggle-container">
            <input
              type="checkbox"
              v-model="debugLogging"
              @change="updateDebugLogging"
              :disabled="updatingDebug"
            />
            <span class="toggle-slider"></span>
            <span class="toggle-label">
              {{
                debugLogging
                  ? "Debug logging enabled"
                  : "Debug logging disabled"
              }}
            </span>
          </label>

          <div v-if="updatingDebug" class="update-message text-gray-500">
            Updating debug setting...
          </div>

          <div
            v-if="updateMessageDebug"
            class="update-message"
            :class="updateMessageClass"
          >
            {{ updateMessageDebug }}
          </div>
        </div>
      </div>

      <!-- Recent Logs Viewer -->
      <div class="settings-section">
        <h2>Recent Logs</h2>
        <p>
          View the last 100 log entries from the application server. Useful for
          troubleshooting issues and monitoring application activity.
        </p>

        <div class="logs-controls">
          <button
            @click="loadRecentLogs"
            :disabled="loadingLogs"
            class="btn btn-primary"
          >
            {{ loadingLogs ? "Loading..." : "Refresh Logs" }}
          </button>

          <button
            v-if="logs.length > 0"
            @click="clearLogDisplay"
            class="btn btn-secondary ml-2"
          >
            Clear Display
          </button>
        </div>

        <div v-if="logError" class="error-message mt-2">
          {{ logError }}
        </div>

        <div v-if="logs.length > 0" class="logs-container">
          <div class="logs-header">
            <span>Showing {{ logs.length }} most recent log entries</span>
          </div>

          <div class="logs-list">
            <div
              v-for="(log, index) in logs"
              :key="index"
              class="log-entry"
              :class="`log-${log.level.toLowerCase()}`"
            >
              <div class="log-meta">
                <span class="log-timestamp">{{
                  formatTimestamp(log.timestamp)
                }}</span>
                <span class="log-level">{{ log.level }}</span>
              </div>
              <div class="log-message">{{ log.message }}</div>
              <div v-if="log.context" class="log-context">
                <details>
                  <summary>Context</summary>
                  <pre>{{ JSON.stringify(log.context, null, 2) }}</pre>
                </details>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="!loadingLogs" class="no-logs-message">
          No logs loaded. Click "Refresh Logs" to load recent entries.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { AuthService } from "../services/auth";

const currentTimezone = ref("UTC");
const selectedTimezone = ref("UTC");
const timezones = ref([]);
const updatingTimezone = ref(false);
const updateMessageTimezone = ref("");
const updatingDebug = ref(false);
const updateMessageDebug = ref("");
const debugLogging = ref(false);
const logs = ref([]);
const loadingLogs = ref(false);
const logError = ref("");

const updateMessageClass = computed(() => {
  const updateMessages =
    updateMessageDebug.value + " " + updateMessageTimezone.value;
  if (updateMessages.includes("success")) {
    return "text-green-600";
  } else if (
    updateMessages.includes("error") ||
    updateMessages.includes("failed")
  ) {
    return "text-red-600";
  }
  return "text-gray-600";
});

async function loadTimezones() {
  try {
    const response = await fetch("/api/timezones", {
      method: "GET",
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to load timezones");
    }

    timezones.value = await response.json();
  } catch (error) {
    console.error("Error loading timezones:", error);
    updateMessageTimezone.value = "Error loading available timezones";
  }
}

async function loadCurrentTimezone() {
  try {
    const response = await fetch("/api/settings/timezone", {
      method: "GET",
      headers: AuthService.getAuthHeaders(),
    });

    if (response.ok) {
      const setting = await response.json();
      currentTimezone.value = setting.value;
      selectedTimezone.value = setting.value;
    } else if (response.status === 404) {
      // Setting doesn't exist yet, use default
      currentTimezone.value = "UTC";
      selectedTimezone.value = "UTC";
    } else {
      throw new Error("Failed to load timezone setting");
    }
  } catch (error) {
    console.error("Error loading current timezone:", error);
    updateMessageTimezone.value = "Error loading current timezone setting";
  }
}

async function loadDebugLoggingSetting() {
  try {
    const response = await fetch("/api/settings/debug_logging", {
      method: "GET",
      headers: AuthService.getAuthHeaders(),
    });

    if (response.ok) {
      const setting = await response.json();
      debugLogging.value = setting.value === "true";
    } else if (response.status === 404) {
      // Setting doesn't exist yet, use default (false)
      debugLogging.value = false;
    } else {
      throw new Error("Failed to load debug logging setting");
    }
  } catch (error) {
    console.error("Error loading debug logging setting:", error);
    updateMessageDebug.value = "Error loading debug logging setting";
  }
}

async function updateTimezone() {
  if (selectedTimezone.value === currentTimezone.value) {
    return; // No change
  }

  updatingTimezone.value = true;
  updateMessageTimezone.value = "";

  try {
    const response = await fetch("/api/settings/timezone", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...AuthService.getAuthHeaders(),
      },
      body: JSON.stringify({ value: selectedTimezone.value }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update timezone");
    }

    const updatedSetting = await response.json();
    currentTimezone.value = updatedSetting.value;
    updateMessageTimezone.value = "Timezone updated successfully";

    // Clear success message after 3 seconds
    setTimeout(() => {
      updateMessageTimezone.value = "";
    }, 3000);
  } catch (error) {
    console.error("Error updating timezone:", error);
    updateMessageTimezone.value = `Error updating timezone: ${error.message}`;

    // Revert selection on error
    selectedTimezone.value = currentTimezone.value;
  } finally {
    updatingTimezone.value = false;
  }
}

async function updateDebugLogging() {
  updatingDebug.value = true;
  updateMessageDebug.value = "";

  try {
    const response = await fetch("/api/settings/debug_logging", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...AuthService.getAuthHeaders(),
      },
      body: JSON.stringify({ value: debugLogging.value.toString() }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || "Failed to update debug logging setting"
      );
    }

    updateMessageDebug.value = `Debug logging ${
      debugLogging.value ? "enabled" : "disabled"
    } successfully`;

    // Clear success message after 3 seconds
    setTimeout(() => {
      updateMessageDebug.value = "";
    }, 3000);
  } catch (error) {
    console.error("Error updating debug logging setting:", error);
    updateMessageDebug.value = `Error updating debug logging: ${error.message}`;

    // Revert toggle on error
    debugLogging.value = !debugLogging.value;
  } finally {
    updatingDebug.value = false;
  }
}

async function loadRecentLogs() {
  loadingLogs.value = true;
  logError.value = "";

  try {
    const response = await fetch("/api/logs", {
      method: "GET",
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to load recent logs");
    }

    const data = await response.json();
    logs.value = (data.logs || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    console.error("Error loading recent logs:", error);
    logError.value = `Error loading logs: ${error.message}`;
  } finally {
    loadingLogs.value = false;
  }
}

function clearLogDisplay() {
  logs.value = [];
  logError.value = "";
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

onMounted(async () => {
  await Promise.all([
    loadTimezones(),
    loadCurrentTimezone(),
    loadDebugLoggingSetting(),
  ]);
});
</script>

<style scoped>
.settings-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  color: #e0e0e0;
}

.page-header h1 {
  color: #e0e0e0;
  margin-bottom: 1.5rem;
}

.settings-sections {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  background: #2a2a2a;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #444;
}

.settings-section h2 {
  color: #e0e0e0;
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.settings-section p {
  color: #b0b0b0;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.timezone-selector label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #e0e0e0;
  margin-bottom: 0.5rem;
}

.timezone-selector select {
  display: block;
  width: 100%;
  max-width: 400px;
  padding: 0.75rem;
  background: #1e1e1e;
  border: 1px solid #555;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.875rem;
  transition: border-color 0.2s ease;
}

.timezone-selector select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.timezone-selector select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.timezone-selector select option {
  background: #1e1e1e;
  color: #e0e0e0;
}

.update-message {
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

.text-gray-500 {
  color: #888;
}

.text-green-600 {
  color: #28a745;
}

.text-red-600 {
  color: #dc3545;
}

.text-gray-600 {
  color: #b0b0b0;
}

/* Toggle Switch Styling */
.debug-toggle {
  margin-top: 1rem;
}

.toggle-container {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.toggle-container input[type="checkbox"] {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 50px;
  height: 24px;
  background: #444;
  border-radius: 12px;
  transition: background-color 0.3s ease;
  margin-right: 12px;
}

.toggle-slider::before {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #e0e0e0;
  border-radius: 50%;
  transition: transform 0.3s ease;
}

.toggle-container input[type="checkbox"]:checked + .toggle-slider {
  background: #007bff;
}

.toggle-container input[type="checkbox"]:checked + .toggle-slider::before {
  transform: translateX(26px);
}

.toggle-container input[type="checkbox"]:disabled + .toggle-slider {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-label {
  color: #e0e0e0;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Note/Info Box Styling */
.settings-section .mt-4 {
  margin-top: 1rem;
}

.settings-section .p-3 {
  padding: 0.75rem;
}

.settings-section .bg-blue-50 {
  background: #1a2332;
  border: 1px solid #2563eb;
  border-radius: 6px;
}

.settings-section .bg-orange-50 {
  background: #2d1f1a;
  border: 1px solid #f59e0b;
  border-radius: 6px;
}

.settings-section .text-blue-800 {
  color: #60a5fa;
}

.settings-section .text-blue-800 strong {
  color: #93c5fd;
  font-weight: 600;
}

.settings-section .text-orange-800 {
  color: #fbbf24;
}

.settings-section .text-orange-800 strong {
  color: #fcd34d;
  font-weight: 600;
}

/* Logs Section Styling */
.logs-controls {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.error-message {
  color: #dc3545;
  padding: 0.5rem;
  background: #2d1a1a;
  border: 1px solid #dc3545;
  border-radius: 4px;
}

.logs-container {
  margin-top: 1rem;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  background: #1a1a1a;
}

.logs-header {
  padding: 0.75rem;
  border-bottom: 1px solid #3a3a3a;
  background: #2a2a2a;
  border-radius: 6px 6px 0 0;
  color: #e0e0e0;
  font-size: 0.875rem;
  font-weight: 500;
}

.logs-list {
  max-height: 500px;
  overflow-y: auto;
}

.log-entry {
  padding: 0.75rem;
  border-bottom: 1px solid #3a3a3a;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
}

.log-timestamp {
  color: #888;
}

.log-level {
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  text-transform: uppercase;
  font-size: 0.625rem;
}

.log-debug .log-level {
  background: #6c757d;
  color: white;
}

.log-info .log-level {
  background: #007bff;
  color: white;
}

.log-warn .log-level {
  background: #ffc107;
  color: #212529;
}

.log-error .log-level {
  background: #dc3545;
  color: white;
}

.log-message {
  color: #e0e0e0;
  line-height: 1.4;
  margin-bottom: 0.5rem;
}

.log-context {
  font-size: 0.75rem;
}

.log-context details {
  color: #888;
}

.log-context summary {
  cursor: pointer;
  user-select: none;
  padding: 0.25rem 0;
}

.log-context summary:hover {
  color: #bbb;
}

.log-context pre {
  margin: 0.5rem 0 0 0;
  padding: 0.5rem;
  background: #0a0a0a;
  border: 1px solid #3a3a3a;
  border-radius: 3px;
  color: #ccc;
  font-size: 0.75rem;
  overflow-x: auto;
}

.no-logs-message {
  padding: 2rem;
  text-align: center;
  color: #888;
  font-style: italic;
}

@media (max-width: 640px) {
  .settings-page {
    padding: 16px;
  }

  .timezone-selector select {
    max-width: 100%;
  }

  .settings-section {
    padding: 1rem;
  }

  .logs-controls {
    flex-direction: column;
  }

  .logs-list {
    max-height: 300px;
  }

  .log-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
