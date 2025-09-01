import OpenAI from 'openai'
import { logger } from '../logger.js'
import { databaseService } from '../database.js'

class AIClassificationService {
  constructor() {
    this.openai = null
    this.isConfigured = false
    this.rateLimitDelay = 1000 // 1 second between requests
    this.lastRequestTime = 0
  }

  async initialize() {
    try {
      // Get AI settings from database
      const settings = await this.getAISettings()
      
      if (!settings.ai_provider_api_key || !settings.ai_classification_enabled) {
        logger.log('info', '🤖 AI classification not configured or disabled')
        this.isConfigured = false
        return false
      }

      // Initialize OpenAI client with configurable settings
      this.openai = new OpenAI({
        apiKey: settings.ai_provider_api_key,
        baseURL: settings.ai_provider_base_url,
      })

      this.model = settings.ai_model
      this.isConfigured = true
      
      logger.log('info', `🤖 AI classification service initialized with ${settings.ai_model}`)
      return true
      
    } catch (error) {
      logger.log('error', '❌ Failed to initialize AI classification service:', { error: error.message })
      this.isConfigured = false
      return false
    }
  }

  async getAISettings() {
    try {
      const allSettings = databaseService.getAllSettings()
      
      return {
        ai_provider_base_url: allSettings.ai_provider_base_url || 'https://api.openai.com/v1',
        ai_provider_api_key: allSettings.ai_provider_api_key || '',
        ai_model: allSettings.ai_model || 'gpt-3.5-turbo',
        ai_classification_enabled: allSettings.ai_classification_enabled === 'true',
        cuisine_types: JSON.parse(allSettings.cuisine_types || '[]'),
        meal_times: JSON.parse(allSettings.meal_times || '[]')
      }
    } catch (error) {
      logger.log('error', 'Error fetching AI settings:', { error: error.message })
      throw error
    }
  }

  async getAvailableModels() {
    try {
      // Get current settings to use the configured API
      const settings = await this.getAISettings()
      
      if (!settings.ai_provider_api_key) {
        logger.log('warn', '🤖 No API key configured, cannot fetch available models')
        return []
      }

      // Create temporary OpenAI client to fetch models
      const tempClient = new OpenAI({
        apiKey: settings.ai_provider_api_key,
        baseURL: settings.ai_provider_base_url,
      })

      const response = await tempClient.models.list()
      
      // Filter and sort models, prioritizing chat completion models
      const models = response.data
        .filter(model => {
          // Filter out non-chat models and fine-tuned models for simplicity
          return !model.id.includes(':') && 
                 (model.id.includes('gpt') || 
                  model.id.includes('claude') || 
                  model.id.includes('llama') ||
                  model.id.includes('mistral'))
        })
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(model => ({
          id: model.id,
          name: model.id,
          owned_by: model.owned_by
        }))

      logger.log('info', `🤖 Retrieved ${models.length} available models from API`)
      return models

    } catch (error) {
      logger.log('error', '❌ Failed to fetch available models:', { error: error.message })
      // Return default models if API call fails
      return [
        { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo', owned_by: 'openai' },
        { id: 'gpt-4', name: 'gpt-4', owned_by: 'openai' },
        { id: 'gpt-4-turbo', name: 'gpt-4-turbo', owned_by: 'openai' },
        { id: 'gpt-4o', name: 'gpt-4o', owned_by: 'openai' },
        { id: 'gpt-4o-mini', name: 'gpt-4o-mini', owned_by: 'openai' }
      ]
    }
  }

  async rateLimit() {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    this.lastRequestTime = Date.now()
  }


  async classifyExpense(expense, placeData = null) {
    if (!this.isConfigured) {
      logger.debug('🤖 AI classification not configured, skipping expense', { expenseId: expense.id })
      return null
    }

    try {
      await this.rateLimit()
      
      const settings = await this.getAISettings()
      const prompt = this.buildClassificationPrompt(expense, placeData, settings)
      
      logger.debug('🤖 Classifying expense with AI', { 
        expenseId: expense.id, 
        placeName: expense.place_name,
        timestamp: expense.timestamp
      })

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at classifying food and beverage expenses. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 150
      })

      // Log usage information
      if (response.usage) {
        this.lastTokenCount = response.usage.total_tokens // Store for batch tracking
        logger.log('info', `🤖 AI API Usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} tokens`)
      }

      const classification = this.parseClassificationResponse(response.choices[0].message.content)
      
      if (classification) {
        logger.debug('🤖 AI classification successful', {
          expenseId: expense.id,
          cuisine: classification.cuisine_type,
          mealTime: classification.meal_time,
          confidenceCuisine: classification.confidence_cuisine,
          confidenceMeal: classification.confidence_meal
        })
      }

      return classification

    } catch (error) {
      logger.log('error', '❌ AI classification failed for expense', { 
        expenseId: expense.id, 
        error: error.message 
      })
      return null
    }
  }

  buildClassificationPrompt(expense, placeData, settings) {
    const date = new Date(expense.timestamp)
    const timeString = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
    
    // Build place information
    let placeInfo = expense.place_name || 'Unknown place'
    if (expense.place_address) {
      placeInfo += ` at ${expense.place_address}`
    }
    if (placeData && placeData.types) {
      placeInfo += ` (Types: ${placeData.types.join(', ')})`
    }

    return `You are classifying a food/dining expense. Use contextual clues to make accurate classifications.

EXPENSE DETAILS:
- Amount: $${expense.amount}
- Place: ${placeInfo}
- Time: ${timeString} on ${dayOfWeek}

CLASSIFICATION RULES:
1. MEAL TIME: Consider both time and amount:
   - High amounts ($30+) are rarely snacks, usually meals
   - 11:30 AM - 2:30 PM = lunch
   - 5:00 PM - 9:00 PM = dinner
   - 7:00 AM - 11:00 AM = breakfast
   - Other times = snack (unless amount suggests otherwise)

2. CUISINE TYPE: Base on restaurant name, location context, and place types

STRICT CONSTRAINTS:
- You MUST ONLY use these exact meal times: ${settings.meal_times.join(', ')}
- You MUST ONLY use these exact cuisine types: ${settings.cuisine_types.join(', ')}
- DO NOT create new categories or use variations
- If uncertain about cuisine, use "Other"

Respond with JSON in this exact format:
{
  "cuisine_type": "exact_match_from_available_list",
  "meal_time": "exact_match_from_available_list",
  "confidence_cuisine": 0.85,
  "confidence_meal": 0.90
}

CRITICAL: Only use the exact strings from the available lists above.`
  }

  parseClassificationResponse(content) {
    try {
      // Clean up the response (remove any markdown formatting)
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
      const parsed = JSON.parse(cleanContent)
      
      // Validate required fields
      if (!parsed.cuisine_type || !parsed.meal_time) {
        throw new Error('Missing required fields in AI response')
      }
      
      // Validate confidence scores
      const confidenceCuisine = parseFloat(parsed.confidence_cuisine) || 0.5
      const confidenceMeal = parseFloat(parsed.confidence_meal) || 0.5
      
      return {
        cuisine_type: parsed.cuisine_type,
        meal_time: parsed.meal_time,
        confidence_cuisine: Math.max(0, Math.min(1, confidenceCuisine)),
        confidence_meal: Math.max(0, Math.min(1, confidenceMeal))
      }
      
    } catch (error) {
      logger.log('error', '❌ Failed to parse AI classification response:', { 
        content, 
        error: error.message 
      })
      return null
    }
  }

  async saveClassification(expenseId, classification) {
    try {
      const stmt = databaseService.db.prepare(`
        INSERT OR REPLACE INTO expense_classifications 
        (expense_id, cuisine_type, meal_time, ai_classified_at, ai_confidence_cuisine, ai_confidence_meal, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)
      `)
      
      const result = stmt.run(
        expenseId,
        classification.cuisine_type,
        classification.meal_time,
        classification.confidence_cuisine,
        classification.confidence_meal
      )
      
      logger.debug('💾 Saved AI classification', { 
        expenseId, 
        classificationId: result.lastInsertRowid 
      })
      
      return result.lastInsertRowid
      
    } catch (error) {
      logger.log('error', '❌ Failed to save classification:', { 
        expenseId, 
        error: error.message 
      })
      throw error
    }
  }

  async classifyAndSaveExpense(expense) {
    try {
      // Get place data if available
      let placeData = null
      if (expense.place_id) {
        placeData = await databaseService.getPlace(expense.place_id)
      }
      
      // Classify the expense
      const classification = await this.classifyExpense(expense, placeData)
      
      if (classification) {
        // Save the classification
        await this.saveClassification(expense.id, classification)
        return classification
      }
      
      return null
      
    } catch (error) {
      logger.log('error', '❌ Failed to classify and save expense:', { 
        expenseId: expense.id, 
        error: error.message 
      })
      return null
    }
  }

  async batchClassifyExpenses(expenses, onProgress = null) {
    if (!this.isConfigured) {
      logger.log('warn', '🤖 AI classification not configured for batch processing')
      return { success: 0, failed: 0 }
    }

    let success = 0
    let failed = 0
    let totalTokens = 0
    
    logger.log('info', `🤖 Starting batch classification of ${expenses.length} expenses`)
    
    for (let i = 0; i < expenses.length; i++) {
      const expense = expenses[i]
      
      try {
        // Store the last token count for accumulation
        this.lastTokenCount = 0
        
        const classification = await this.classifyAndSaveExpense(expense)
        if (classification) {
          success++
          totalTokens += this.lastTokenCount || 0
        } else {
          failed++
        }
        
        // Report progress
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: expenses.length,
            success,
            failed
          })
        }
        
      } catch (error) {
        failed++
        logger.log('error', '❌ Failed to classify expense in batch:', { 
          expenseId: expense.id, 
          error: error.message 
        })
      }
    }
    
    logger.log('info', `🤖 Batch classification complete: ${success} success, ${failed} failed, total tokens used: ${totalTokens}`)
    return { success, failed }
  }

  async getUnclassifiedExpenses(limit = 50) {
    try {
      const stmt = databaseService.db.prepare(`
        SELECT e.* FROM expenses e
        LEFT JOIN expense_classifications ec ON e.id = ec.expense_id
        WHERE ec.expense_id IS NULL
        ORDER BY e.timestamp DESC
        LIMIT ?
      `)
      
      return stmt.all(limit)
      
    } catch (error) {
      logger.log('error', '❌ Failed to get unclassified expenses:', { error: error.message })
      throw error
    }
  }
}

export const aiClassificationService = new AIClassificationService()