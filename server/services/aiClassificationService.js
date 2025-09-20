import OpenAI from "openai";
import { logger } from "../logger.js";
import { databaseService } from "../database.js";
import { getCurrentTimezone } from "../timezone-utils.js";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const writeFile = promisify(fs.writeFile);
const appendFile = promisify(fs.appendFile);
const access = promisify(fs.access);
const mkdir = promisify(fs.mkdir);

class AIClassificationService {
  constructor() {
    this.clients = {}; // Multiple OpenAI clients for different models
    this.isConfigured = false;
    this.rateLimitDelay = 1000; // 1 second between requests
    this.lastRequestTimes = {}; // Per-client rate limiting
    this.logDirectory = path.join(process.cwd(), "logs", "ai-classification");
    this.pendingLogs = new Map(); // For batching logs to prevent race conditions
    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    try {
      await access(this.logDirectory);
    } catch {
      try {
        await mkdir(this.logDirectory, { recursive: true });
      } catch (error) {
        logger.log(
          "error",
          "❌ Failed to create AI classification log directory:",
          {
            error: error.message,
          }
        );
      }
    }
  }

  // Store log entries for batched writing to prevent race conditions
  addToPendingLogs(requestId, modelName, data) {
    if (!this.pendingLogs.has(requestId)) {
      this.pendingLogs.set(requestId, {
        timestamp: new Date().toISOString(),
        expenseId: data.expenseId,
        prompt: data.prompt,
        models: {},
        errors: [],
      });
    }

    const logEntry = this.pendingLogs.get(requestId);

    if (data.response) {
      logEntry.models[modelName] = {
        content: data.response.choices?.[0]?.message?.content || null,
        model: data.response.model,
        usage: data.response.usage,
      };
    }

    if (data.error) {
      logEntry.errors.push({ model: modelName, error: data.error.message });
    }
  }

  async flushPendingLogs(requestId) {
    const logEntry = this.pendingLogs.get(requestId);
    if (!logEntry) return;

    try {
      const logFileName = `ai-classification-${
        new Date().toISOString().split("T")[0]
      }.jsonl`;
      const logFilePath = path.join(this.logDirectory, logFileName);

      const logLine = JSON.stringify(logEntry) + "\n";

      // Use file locking approach with retry logic
      const maxRetries = 3;
      let retries = 0;

      while (retries < maxRetries) {
        try {
          await appendFile(logFilePath, logLine, "utf8");
          break;
        } catch (error) {
          if (error.code === "EBUSY" || error.code === "ENOENT") {
            retries++;
            await new Promise((resolve) => setTimeout(resolve, 100 * retries));
          } else {
            throw error;
          }
        }
      }

      this.pendingLogs.delete(requestId);
    } catch (logError) {
      logger.log("error", "❌ Failed to write AI classification log:", {
        error: logError.message,
      });
    }
  }

  async initialize() {
    try {
      // Get AI settings from database
      const settings = await this.getAISettings();

      if (
        !settings.ai_provider_api_key ||
        !settings.ai_classification_enabled
      ) {
        logger.log("info", "🤖 AI classification not configured or disabled");
        this.isConfigured = false;
        return false;
      }

      // Clear existing clients
      this.clients = {};
      this.lastRequestTimes = {};

      // Initialize clients for each configured model
      const models = this.getConfiguredModels(settings);

      for (const modelConfig of models) {
        if (modelConfig.model) {
          this.clients[modelConfig.name] = new OpenAI({
            apiKey: settings.ai_provider_api_key,
            baseURL: settings.ai_provider_base_url,
          });
          this.lastRequestTimes[modelConfig.name] = 0;
        }
      }

      this.settings = settings;
      this.isConfigured = Object.keys(this.clients).length > 0;

      if (this.isConfigured) {
        const modelNames = Object.keys(this.clients).join(", ");
        logger.log(
          "info",
          `🤖 AI classification service initialized with models: ${modelNames}`
        );
      }

      return this.isConfigured;
    } catch (error) {
      logger.log(
        "error",
        "❌ Failed to initialize AI classification service:",
        { error: error.message }
      );
      this.isConfigured = false;
      return false;
    }
  }

