#!/usr/bin/env node

import { databaseService } from '../server/database.js';
import { aiClassificationService } from '../server/services/aiClassificationService.js';

async function testClassification(expenseId) {
  try {
    // Initialize AI service
    await aiClassificationService.initialize();
    
    if (!aiClassificationService.isConfigured) {
      console.error('❌ AI classification service is not configured');
      console.log('Please check your AI settings in the database');
      process.exit(1);
    }

    // Get expense by ID
    const expense = await databaseService.getExpenseById(expenseId);
    if (!expense) {
      console.error(`❌ Expense with ID ${expenseId} not found`);
      process.exit(1);
    }

    console.log('🔍 Testing AI Classification');
    console.log('================================');
    console.log(`Expense ID: ${expense.id}`);
    console.log(`Amount: $${expense.amount}`);
    console.log(`Place: ${expense.place_name || 'Unknown'}`);
    console.log(`Address: ${expense.place_address || 'N/A'}`);
    console.log(`Timestamp: ${expense.timestamp}`);
    console.log('');

    // Get place data if available
    let placeData = null;
    if (expense.place_id) {
      placeData = await databaseService.getPlace(expense.place_id);
      if (placeData) {
        console.log(`Place Types: ${placeData.types ? placeData.types.join(', ') : 'N/A'}`);
        console.log('');
      }
    }

    // Get AI settings to build prompt
    const settings = await aiClassificationService.getAISettings();
    const prompt = aiClassificationService.buildClassificationPrompt(expense, placeData, settings);

    console.log('🤖 AI PROMPT:');
    console.log('=============');
    console.log(prompt);
    console.log('');
    console.log('📡 Sending request to AI...');
    console.log('');

    // Make the AI request manually to get full response
    const response = await aiClassificationService.openai.chat.completions.create({
      model: aiClassificationService.model,
      messages: [
        {
          role: "system",
          content: "You are an expert at classifying food and beverage expenses. Respond only with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 300,
    });

    console.log('🤖 AI RESPONSE:');
    console.log('===============');
    console.log('Model:', response.model);
    console.log('Usage:', response.usage);
    console.log('');
    console.log('Raw Response:');
    console.log(JSON.stringify(response.choices[0].message.content, null, 2));
    console.log('');

    // Parse the response
    const classification = aiClassificationService.parseClassificationResponse(
      response.choices[0].message.content
    );

    if (classification) {
      console.log('✅ PARSED CLASSIFICATION:');
      console.log('=========================');
      console.log('Cuisine Type:', classification.cuisine_type);
      console.log('Meal Time:', classification.meal_time);
      console.log('Cuisine Confidence:', (classification.confidence_cuisine * 100).toFixed(1) + '%');
      console.log('Meal Confidence:', (classification.confidence_meal * 100).toFixed(1) + '%');
    } else {
      console.log('❌ Failed to parse AI response');
    }

    console.log('');
    console.log('✅ Test completed (no database changes made)');

  } catch (error) {
    console.error('❌ Error during classification test:', error.message);
    process.exit(1);
  }
}

// Get expense ID from command line arguments
const expenseId = process.argv[2];

if (!expenseId) {
  console.error('❌ Please provide an expense ID');
  console.log('Usage: node scripts/test-ai-classification.js <expense_id>');
  console.log('Example: node scripts/test-ai-classification.js 123');
  process.exit(1);
}

// Validate expense ID is a number
if (isNaN(parseInt(expenseId))) {
  console.error('❌ Expense ID must be a number');
  process.exit(1);
}

// Run the test
testClassification(parseInt(expenseId))
  .catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });