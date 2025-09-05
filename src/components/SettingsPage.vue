<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>Settings</h1>
    </div>

    <div class="settings-sections">
      <!-- General Settings -->
      <AccordionSection
        title="General Settings"
        description="Configure basic application settings like timezone and debug logging."
        :default-expanded="false"
      >
        <!-- Timezone Setting -->
        <div class="setting-subsection">
          <h3>Timezone</h3>
          <p class="subsection-description">
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
              budget periods start and end. Existing budget periods will
              continue using their original timezone until they complete.
            </p>
          </div>
        </div>

        <!-- Debug Logging Setting -->
        <div class="setting-subsection">
          <h3>Debug Logging</h3>
          <p class="subsection-description">
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
      </AccordionSection>

      <!-- AI Classification Settings -->
      <AccordionSection
        title="AI Classification"
        description="Configure AI-powered classification of expenses by cuisine type and meal time. Requires an OpenAI-compatible API key."
        :default-expanded="false"
      >
        <div class="ai-settings">
          <!-- AI Settings Tabs -->
          <div class="ai-tabs">
            <button
              class="ai-tab"
              :class="{ active: activeAITab === 'models' }"
              @click="activeAITab = 'models'"
            >
              Models & Provider
            </button>
            <button
              class="ai-tab"
              :class="{ active: activeAITab === 'prompt' }"
              @click="activeAITab = 'prompt'"
            >
              Prompt Template
            </button>
            <button
              class="ai-tab"
              :class="{ active: activeAITab === 'classification' }"
              @click="activeAITab = 'classification'"
            >
              Classification Options
            </button>
          </div>

          <!-- Models & Provider Tab -->
          <div v-show="activeAITab === 'models'" class="ai-tab-content">
            <!-- AI Provider Settings -->
            <div class="setting-group">
              <h3>AI Provider Configuration</h3>

              <div class="form-group">
                <label for="ai-provider">Provider</label>
                <select
                  id="ai-provider"
                  v-model="aiSettings.provider"
                  @change="updateAIProviderURL"
                  :disabled="updatingAI"
                >
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="custom">Custom URL</option>
                </select>
              </div>

              <div class="form-group">
                <label for="ai-base-url">Base URL</label>
                <input
                  id="ai-base-url"
                  type="url"
                  v-model="aiSettings.baseUrl"
                  placeholder="https://api.openai.com/v1"
                  :disabled="updatingAI"
                />
              </div>

              <div class="form-group">
                <label for="ai-api-key">API Key</label>
                <input
                  id="ai-api-key"
                  type="password"
                  v-model="aiSettings.apiKey"
                  placeholder="Enter your API key"
                  :disabled="updatingAI"
                />
              </div>

              <!-- Multi-Model Toggle -->
              <div class="ai-toggle">
                <label class="toggle-container">
                  <input
                    type="checkbox"
                    v-model="aiSettings.multiModelEnabled"
                    :disabled="updatingAI"
                  />
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">
                    {{
                      aiSettings.multiModelEnabled
                        ? "Multi-Model Processing Enabled"
                        : "Single Model Processing"
                    }}
                  </span>
                </label>
              </div>

              <div class="form-group">
                <p class="text-sm text-gray-400">
                  When enabled, up to 3 AI models will process each expense in
                  parallel and combine their results for more accurate
                  classifications.
                </p>
              </div>

              <!-- Model Selection -->
              <div class="form-group">
                <label>AI Models</label>
                <div class="models-config">
                  <!-- Model 1 (Primary) -->
                  <div class="model-row">
                    <label class="model-label">Primary Model</label>
                    <div class="model-selector">
                      <select
                        v-model="aiSettings.model1"
                        :disabled="updatingAI"
                      >
                        <option value="">Select a model...</option>
                        <option
                          v-for="model in availableModels"
                          :key="model.id"
                          :value="model.id"
                        >
                          {{ model.name }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <!-- Model 2 (Secondary) - Only shown in multi-model mode -->
                  <div v-if="aiSettings.multiModelEnabled" class="model-row">
                    <label class="model-label"
                      >Secondary Model (Optional)</label
                    >
                    <div class="model-selector">
                      <select
                        v-model="aiSettings.model2"
                        :disabled="updatingAI"
                      >
                        <option value="">Select a model...</option>
                        <option
                          v-for="model in availableModels"
                          :key="model.id"
                          :value="model.id"
                          :disabled="
                            model.id === aiSettings.model1 ||
                            model.id === aiSettings.model3
                          "
                        >
                          {{ model.name }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <!-- Model 3 (Tertiary) - Only shown in multi-model mode -->
                  <div v-if="aiSettings.multiModelEnabled" class="model-row">
                    <label class="model-label">Tertiary Model (Optional)</label>
                    <div class="model-selector">
                      <select
                        v-model="aiSettings.model3"
                        :disabled="updatingAI"
                      >
                        <option value="">Select a model...</option>
                        <option
                          v-for="model in availableModels"
                          :key="model.id"
                          :value="model.id"
                          :disabled="
                            model.id === aiSettings.model1 ||
                            model.id === aiSettings.model2
                          "
                        >
                          {{ model.name }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div class="refresh-models-row">
                    <button
                      @click="refreshModels"
                      :disabled="loadingModels || !aiSettings.apiKey"
                      class="btn btn-sm refresh-models-btn"
                      title="Refresh available models"
                    >
                      {{ loadingModels ? "Loading..." : "🔄 Refresh Models" }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Multi-Model Strategy - Only shown in multi-model mode -->
              <div v-if="aiSettings.multiModelEnabled" class="form-group">
                <label for="ai-strategy">Result Combination Strategy</label>
                <select
                  id="ai-strategy"
                  v-model="aiSettings.multiModelStrategy"
                  :disabled="updatingAI"
                >
                  <option value="weighted_vote">
                    Weighted Vote (Recommended)
                  </option>
                  <option value="highest_confidence">Highest Confidence</option>
                </select>
                <p class="text-sm text-gray-400 mt-1">
                  <span
                    v-if="aiSettings.multiModelStrategy === 'weighted_vote'"
                  >
                    Combines results from all models, weighting votes by
                    confidence scores.
                  </span>
                  <span v-else>
                    Uses the result from the model with the highest combined
                    confidence score.
                  </span>
                </p>
              </div>

              <div class="ai-toggle">
                <label class="toggle-container">
                  <input
                    type="checkbox"
                    v-model="aiSettings.enabled"
                    :disabled="updatingAI"
                  />
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">
                    {{
                      aiSettings.enabled
                        ? "AI Classification Enabled"
                        : "AI Classification Disabled"
                    }}
                  </span>
                </label>
              </div>

              <button
                @click="saveAISettings"
                :disabled="updatingAI || !aiSettings.apiKey"
                class="btn btn-primary"
              >
                {{
                  updatingAI ? "Saving..." : "Save Provider & Model Settings"
                }}
              </button>
            </div>
          </div>

          <!-- Prompt Template Tab -->
          <div v-show="activeAITab === 'prompt'" class="ai-tab-content">
            <!-- Prompt Template Configuration -->
            <div class="setting-group">
              <h3>Prompt Template Configuration</h3>
              <p class="text-sm">
                Customize the prompt template sent to AI models for expense
                classification. Use placeholders like {{ EXPENSE_DETAILS }},
                {{ CUISINE_TYPES }}, {{ MEAL_TIMES }}, and {{ RESPONSE_FORMAT }}
                for dynamic content.
              </p>

              <div class="form-group">
                <label for="prompt-template">Prompt Template</label>
                <textarea
                  id="prompt-template"
                  v-model="aiSettings.promptTemplate"
                  :disabled="updatingAI"
                  rows="15"
                  placeholder="Enter custom prompt template or leave empty to use default..."
                  class="prompt-template-textarea"
                ></textarea>
              </div>

              <div class="prompt-template-controls">
                <button
                  @click="resetPromptTemplate"
                  :disabled="updatingAI"
                  class="btn btn-secondary"
                  type="button"
                >
                  Reset to Default
                </button>

                <button
                  @click="previewPromptTemplate"
                  :disabled="updatingAI || !aiSettings.promptTemplate"
                  class="btn btn-secondary"
                  type="button"
                >
                  Preview with Sample Data
                </button>

                <button
                  @click="savePromptTemplate"
                  :disabled="updatingAI"
                  class="btn btn-primary"
                  type="button"
                >
                  {{ updatingAI ? "Saving..." : "Save Prompt Template" }}
                </button>
              </div>

              <div class="placeholder-help">
                <p class="text-sm"><strong>Available Placeholders:</strong></p>
                <ul class="text-sm placeholder-list">
                  <li>
                    <!-- prettier-ignore -->
                    <code v-pre>{{EXPENSE_DETAILS}}</code> - Dynamic expense
                    information (amount, place, time)
                  </li>
                  <li>
                    <!-- prettier-ignore -->
                    <code v-pre>{{CUISINE_TYPES}}</code> - List of available
                    cuisine types
                  </li>
                  <li>
                    <!-- prettier-ignore -->
                    <code v-pre>{{MEAL_TIMES}}</code> - List of available meal
                    times
                  </li>
                  <li>
                    <!-- prettier-ignore -->
                    <code v-pre>{{RESPONSE_FORMAT}}</code> - Required JSON
                    response format
                  </li>
                </ul>
              </div>

              <!-- Preview Modal -->
              <div v-if="showPromptPreview" class="prompt-preview-modal">
                <div
                  class="preview-overlay"
                  @click="showPromptPreview = false"
                ></div>
                <div class="preview-content">
                  <div class="preview-header">
                    <h4>Prompt Preview with Sample Data</h4>
                    <button
                      @click="showPromptPreview = false"
                      class="close-btn"
                    >
                      &times;
                    </button>
                  </div>
                  <div class="preview-body">
                    <pre>{{ previewText }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Classification Options Tab -->
          <div v-show="activeAITab === 'classification'" class="ai-tab-content">
            <!-- Classification Options -->
            <div class="setting-group">
              <h3>Classification Options</h3>

              <div class="classification-lists">
                <div class="list-group">
                  <label>Cuisine Types</label>
                  <div class="tag-list">
                    <span
                      v-for="(
                        cuisine, index
                      ) in classificationOptions.cuisineTypes"
                      :key="index"
                      class="tag"
                    >
                      {{ cuisine }}
                      <button
                        @click="removeCuisineType(index)"
                        class="tag-remove"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                  <div class="add-item">
                    <input
                      v-model="newCuisineType"
                      @keyup.enter="addCuisineType"
                      placeholder="Add cuisine type"
                      type="text"
                    />
                    <button @click="addCuisineType" class="btn btn-sm">
                      Add
                    </button>
                  </div>
                </div>

                <div class="list-group">
                  <label>Meal Times</label>
                  <div class="tag-list">
                    <span
                      v-for="(
                        mealTime, index
                      ) in classificationOptions.mealTimes"
                      :key="index"
                      class="tag"
                    >
                      {{ mealTime }}
                      <button @click="removeMealTime(index)" class="tag-remove">
                        ×
                      </button>
                    </span>
                  </div>
                  <div class="add-item">
                    <input
                      v-model="newMealTime"
                      @keyup.enter="addMealTime"
                      placeholder="Add meal time"
                      type="text"
                    />
                    <button @click="addMealTime" class="btn btn-sm">Add</button>
                  </div>
                </div>
              </div>

              <button
                @click="saveClassificationOptions"
                :disabled="updatingClassifications"
                class="btn btn-primary"
              >
                {{
                  updatingClassifications
                    ? "Saving..."
                    : "Save Classification Options"
                }}
              </button>
            </div>

            <!-- Bulk Processing -->
            <div
              class="setting-group"
              v-if="aiSettings.enabled && aiSettings.apiKey"
            >
              <h3>Process Existing Expenses</h3>
              <p class="text-sm">
                Apply AI classification to existing expenses that haven't been
                classified yet.
              </p>

              <div class="bulk-process-controls">
                <button
                  @click="processUnclassifiedExpenses"
                  :disabled="processingExpenses"
                  class="btn btn-secondary"
                >
                  {{
                    processingExpenses
                      ? "Processing..."
                      : "Process Unclassified Expenses"
                  }}
                </button>

                <div v-if="processingProgress.total > 0" class="progress-info">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{
                        width:
                          (processingProgress.current /
                            processingProgress.total) *
                            100 +
                          '%',
                      }"
                    ></div>
                  </div>
                  <div class="progress-text">
                    {{ processingProgress.current }} /
                    {{ processingProgress.total }} ({{
                      processingProgress.success
                    }}
                    success, {{ processingProgress.failed }} failed)
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="updateMessageAI"
            class="update-message"
            :class="updateMessageClass"
          >
            {{ updateMessageAI }}
          </div>
        </div>
      </AccordionSection>

      <!-- System Logs -->
      <AccordionSection
        title="System Logs"
        description="View the last 100 log entries from the application server. Useful for troubleshooting issues and monitoring application activity."
        :default-expanded="false"
      >
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
      </AccordionSection>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { AuthService } from "../services/auth";
import AccordionSection from "./AccordionSection.vue";

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

// AI Classification settings
const aiSettings = ref({
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-3.5-turbo", // Legacy single model
  model1: "gpt-3.5-turbo",
  model2: "",
  model3: "",
  multiModelEnabled: false,
  multiModelStrategy: "weighted_vote",
  enabled: false,
  promptTemplate: "",
});

const classificationOptions = ref({
  cuisineTypes: [],
  mealTimes: [],
});

const newCuisineType = ref("");
const newMealTime = ref("");
const updatingAI = ref(false);
const updatingClassifications = ref(false);
const updateMessageAI = ref("");
const processingExpenses = ref(false);
const processingProgress = ref({
  current: 0,
  total: 0,
  success: 0,
  failed: 0,
});

const availableModels = ref([]);
const loadingModels = ref(false);
const showPromptPreview = ref(false);
const previewText = ref("");
const activeAITab = ref("models");

const updateMessageClass = computed(() => {
  const updateMessages =
    updateMessageDebug.value +
    " " +
    updateMessageTimezone.value +
    " " +
    updateMessageAI.value;
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
    logs.value = (data.logs || []).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
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

// AI Settings Functions
async function loadAISettings() {
  try {
    const settings = await Promise.all([
      fetch("/api/settings/ai_provider_base_url", {
        headers: AuthService.getAuthHeaders(),
      }),
      fetch("/api/settings/ai_provider_api_key", {
        headers: AuthService.getAuthHeaders(),
      }),
      fetch("/api/settings/ai_model", {
        headers: AuthService.getAuthHeaders(),
      }),
      fetch("/api/settings/ai_classification_enabled", {
        headers: AuthService.getAuthHeaders(),
      }),
      fetch("/api/settings/ai_model_1", {
        headers: AuthService.getAuthHeaders(),
      }),
      fetch("/api/settings/ai_model_2", {
        headers: AuthService.getAuthHeaders(),
      }),
      fetch("/api/settings/ai_model_3", {
        headers: AuthService.getAuthHeaders(),
      }),
      fetch("/api/settings/ai_multi_model_enabled", {
        headers: AuthService.getAuthHeaders(),
      }),
      fetch("/api/settings/ai_multi_model_strategy", {
        headers: AuthService.getAuthHeaders(),
      }),
      fetch("/api/settings/ai_classification_prompt_template", {
        headers: AuthService.getAuthHeaders(),
      }),
    ]);

    // Process responses
    if (settings[0].ok) {
      const baseUrl = await settings[0].json();
      aiSettings.value.baseUrl = baseUrl.value;
      // Determine provider from base URL
      if (baseUrl.value.includes("openrouter")) {
        aiSettings.value.provider = "openrouter";
      } else if (baseUrl.value === "https://api.openai.com/v1") {
        aiSettings.value.provider = "openai";
      } else {
        aiSettings.value.provider = "custom";
      }
    }

    if (settings[1].ok) {
      const apiKey = await settings[1].json();
      aiSettings.value.apiKey = apiKey.value;
    }

    // Legacy single model support
    if (settings[2].ok) {
      const model = await settings[2].json();
      aiSettings.value.model = model.value;
    }

    if (settings[3].ok) {
      const enabled = await settings[3].json();
      aiSettings.value.enabled = enabled.value === "true";
    }

    // New multi-model settings
    if (settings[4].ok) {
      const model1 = await settings[4].json();
      aiSettings.value.model1 = model1.value || aiSettings.value.model;
    } else {
      // Fallback to legacy model
      aiSettings.value.model1 = aiSettings.value.model;
    }

    if (settings[5].ok) {
      const model2 = await settings[5].json();
      aiSettings.value.model2 = model2.value;
    }

    if (settings[6].ok) {
      const model3 = await settings[6].json();
      aiSettings.value.model3 = model3.value;
    }

    if (settings[7].ok) {
      const multiEnabled = await settings[7].json();
      aiSettings.value.multiModelEnabled = multiEnabled.value === "true";
    }

    if (settings[8].ok) {
      const strategy = await settings[8].json();
      aiSettings.value.multiModelStrategy = strategy.value || "weighted_vote";
    }

    if (settings[9].ok) {
      const template = await settings[9].json();
      aiSettings.value.promptTemplate = template.value || "";
    }

    // If no custom template exists, load the default template
    if (!aiSettings.value.promptTemplate) {
      try {
        const defaultResponse = await fetch("/api/ai/default-prompt-template", {
          headers: AuthService.getAuthHeaders(),
        });
        if (defaultResponse.ok) {
          const defaultData = await defaultResponse.json();
          aiSettings.value.promptTemplate = defaultData.template;
        }
      } catch (error) {
        console.error("Error loading default template:", error);
      }
    }

    // Ensure current models appear in dropdown even if models list isn't loaded yet
    const currentModels = [
      aiSettings.value.model1,
      aiSettings.value.model2,
      aiSettings.value.model3,
    ].filter((m) => m && m.trim());

    currentModels.forEach((modelValue) => {
      if (!availableModels.value.find((m) => m.id === modelValue)) {
        availableModels.value.push({
          id: modelValue,
          name: `${modelValue} (current)`,
          owned_by: "unknown",
        });
      }
    });
  } catch (error) {
    console.error("Error loading AI settings:", error);
    updateMessageAI.value = "Error loading AI settings";
  }
}

async function loadClassificationOptions() {
  try {
    const [cuisineResponse, mealResponse] = await Promise.all([
      fetch("/api/settings/cuisine_types", {
        headers: AuthService.getAuthHeaders(),
      }),
      fetch("/api/settings/meal_times", {
        headers: AuthService.getAuthHeaders(),
      }),
    ]);

    if (cuisineResponse.ok) {
      const cuisineData = await cuisineResponse.json();
      classificationOptions.value.cuisineTypes = JSON.parse(
        cuisineData.value || "[]"
      );
    }

    if (mealResponse.ok) {
      const mealData = await mealResponse.json();
      classificationOptions.value.mealTimes = JSON.parse(
        mealData.value || "[]"
      );
    }
  } catch (error) {
    console.error("Error loading classification options:", error);
    updateMessageAI.value = "Error loading classification options";
  }
}

function updateAIProviderURL() {
  switch (aiSettings.value.provider) {
    case "openai":
      aiSettings.value.baseUrl = "https://api.openai.com/v1";
      break;
    case "openrouter":
      aiSettings.value.baseUrl = "https://openrouter.ai/api/v1";
      break;
    case "custom":
      // Keep current URL or let user set it
      break;
  }
}

async function saveAISettings() {
  updatingAI.value = true;
  updateMessageAI.value = "";

  try {
    const settingsToSave = [
      { key: "ai_provider_base_url", value: aiSettings.value.baseUrl },
      { key: "ai_provider_api_key", value: aiSettings.value.apiKey },
      {
        key: "ai_model",
        value: aiSettings.value.model1 || aiSettings.value.model,
      }, // Legacy support
      { key: "ai_model_1", value: aiSettings.value.model1 },
      { key: "ai_model_2", value: aiSettings.value.model2 || "" },
      { key: "ai_model_3", value: aiSettings.value.model3 || "" },
      {
        key: "ai_multi_model_enabled",
        value: aiSettings.value.multiModelEnabled.toString(),
      },
      {
        key: "ai_multi_model_strategy",
        value: aiSettings.value.multiModelStrategy,
      },
      {
        key: "ai_classification_enabled",
        value: aiSettings.value.enabled.toString(),
      },
    ];

    const savePromises = settingsToSave.map((setting) =>
      fetch(`/api/settings/${setting.key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...AuthService.getAuthHeaders(),
        },
        body: JSON.stringify({ value: setting.value }),
      })
    );

    const responses = await Promise.all(savePromises);

    // Check if all requests succeeded
    const failed = responses.filter((response) => !response.ok);
    if (failed.length > 0) {
      throw new Error(`Failed to save ${failed.length} settings`);
    }

    updateMessageAI.value = "AI settings saved successfully";
    setTimeout(() => {
      updateMessageAI.value = "";
    }, 3000);
  } catch (error) {
    console.error("Error saving AI settings:", error);
    updateMessageAI.value = `Error saving AI settings: ${error.message}`;
  } finally {
    updatingAI.value = false;
  }
}

async function saveClassificationOptions() {
  updatingClassifications.value = true;
  updateMessageAI.value = "";

  try {
    const responses = await Promise.all([
      fetch("/api/settings/cuisine_types", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...AuthService.getAuthHeaders(),
        },
        body: JSON.stringify({
          value: JSON.stringify(classificationOptions.value.cuisineTypes),
        }),
      }),
      fetch("/api/settings/meal_times", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...AuthService.getAuthHeaders(),
        },
        body: JSON.stringify({
          value: JSON.stringify(classificationOptions.value.mealTimes),
        }),
      }),
    ]);

    const failed = responses.filter((response) => !response.ok);
    if (failed.length > 0) {
      throw new Error("Failed to save classification options");
    }

    updateMessageAI.value = "Classification options saved successfully";
    setTimeout(() => {
      updateMessageAI.value = "";
    }, 3000);
  } catch (error) {
    console.error("Error saving classification options:", error);
    updateMessageAI.value = `Error saving classification options: ${error.message}`;
  } finally {
    updatingClassifications.value = false;
  }
}

function addCuisineType() {
  const newType = newCuisineType.value.trim();
  if (newType && !classificationOptions.value.cuisineTypes.includes(newType)) {
    classificationOptions.value.cuisineTypes.push(newType);
    newCuisineType.value = "";
  }
}

function removeCuisineType(index) {
  classificationOptions.value.cuisineTypes.splice(index, 1);
}

function addMealTime() {
  const newTime = newMealTime.value.trim();
  if (newTime && !classificationOptions.value.mealTimes.includes(newTime)) {
    classificationOptions.value.mealTimes.push(newTime);
    newMealTime.value = "";
  }
}

function removeMealTime(index) {
  classificationOptions.value.mealTimes.splice(index, 1);
}

async function refreshModels() {
  if (!aiSettings.value.apiKey) {
    updateMessageAI.value = "API key required to fetch models";
    return;
  }

  loadingModels.value = true;
  updateMessageAI.value = "";

  try {
    const response = await fetch("/api/ai/models", {
      method: "GET",
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch available models");
    }

    const data = await response.json();
    const fetchedModels = data.models || [];

    // Merge fetched models with current model (if it exists and isn't already in the list)
    const currentModel = aiSettings.value.model;
    const modelsMap = new Map();

    // Add fetched models
    fetchedModels.forEach((model) => {
      modelsMap.set(model.id, model);
    });

    // Ensure current model is included (update if found in fetched list, or keep existing entry)
    if (currentModel) {
      if (modelsMap.has(currentModel)) {
        // Update the current model entry with fetched info
        const fetchedModel = modelsMap.get(currentModel);
        modelsMap.set(currentModel, {
          ...fetchedModel,
          name: fetchedModel.name || fetchedModel.id,
        });
      } else {
        // Keep current model in list even if not found in API response
        modelsMap.set(currentModel, {
          id: currentModel,
          name: `${currentModel} (current)`,
          owned_by: "unknown",
        });
      }
    }

    availableModels.value = Array.from(modelsMap.values()).sort((a, b) => {
      // Sort current model first, then alphabetically
      if (a.id === currentModel) return -1;
      if (b.id === currentModel) return 1;
      return a.id.localeCompare(b.id);
    });

    if (fetchedModels.length === 0) {
      updateMessageAI.value = "No models available or API key may be invalid";
    } else {
      updateMessageAI.value = `Found ${fetchedModels.length} available models`;
      setTimeout(() => {
        updateMessageAI.value = "";
      }, 3000);
    }
  } catch (error) {
    console.error("Error fetching models:", error);
    updateMessageAI.value = `Error fetching models: ${error.message}`;
  } finally {
    loadingModels.value = false;
  }
}

async function processUnclassifiedExpenses() {
  if (!aiSettings.value.enabled || !aiSettings.value.apiKey) {
    updateMessageAI.value = "AI classification not properly configured";
    return;
  }

  processingExpenses.value = true;
  processingProgress.value = { current: 0, total: 0, success: 0, failed: 0 };
  updateMessageAI.value = "";

  try {
    const response = await fetch("/api/expenses/classify-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...AuthService.getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error("Failed to start batch classification");
    }

    const result = await response.json();
    processingProgress.value = {
      current: result.processed || 0,
      total: result.total || 0,
      success: result.success || 0,
      failed: result.failed || 0,
    };

    updateMessageAI.value = `Processed ${result.success} expenses successfully, ${result.failed} failed`;
    setTimeout(() => {
      updateMessageAI.value = "";
    }, 5000);
  } catch (error) {
    console.error("Error processing unclassified expenses:", error);
    updateMessageAI.value = `Error processing expenses: ${error.message}`;
  } finally {
    processingExpenses.value = false;
  }
}

async function resetPromptTemplate() {
  try {
    // Fetch the default template from the AI service
    const response = await fetch("/api/ai/default-prompt-template", {
      method: "GET",
      headers: AuthService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch default template");
    }

    const data = await response.json();
    aiSettings.value.promptTemplate = data.template;
    updateMessageAI.value = "Prompt template reset to default";
    setTimeout(() => {
      updateMessageAI.value = "";
    }, 3000);
  } catch (error) {
    console.error("Error resetting prompt template:", error);
    updateMessageAI.value = `Error resetting template: ${error.message}`;
  }
}

function previewPromptTemplate() {
  if (!aiSettings.value.promptTemplate) {
    updateMessageAI.value = "No template to preview";
    return;
  }

  // Create sample data for preview
  const sampleExpenseDetails = `EXPENSE DETAILS:
- Amount: $15.99
- Place: Mario's Italian Restaurant at 123 Main St, Downtown
- Time: 7:30 PM on Friday`;

  const sampleCuisineTypes =
    classificationOptions.value.cuisineTypes.length > 0
      ? classificationOptions.value.cuisineTypes.join(", ")
      : "Italian, Chinese, American, Mexican, Other";

  const sampleMealTimes =
    classificationOptions.value.mealTimes.length > 0
      ? classificationOptions.value.mealTimes.join(", ")
      : "breakfast, lunch, dinner, snack, drink";

  const sampleResponseFormat = `Respond with JSON in this exact format:
{
  "cuisine_type": "exact_match_from_available_list",
  "meal_time": "exact_match_from_available_list",
  "confidence_cuisine": 0.85,
  "confidence_meal": 0.90
}`;

  // Replace placeholders with sample data
  previewText.value = aiSettings.value.promptTemplate
    .replace(/\{\{EXPENSE_DETAILS\}\}/g, sampleExpenseDetails)
    .replace(/\{\{CUISINE_TYPES\}\}/g, sampleCuisineTypes)
    .replace(/\{\{MEAL_TIMES\}\}/g, sampleMealTimes)
    .replace(/\{\{RESPONSE_FORMAT\}\}/g, sampleResponseFormat);

  showPromptPreview.value = true;
}

async function savePromptTemplate() {
  updatingAI.value = true;
  updateMessageAI.value = "";

  try {
    const response = await fetch(
      "/api/settings/ai_classification_prompt_template",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...AuthService.getAuthHeaders(),
        },
        body: JSON.stringify({ value: aiSettings.value.promptTemplate }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to save prompt template");
    }

    updateMessageAI.value = "Prompt template saved successfully";
    setTimeout(() => {
      updateMessageAI.value = "";
    }, 3000);
  } catch (error) {
    console.error("Error saving prompt template:", error);
    updateMessageAI.value = `Error saving prompt template: ${error.message}`;
  } finally {
    updatingAI.value = false;
  }
}

onMounted(async () => {
  await Promise.all([
    loadTimezones(),
    loadCurrentTimezone(),
    loadDebugLoggingSetting(),
    loadAISettings(),
    loadClassificationOptions(),
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

/* Subsection styling within accordions */
.setting-subsection {
  margin-bottom: 2rem;
}

.setting-subsection:last-child {
  margin-bottom: 0;
}

.setting-subsection h3 {
  color: #e0e0e0;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid #444;
  padding-bottom: 0.5rem;
}

.subsection-description {
  color: #b0b0b0;
  margin-bottom: 1rem;
  line-height: 1.5;
  font-size: 0.875rem;
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
.debug-toggle,
.ai-toggle {
  margin-top: 1rem;
  margin-bottom: 1rem;
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
.mt-4 {
  margin-top: 1rem;
}

.p-3 {
  padding: 0.75rem;
}

.bg-blue-50 {
  background: #1a2332;
  border: 1px solid #2563eb;
  border-radius: 6px;
}

.bg-orange-50 {
  background: #2d1f1a;
  border: 1px solid #f59e0b;
  border-radius: 6px;
}

.text-blue-800 {
  color: #60a5fa;
}

.text-blue-800 strong {
  color: #93c5fd;
  font-weight: 600;
}

.text-orange-800 {
  color: #fbbf24;
}

.text-orange-800 strong {
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

/* AI Settings Specific Styles */
.ai-settings {
  display: flex;
  flex-direction: column;
}

/* AI Tabs Styles */
.ai-tabs {
  display: flex;
  border-bottom: 2px solid #444;
  margin-bottom: 2rem;
  gap: 0;
}

.ai-tab {
  padding: 0.75rem 1.5rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-bottom: none;
  color: #b0b0b0;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  border-radius: 6px 6px 0 0;
  margin-right: -1px;
}

.ai-tab:hover {
  background: #333;
  color: #e0e0e0;
}

.ai-tab.active {
  background: #1e1e1e;
  color: #e0e0e0;
  border-color: #007bff;
  border-bottom: 2px solid #1e1e1e;
  margin-bottom: -2px;
  position: relative;
  z-index: 1;
}

.ai-tab-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.setting-group {
  background: #1e1e1e;
  padding: 1.5rem;
  border-radius: 6px;
  border: 1px solid #333;
}

.setting-group h3 {
  color: #e0e0e0;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #e0e0e0;
  margin-bottom: 0.5rem;
}

.form-group input[type="url"],
.form-group input[type="password"],
.form-group input[type="text"]:not(.add-item input),
.form-group select {
  display: block;
  width: 100%;
  max-width: 400px;
  padding: 0.75rem;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.875rem;
  transition: border-color 0.2s ease;
}

/* Ensure checkbox inputs are not affected */
.form-group input[type="checkbox"] {
  display: none; /* This should remain hidden for the toggle switch */
}

.form-group input[type="url"]:focus,
.form-group input[type="password"]:focus,
.form-group input[type="text"]:not(.add-item input):focus,
.form-group select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.form-group input[type="url"]:disabled,
.form-group input[type="password"]:disabled,
.form-group input[type="text"]:not(.add-item input):disabled,
.form-group select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group input[type="password"] {
  font-family: monospace;
}

.model-selector {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.model-selector select {
  flex: 1;
}

.refresh-models-btn {
  padding: 0.5rem;
  min-width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.classification-lists {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.list-group label {
  color: #e0e0e0;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  min-height: 2.5rem;
  padding: 0.5rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  background: #007bff;
  color: white;
  border-radius: 4px;
  font-size: 0.75rem;
  gap: 0.25rem;
}

.tag-remove {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  padding: 0;
  margin-left: 0.25rem;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.tag-remove:hover {
  background: rgba(255, 255, 255, 0.2);
}

.add-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.add-item input {
  flex: 1;
  max-width: none;
  margin: 0;
  padding: 0.5rem;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 0.875rem;
}

.add-item input:focus {
  outline: none;
  border-color: #007bff;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.bulk-process-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #444;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: #b0b0b0;
}

.text-sm {
  font-size: 0.875rem;
  color: #b0b0b0;
  line-height: 1.4;
}

.text-gray-400 {
  color: #9ca3af;
}

/* Multi-Model UI Styles */

.models-config {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
}

.model-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.model-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #e0e0e0;
  margin-bottom: 0.25rem;
}

.model-selector {
  width: 100%;
}

.model-selector select {
  width: 100%;
  padding: 0.75rem;
  background: #1e1e1e;
  border: 1px solid #555;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.875rem;
  transition: border-color 0.2s ease;
}

.model-selector select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.model-selector select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.model-selector select option:disabled {
  color: #666;
  background: #1a1a1a;
}

.refresh-models-row {
  display: flex;
  justify-content: flex-start;
  padding-top: 0.5rem;
  border-top: 1px solid #444;
}

.refresh-models-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
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

  .classification-lists {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .setting-group {
    padding: 1rem;
  }

  .add-item {
    flex-direction: column;
    align-items: stretch;
  }

  .add-item input {
    margin-bottom: 0.5rem;
  }
}

/* Prompt Template Styles */
.prompt-template-textarea {
  width: 100%;
  min-height: 400px;
  padding: 1rem;
  background: #1e1e1e;
  border: 1px solid #555;
  border-radius: 6px;
  color: #e0e0e0;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 0.875rem;
  line-height: 1.4;
  resize: vertical;
  transition: border-color 0.2s ease;
}

.prompt-template-textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.prompt-template-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.prompt-template-controls {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.placeholder-help {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
}

.placeholder-list {
  margin: 0.5rem 0 0 1.5rem;
  color: #b0b0b0;
}

.placeholder-list li {
  margin-bottom: 0.5rem;
}

.placeholder-list code {
  background: #1a1a1a;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  color: #60a5fa;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 0.8rem;
}

/* Preview Modal Styles */
.prompt-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
}

.preview-content {
  position: relative;
  width: 90%;
  max-width: 800px;
  max-height: 80%;
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #444;
}

.preview-header h4 {
  color: #e0e0e0;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: #e0e0e0;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.close-btn:hover {
  background: #444;
}

.preview-body {
  flex: 1;
  padding: 1rem;
  overflow: auto;
}

.preview-body pre {
  margin: 0;
  color: #e0e0e0;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 0.875rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