  getConfiguredModels(settings) {
    const models = [];

    // Single model mode (backwards compatibility)
    if (!settings.ai_multi_model_enabled) {
      if (settings.ai_model) {
        models.push({ name: "model_1", model: settings.ai_model });
      }
      return models;
    }

    // Multi-model mode
    if (settings.ai_model_1)
      models.push({ name: "model_1", model: settings.ai_model_1 });
    if (settings.ai_model_2)
      models.push({ name: "model_2", model: settings.ai_model_2 });
    if (settings.ai_model_3)
      models.push({ name: "model_3", model: settings.ai_model_3 });

    return models;
  }

  async getAISettings() {
    try {
      const allSettings = databaseService.getAllSettings();

      return {
        ai_provider_base_url:
          allSettings.ai_provider_base_url || "https://api.openai.com/v1",
        ai_provider_api_key: allSettings.ai_provider_api_key || "",
        ai_model: allSettings.ai_model || "gpt-3.5-turbo", // Legacy single model
        ai_model_1:
          allSettings.ai_model_1 || allSettings.ai_model || "gpt-3.5-turbo",
        ai_model_2: allSettings.ai_model_2 || "",
        ai_model_3: allSettings.ai_model_3 || "",
        ai_multi_model_enabled: allSettings.ai_multi_model_enabled === "true",
        ai_multi_model_strategy:
          allSettings.ai_multi_model_strategy || "weighted_vote",
        ai_classification_enabled:
          allSettings.ai_classification_enabled === "true",
        ai_classification_prompt_template:
          allSettings.ai_classification_prompt_template || "",
        cuisine_types: JSON.parse(allSettings.cuisine_types || "[]"),
        meal_times: JSON.parse(allSettings.meal_times || "[]"),
      };
    } catch (error) {
      logger.log("error", "Error fetching AI settings:", {
        error: error.message,
      });
      throw error;
    }
  }

  async getAvailableModels() {
    try {
      // Get current settings to use the configured API
      const settings = await this.getAISettings();

      if (!settings.ai_provider_api_key) {
        logger.log(
          "warn",
          "🤖 No API key configured, cannot fetch available models"
        );
        return [];
      }

      // Create temporary OpenAI client to fetch models
      const tempClient = new OpenAI({
        apiKey: settings.ai_provider_api_key,
        baseURL: settings.ai_provider_base_url,
      });

      const response = await tempClient.models.list();

      // Filter and sort models, prioritizing chat completion models
      const models = response.data
        // .filter((model) => {
        //   // Filter out non-chat models and fine-tuned models for simplicity
        //   return (
        //     !model.id.includes(":") &&
        //     (model.id.includes("gpt") ||
        //       model.id.includes("claude") ||
        //       model.id.includes("llama") ||
        //       model.id.includes("mistral"))
        //   );
        // })
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((model) => ({
          id: model.id,
          name: model.id,
          owned_by: model.owned_by,
        }));

      logger.log(
        "info",
        `🤖 Retrieved ${models.length} available models from API`
      );
      return models;
    } catch (error) {
      logger.log("error", "❌ Failed to fetch available models:", {
        error: error.message,
      });
      // Return default models if API call fails
      return [
        { id: "gpt-3.5-turbo", name: "gpt-3.5-turbo", owned_by: "openai" },
        { id: "gpt-4", name: "gpt-4", owned_by: "openai" },
        { id: "gpt-4-turbo", name: "gpt-4-turbo", owned_by: "openai" },
        { id: "gpt-4o", name: "gpt-4o", owned_by: "openai" },
        { id: "gpt-4o-mini", name: "gpt-4o-mini", owned_by: "openai" },
      ];
    }
  }

  async rateLimit(clientName) {
    const now = Date.now();
    const lastRequestTime = this.lastRequestTimes[clientName] || 0;
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTimes[clientName] = Date.now();
  }

  async classifyExpense(expense, placeData = null) {
    if (!this.isConfigured) {
      logger.debug("🤖 AI classification not configured, skipping expense", {
        expenseId: expense.id,
      });
      return null;
    }

    const settings = await this.getAISettings();

    // Use multi-model classification if enabled and multiple models configured
    if (
      settings.ai_multi_model_enabled &&
      Object.keys(this.clients).length > 1
    ) {
      return await this.classifyExpenseMultiModel(expense, placeData, settings);
    } else {
      return await this.classifyExpenseSingleModel(
        expense,
        placeData,
        settings
      );
    }
  }

  getDefaultPromptTemplate() {
    return `You are classifying a food/dining expense. Use contextual clues to make accurate classifications.

{{EXPENSE_DETAILS}}

CLASSIFICATION RULES:
1. MEAL TIME: Consider both time and amount:
   - 7:00 AM - 11:00 AM = breakfast
   - 11:30 AM - 2:30 PM = lunch
   - 5:00 PM - 9:00 PM = dinner
   - Grocery stores are almost always for dinner
   - If a place is a bar, prioritze drink unless amount is greater than $60
   - If a place is a bar, and the amount is greater than $60, it is probably for a meal
   - If a place is a bakery, or candy shop, etc, it is almost always for snacks
   - Snacks are probably always cheaper than drinks, which is cheaper than meals
   - If a place is related to golf, assume it's drinks

2. CUISINE TYPE: Base on restaurant name, location context, and place types

3. CONTEXT FROM OTHER EXPENSES: If other expenses are listed for today, consider:
   - Avoid duplicate meal classifications (e.g., don't classify as "dinner" if dinner already exists)
   - If breakfast/lunch/dinner already classified, this expense is likely snack/drink
   - Multiple drinks or snacks per day are normal
   - Pattern recognition: coffee shops in morning = breakfast, afternoon = snack

STRICT CONSTRAINTS:
- You MUST ONLY use these exact meal times: {{MEAL_TIMES}}
- You MUST ONLY use these exact cuisine types: {{CUISINE_TYPES}}
- DO NOT create new categories or use variations
- If uncertain about cuisine, use "Other"
- If uncertain about meal time, use "snack" or "drink" based on place type

{{RESPONSE_FORMAT}}

CRITICAL: Only use the exact strings from the available lists above.`;
  }

  async getOtherExpensesForDay(expense) {
    try {
      // Get the user's timezone setting
      const timezone = getCurrentTimezone(databaseService.db);

      // Get the date in user's timezone
      const expenseDate = new Date(expense.timestamp);
      
      // Get start and end of day in the user's timezone
      const dateStr = expenseDate.toLocaleDateString("en-CA", { timeZone: timezone });
      
      // Create proper timezone-aware dates by using the timezone in the date construction
      // This ensures we get the actual start/end of day in the user's timezone
      const year = parseInt(dateStr.split('-')[0]);
      const month = parseInt(dateStr.split('-')[1]) - 1; // months are 0-indexed
      const day = parseInt(dateStr.split('-')[2]);
      
      // Create dates that represent start/end of day in the user's timezone
      const startOfDay = new Date();
      startOfDay.setFullYear(year, month, day);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date();
      endOfDay.setFullYear(year, month, day);
      endOfDay.setHours(23, 59, 59, 999);

      // Convert to ISO strings for database query (database stores ISO strings, not ticks)
      const startTimestamp = startOfDay.toISOString();
      const endTimestamp = endOfDay.toISOString();

      logger.debug("🤖 Getting other expenses for day", {
        expenseId: expense.id,
        expenseTimestamp: expense.timestamp,
        timezone,
        dateStr,
        startTimestamp,
        endTimestamp
      });

      const stmt = databaseService.db.prepare(`
        SELECT e.id, e.amount, e.place_name, e.place_address, e.timestamp,
               ec.cuisine_type, ec.meal_time, ec.ai_confidence_cuisine, ec.ai_confidence_meal
        FROM expenses e
        LEFT JOIN expense_classifications ec ON e.id = ec.expense_id
        WHERE e.timestamp >= ? AND e.timestamp <= ? AND e.id != ?
        ORDER BY e.timestamp ASC
      `);

      const results = stmt.all(startTimestamp, endTimestamp, expense.id);
      
      logger.debug("🤖 Found other expenses for day", {
        expenseId: expense.id,
        otherExpensesCount: results.length,
        otherExpenseIds: results.map(r => r.id)
      });

      return results;
    } catch (error) {
      logger.log("error", "❌ Failed to get other expenses for day:", {
        expenseId: expense.id,
        error: error.message,
      });
      return [];
    }
  }

  buildClassificationPrompt(expense, placeData, settings, otherExpenses = []) {
    // Get the prompt template from settings or use default
    const template =
      settings.ai_classification_prompt_template ||
      this.getDefaultPromptTemplate();

    // Get the user's timezone setting
    const timezone = getCurrentTimezone(databaseService.db);

    // Build dynamic content using local timezone
    const date = new Date(expense.timestamp);
    const timeString = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    });
    const dayOfWeek = date.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: timezone,
    });

    // Build place information
    let placeInfo = expense.place_name || "Unknown place";
    if (expense.place_address) {
      placeInfo += ` at ${expense.place_address}`;
    }
    if (placeData && placeData.types) {
      placeInfo += ` (Types: ${placeData.types.join(", ")})`;
    }
    if (placeData && placeData.generative_summary) {
      placeInfo += `\n  Place Summary: ${placeData.generative_summary}`;
    }
    if (placeData && placeData.review_summary) {
      placeInfo += `\n  Review Summary: ${placeData.review_summary}`;
    }

    // Build other expenses information
    let otherExpensesInfo = "";
    if (otherExpenses && otherExpenses.length > 0) {
      otherExpensesInfo =
        "\n\nOTHER EXPENSES TODAY:\n" +
        otherExpenses
          .map((exp) => {
            const expTime = new Date(exp.timestamp).toLocaleTimeString(
              "en-US",
              {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: timezone,
              }
            );
            const classification = exp.meal_time
              ? ` (Classified - Meal: ${exp.meal_time}${
                  exp.cuisine_type ? `, Cuisine: ${exp.cuisine_type}` : ""
                })`
              : "";
            return `- $${exp.amount} at ${
              exp.place_name || "Unknown"
            } at ${expTime}${classification}`;
          })
          .join("\n");
    }

    const expenseDetails = `EXPENSE DETAILS:
- Amount: $${expense.amount}
- Place: ${placeInfo}
- Time: ${timeString} on ${dayOfWeek}${otherExpensesInfo}`;

    const responseFormat = `Respond with JSON in this exact format:
{
  "cuisine_type": "exact_match_from_available_list",
  "meal_time": "exact_match_from_available_list",
  "confidence_cuisine": 0.85,
  "confidence_meal": 0.90
}`;

    // Replace placeholders in template
    return template
      .replace(/{{EXPENSE_DETAILS}}/g, expenseDetails)
      .replace(/{{MEAL_TIMES}}/g, settings.meal_times.join(", "))
      .replace(/{{CUISINE_TYPES}}/g, settings.cuisine_types.join(", "))
      .replace(/{{RESPONSE_FORMAT}}/g, responseFormat);
  }

  parseClassificationResponse(content) {
    try {
      // Check for empty or null response
      if (!content || content.trim() === "") {
        logger.log("error", "❌ AI returned empty response:", {
          fullResponse: content,
          responseLength: content ? content.length : 0,
        });
        return null;
      }

      // Clean up the response (remove any markdown formatting)
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();

      // Check if cleaned content is empty
      if (!cleanContent) {
        logger.log("error", "❌ AI response empty after cleaning:", {
          originalResponse: content,
          cleanedResponse: cleanContent,
        });
        return null;
      }

      const parsed = JSON.parse(cleanContent);

      // Validate required fields
      if (!parsed.cuisine_type || !parsed.meal_time) {
        throw new Error("Missing required fields in AI response");
      }

      // Validate confidence scores
      const confidenceCuisine = parseFloat(parsed.confidence_cuisine) || 0.5;
      const confidenceMeal = parseFloat(parsed.confidence_meal) || 0.5;

      return {
        cuisine_type: parsed.cuisine_type,
        meal_time: parsed.meal_time,
        confidence_cuisine: Math.max(0, Math.min(1, confidenceCuisine)),
        confidence_meal: Math.max(0, Math.min(1, confidenceMeal)),
      };
    } catch (error) {
      logger.log("error", "❌ Failed to parse AI classification response:", {
        fullResponse: content,
        responseLength: content ? content.length : 0,
        error: error.message,
      });
      return null;
    }
  }

  async classifyExpenseSingleModel(expense, placeData, settings) {
    const requestId = `${expense.id}-${Date.now()}`;
    const clientName = Object.keys(this.clients)[0];
    const client = this.clients[clientName];
    const modelName = this.getConfiguredModels(settings)[0]?.model;

    try {
      await this.rateLimit(clientName);

      // Get other expenses for the same day
      const otherExpenses = await this.getOtherExpensesForDay(expense);

      const prompt = this.buildClassificationPrompt(
        expense,
        placeData,
        settings,
        otherExpenses
      );

      logger.debug("🤖 Classifying expense with single AI model", {
        expenseId: expense.id,
        model: modelName,
        placeName: expense.place_name,
        timestamp: expense.timestamp,
      });

      const response = await client.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: "system",
            content:
              "You are an expert at classifying food and beverage expenses. Respond only with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
      });

      // Add to pending logs
      this.addToPendingLogs(requestId, clientName, {
        expenseId: expense.id,
        prompt,
        response,
      });

      // Flush logs immediately for single model
      await this.flushPendingLogs(requestId);

      // Log usage information
      if (response.usage) {
        this.lastTokenCount = response.usage.total_tokens;
        logger.log(
          "info",
          `🤖 AI API Usage (${modelName}): ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} tokens`
        );
      }

      const classification = this.parseClassificationResponse(
        response.choices[0].message.content
      );

      if (classification) {
        classification.model_name = modelName;
        logger.debug("🤖 AI classification successful", {
          expenseId: expense.id,
          model: modelName,
          cuisine: classification.cuisine_type,
          mealTime: classification.meal_time,
          confidenceCuisine: classification.confidence_cuisine,
          confidenceMeal: classification.confidence_meal,
        });
      }

      return classification;
    } catch (error) {
      // Add error to pending logs
      const otherExpensesForError = await this.getOtherExpensesForDay(expense);
      this.addToPendingLogs(requestId, clientName, {
        expenseId: expense.id,
        prompt: this.buildClassificationPrompt(
          expense,
          placeData,
          settings,
          otherExpensesForError
        ),
        error,
      });
      await this.flushPendingLogs(requestId);

      logger.log("error", "❌ AI classification failed for expense", {
        expenseId: expense.id,
        model: modelName,
        error: error.message,
      });
      return null;
    }
  }

  async classifyExpenseMultiModel(expense, placeData, settings) {
    const requestId = `${expense.id}-${Date.now()}`;
    const models = this.getConfiguredModels(settings);

    logger.debug("🤖 Classifying expense with multiple AI models", {
      expenseId: expense.id,
      models: models.map((m) => m.model),
      placeName: expense.place_name,
      timestamp: expense.timestamp,
    });

    // Get other expenses for the same day (shared for all models)
    const otherExpenses = await this.getOtherExpensesForDay(expense);

    // Run all models in parallel
    const modelPromises = models.map(async (modelConfig) => {
      const client = this.clients[modelConfig.name];
      if (!client) return null;

      try {
        await this.rateLimit(modelConfig.name);

        const prompt = this.buildClassificationPrompt(
          expense,
          placeData,
          settings,
          otherExpenses
        );

        const response = await client.chat.completions.create({
          model: modelConfig.model,
          messages: [
            {
              role: "system",
              content:
                "You are an expert at classifying food and beverage expenses. Respond only with valid JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.1,
          max_tokens: 300,
        });

        // Add to pending logs
        this.addToPendingLogs(requestId, modelConfig.name, {
          expenseId: expense.id,
          prompt,
          response,
        });

        const classification = this.parseClassificationResponse(
          response.choices[0].message.content
        );

        if (classification) {
          classification.model_name = modelConfig.model;
          classification.client_name = modelConfig.name;

          // Log usage for this model
          if (response.usage) {
            logger.log(
              "info",
              `🤖 AI API Usage (${modelConfig.model}): ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} tokens`
            );
          }
        }

        return classification;
      } catch (error) {
        // Add error to pending logs
        this.addToPendingLogs(requestId, modelConfig.name, {
          expenseId: expense.id,
          prompt: this.buildClassificationPrompt(
            expense,
            placeData,
            settings,
            otherExpenses
          ),
          error,
        });

        logger.log(
          "error",
          `❌ AI classification failed for expense (${modelConfig.model})`,
          {
            expenseId: expense.id,
            model: modelConfig.model,
            error: error.message,
          }
        );
        return null;
      }
    });

    // Wait for all models to complete
    const results = await Promise.all(modelPromises);

    // Flush all logs at once to prevent race conditions
    await this.flushPendingLogs(requestId);

    // Filter out failed classifications
    const validResults = results.filter((result) => result !== null);

    if (validResults.length === 0) {
      logger.log("error", "❌ All AI models failed to classify expense", {
        expenseId: expense.id,
      });
      return null;
    }

    // Combine results using the specified strategy
    const finalClassification = this.combineClassificationResults(
      validResults,
      settings.ai_multi_model_strategy
    );

    if (finalClassification) {
      logger.debug("🤖 Multi-model AI classification successful", {
        expenseId: expense.id,
        modelsUsed: validResults.length,
        finalCuisine: finalClassification.cuisine_type,
        finalMealTime: finalClassification.meal_time,
        decisionMethod: finalClassification.final_decision_method,
      });
    }

    return finalClassification;
  }

  combineClassificationResults(results, strategy = "weighted_vote") {
    if (results.length === 1) {
      const result = results[0];
      return {
        cuisine_type: result.cuisine_type,
        meal_time: result.meal_time,
        confidence_cuisine: result.confidence_cuisine,
        confidence_meal: result.confidence_meal,
        final_decision_method: "single_model",
        models_used: 1,
        model_results: results,
      };
    }

    switch (strategy) {
      case "weighted_vote":
        return this.combineUsingWeightedVote(results);
      case "highest_confidence":
        return this.combineUsingHighestConfidence(results);
      default:
        return this.combineUsingWeightedVote(results);
    }
  }

  combineUsingWeightedVote(results) {
    // Count votes for each cuisine type and meal time, weighted by confidence
    const cuisineVotes = {};
    const mealTimeVotes = {};

    results.forEach((result) => {
      // Cuisine voting
      if (result.cuisine_type) {
        if (!cuisineVotes[result.cuisine_type]) {
          cuisineVotes[result.cuisine_type] = 0;
        }
        cuisineVotes[result.cuisine_type] += result.confidence_cuisine || 0.5;
      }

      // Meal time voting
      if (result.meal_time) {
        if (!mealTimeVotes[result.meal_time]) {
          mealTimeVotes[result.meal_time] = 0;
        }
        mealTimeVotes[result.meal_time] += result.confidence_meal || 0.5;
      }
    });

    // Find winners
    const winningCuisine = Object.keys(cuisineVotes).reduce((a, b) =>
      cuisineVotes[a] > cuisineVotes[b] ? a : b
    );

    const winningMealTime = Object.keys(mealTimeVotes).reduce((a, b) =>
      mealTimeVotes[a] > mealTimeVotes[b] ? a : b
    );

    // Calculate combined confidence as average of contributing models
    const cuisineContributors = results.filter(
      (r) => r.cuisine_type === winningCuisine
    );
    const mealTimeContributors = results.filter(
      (r) => r.meal_time === winningMealTime
    );

    const avgCuisineConfidence =
      cuisineContributors.reduce(
        (sum, r) => sum + (r.confidence_cuisine || 0.5),
        0
      ) / cuisineContributors.length;

    const avgMealTimeConfidence =
      mealTimeContributors.reduce(
        (sum, r) => sum + (r.confidence_meal || 0.5),
        0
      ) / mealTimeContributors.length;

    return {
      cuisine_type: winningCuisine,
      meal_time: winningMealTime,
      confidence_cuisine: avgCuisineConfidence,
      confidence_meal: avgMealTimeConfidence,
      final_decision_method: "weighted_vote",
      models_used: results.length,
      model_results: results,
    };
  }

  combineUsingHighestConfidence(results) {
    // Find the result with the highest combined confidence
    const bestResult = results.reduce((best, current) => {
      const currentScore =
        (current.confidence_cuisine || 0.5) + (current.confidence_meal || 0.5);
      const bestScore =
        (best.confidence_cuisine || 0.5) + (best.confidence_meal || 0.5);
      return currentScore > bestScore ? current : best;
    });

    return {
      cuisine_type: bestResult.cuisine_type,
      meal_time: bestResult.meal_time,
      confidence_cuisine: bestResult.confidence_cuisine,
      confidence_meal: bestResult.confidence_meal,
      final_decision_method: "highest_confidence",
      models_used: results.length,
      model_results: results,
    };
  }

  async saveClassification(expenseId, classification) {
    try {
      // Handle both single model and multi-model classifications
      const isMultiModel =
        classification.model_results && classification.model_results.length > 1;

      const stmt = databaseService.db.prepare(`
        INSERT OR REPLACE INTO expense_classifications 
        (expense_id, cuisine_type, meal_time, ai_classified_at, ai_confidence_cuisine, ai_confidence_meal, 
         model_1_cuisine, model_1_meal_time, model_1_confidence_cuisine, model_1_confidence_meal, model_1_name,
         model_2_cuisine, model_2_meal_time, model_2_confidence_cuisine, model_2_confidence_meal, model_2_name,
         model_3_cuisine, model_3_meal_time, model_3_confidence_cuisine, model_3_confidence_meal, model_3_name,
         final_decision_method, models_used, combined_confidence_cuisine, combined_confidence_meal, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      // Extract individual model results
      const modelResults = classification.model_results || [classification];
      const model1 = modelResults[0] || {};
      const model2 = modelResults[1] || {};
      const model3 = modelResults[2] || {};

      const result = stmt.run(
        expenseId,
        classification.cuisine_type,
        classification.meal_time,
        classification.confidence_cuisine,
        classification.confidence_meal,
        // Model 1 data
        model1.cuisine_type || null,
        model1.meal_time || null,
        model1.confidence_cuisine || null,
        model1.confidence_meal || null,
        model1.model_name || null,
        // Model 2 data
        model2.cuisine_type || null,
        model2.meal_time || null,
        model2.confidence_cuisine || null,
        model2.confidence_meal || null,
        model2.model_name || null,
        // Model 3 data
        model3.cuisine_type || null,
        model3.meal_time || null,
        model3.confidence_cuisine || null,
        model3.confidence_meal || null,
        model3.model_name || null,
        // Meta data
        classification.final_decision_method || "single_model",
        classification.models_used || 1,
        classification.confidence_cuisine,
        classification.confidence_meal
      );

      logger.debug("💾 Saved AI classification", {
        expenseId,
        classificationId: result.lastInsertRowid,
        isMultiModel,
        modelsUsed: classification.models_used || 1,
      });

      return result.lastInsertRowid;
    } catch (error) {
      logger.log("error", "❌ Failed to save classification:", {
        expenseId,
        error: error.message,
      });
      throw error;
    }
  }

  async classifyAndSaveExpense(expense) {
    try {
      // Get place data if available
      let placeData = null;
      if (expense.place_id) {
        placeData = await databaseService.getPlace(expense.place_id);
      }

      // Classify the expense
      const classification = await this.classifyExpense(expense, placeData);

      if (classification) {
        // Save the classification
        await this.saveClassification(expense.id, classification);
        return classification;
      }

      return null;
    } catch (error) {
      logger.log("error", "❌ Failed to classify and save expense:", {
        expenseId: expense.id,
        error: error.message,
      });
      return null;
    }
  }

  async batchClassifyExpenses(expenses, onProgress = null) {
    if (!this.isConfigured) {
      logger.log(
        "warn",
        "🤖 AI classification not configured for batch processing"
      );
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;
    let totalTokens = 0;

    logger.log(
      "info",
      `🤖 Starting batch classification of ${expenses.length} expenses`
    );

    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i];

      try {
        // Store the last token count for accumulation
        this.lastTokenCount = 0;

        const classification = await this.classifyAndSaveExpense(expense);
        if (classification) {
          success++;
          totalTokens += this.lastTokenCount || 0;
        } else {
          failed++;
        }

        // Report progress
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: expenses.length,
            success,
            failed,
          });
        }
      } catch (error) {
        failed++;
        logger.log("error", "❌ Failed to classify expense in batch:", {
          expenseId: expense.id,
          error: error.message,
        });
      }
    }

    logger.log(
      "info",
      `🤖 Batch classification complete: ${success} success, ${failed} failed, total tokens used: ${totalTokens}`
    );
    return { success, failed };
  }

  async getUnclassifiedExpenses(limit = 50) {
    try {
      const stmt = databaseService.db.prepare(`
        SELECT e.* FROM expenses e
        LEFT JOIN expense_classifications ec ON e.id = ec.expense_id
        WHERE ec.expense_id IS NULL
        ORDER BY e.timestamp DESC
        LIMIT ?
      `);

      return stmt.all(limit);
    } catch (error) {
      logger.log("error", "❌ Failed to get unclassified expenses:", {
        error: error.message,
      });
      throw error;
    }
  }

  async reprocessExpenseClassification(expenseId) {
    try {
      if (!this.isConfigured) {
        throw new Error("AI classification not configured");
      }

      // Get the expense
      const expense = await databaseService.getExpenseById(expenseId);
      if (!expense) {
        throw new Error("Expense not found");
      }

      logger.log("info", "🔄 Reprocessing AI classification for expense", {
        expenseId,
        placeName: expense.place_name,
        amount: expense.amount,
      });

      // Delete existing classification
      const deleteStmt = databaseService.db.prepare(`
        DELETE FROM expense_classifications WHERE expense_id = ?
      `);
      deleteStmt.run(expenseId);

      // Reclassify the expense
      const classification = await this.classifyAndSaveExpense(expense);

      if (classification) {
        logger.log("info", "✅ Successfully reprocessed AI classification", {
          expenseId,
          cuisine: classification.cuisine_type,
          mealTime: classification.meal_time,
          confidenceCuisine: classification.confidence_cuisine,
          confidenceMeal: classification.confidence_meal,
        });
        return classification;
      } else {
        logger.log("warn", "⚠️ Failed to reclassify expense", { expenseId });
        return null;
      }
    } catch (error) {
      logger.log("error", "❌ Failed to reprocess expense classification:", {
        expenseId,
        error: error.message,
      });
      throw error;
    }
  }
}

export const aiClassificationService = new AIClassificationService();
