<template>
  <div class="expense-form">
    <h2>Add Expense</h2>
    <form @submit.prevent="submitExpense">
      <div class="form-group">
        <label for="amount">Amount ($):</label>
        <input
          id="amount"
          v-model.number="amount"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="0.00"
        />
      </div>
      <div class="form-group">
        <label for="location">Location:</label>
        <div v-if="showManualInput" class="location-container">
          <input
            id="location"
            v-model="manualPlaceName"
            type="text"
            placeholder="Enter location name"
            class="location-input"
            required
          />
          <button
            type="button"
            @click="refreshPlaces"
            :disabled="loadingPlaces"
            class="refresh-button"
            title="Try to load nearby places"
          >
            {{ loadingPlaces ? '⟳' : '🔄' }}
          </button>
          <button
            type="button"
            @click="toggleInputMode"
            class="toggle-button"
            title="Switch to dropdown"
          >
            📍
          </button>
        </div>
        <div v-else class="location-container">
          <select
            id="location"
            v-model="selectedPlace"
            :disabled="loadingPlaces"
            class="location-select"
          >
            <option
              v-for="place in places"
              :key="place.id"
              :value="place"
            >
              {{ place.name }}
            </option>
          </select>
          <button
            type="button"
            @click="refreshPlaces"
            :disabled="loadingPlaces || !currentLocation"
            class="refresh-button"
            title="Refresh nearby places"
          >
            {{ loadingPlaces ? '⟳' : '🔄' }}
          </button>
          <button
            type="button"
            @click="toggleInputMode"
            class="toggle-button"
            title="Switch to manual entry"
          >
            ✏️
          </button>
        </div>
        <div v-if="selectedPlace && typeof selectedPlace === 'object'" class="selected-place-info">
          📍 {{ selectedPlace.address }}
        </div>
        <div v-if="showManualInput && manualPlaceName" class="selected-place-info">
          📍 {{ manualPlaceName }}
        </div>
      </div>
      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Adding...' : 'Add Expense' }}
      </button>
    </form>
    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { databaseService } from '../services/database'
import { getCurrentLocation } from '../services/geolocation'
import { Place } from '../types/expense'

const amount = ref<number>(0)
const isSubmitting = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')
const places = ref<Place[]>([])
const selectedPlace = ref<Place | string>("")
const loadingPlaces = ref(false)
const currentLocation = ref<{latitude: number, longitude: number} | null>(null)
const showManualInput = ref(false)
const manualPlaceName = ref("")

const emit = defineEmits<{
  expenseAdded: []
}>()

async function loadCurrentLocationAndPlaces() {
  try {
    const location = await getCurrentLocation()
    if (location) {
      currentLocation.value = location
      await loadNearbyPlaces(location.latitude, location.longitude)
    } else {
      // No location available, show manual input
      showManualInput.value = true
      selectedPlace.value = ""
      
      // Show message if location is not available due to HTTPS
      if (!window.isSecureContext && window.location.protocol !== 'https:' && 
          !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
        showMessage('Location services require HTTPS in production', 'error')
      }
    }
  } catch (error) {
    console.error('Error getting location:', error)
    showMessage('Could not access location services', 'error')
    // Show manual input on error
    showManualInput.value = true
    selectedPlace.value = ""
  }
}

async function loadNearbyPlaces(latitude: number, longitude: number) {
  loadingPlaces.value = true
  try {
    places.value = await databaseService.getNearbyPlaces(latitude, longitude)
    
    if (places.value.length > 0) {
      // Default to first place in the list
      selectedPlace.value = places.value[0]
      showManualInput.value = false
    } else {
      // No places found, show manual input
      showManualInput.value = true
      selectedPlace.value = ""
    }
  } catch (error) {
    console.error('Error loading places:', error)
    showMessage('Could not load nearby places', 'error')
    // Show manual input on error
    showManualInput.value = true
    selectedPlace.value = ""
  } finally {
    loadingPlaces.value = false
  }
}

async function refreshPlaces() {
  if (currentLocation.value) {
    await loadNearbyPlaces(currentLocation.value.latitude, currentLocation.value.longitude)
  } else {
    await loadCurrentLocationAndPlaces()
  }
}

function toggleInputMode() {
  showManualInput.value = !showManualInput.value
  
  if (showManualInput.value) {
    // Switching to manual input
    selectedPlace.value = ""
    manualPlaceName.value = ""
  } else {
    // Switching to dropdown
    if (places.value.length > 0) {
      selectedPlace.value = places.value[0]
    } else {
      selectedPlace.value = ""
    }
    manualPlaceName.value = ""
  }
}

async function submitExpense() {
  if (amount.value <= 0) {
    showMessage('Please enter a valid amount', 'error')
    return
  }

  // Validate manual location entry
  if (showManualInput.value && (!manualPlaceName.value || manualPlaceName.value.trim() === '')) {
    showMessage('Please enter a location name', 'error')
    return
  }

  isSubmitting.value = true
  message.value = ''

  try {
    const location = currentLocation.value || await getCurrentLocation()
    
    const expenseData = {
      amount: amount.value,
      latitude: location?.latitude,
      longitude: location?.longitude,
      place_id: typeof selectedPlace.value === 'object' ? selectedPlace.value.id : undefined,
      place_name: showManualInput.value ? manualPlaceName.value.trim() : 
                  (typeof selectedPlace.value === 'object' ? selectedPlace.value.name : undefined),
      place_address: typeof selectedPlace.value === 'object' ? selectedPlace.value.address : undefined,
      timestamp: new Date()
    }
    
    if (import.meta.env.DEV) {
      console.log('Saving expense with data:', JSON.stringify(expenseData, null, 2))
    }
    await databaseService.addExpense(expenseData)

    showMessage('Expense added successfully!', 'success')
    amount.value = 0
    
    // Reset location fields based on current mode
    if (showManualInput.value) {
      manualPlaceName.value = ""
    } else if (places.value.length > 0) {
      // Reset to first place in dropdown
      selectedPlace.value = places.value[0]
    } else {
      selectedPlace.value = ""
    }
    
    emit('expenseAdded')
  } catch (error) {
    console.error('Error adding expense:', error)
    showMessage('Failed to add expense', 'error')
  } finally {
    isSubmitting.value = false
  }
}

function showMessage(text: string, type: 'success' | 'error') {
  message.value = text
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}

onMounted(() => {
  loadCurrentLocationAndPlaces()
})
</script>

<style scoped>
.expense-form {
  width: 100%;
  max-width: 400px;
  margin: 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background-color: #f9f9f9;
}

h2 {
  text-align: center;
  margin-bottom: 20px;
  color: #333;
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 15px;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #555;
  font-size: 14px;
}

input[type="number"], .location-select, .location-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 16px;
  box-sizing: border-box;
  -webkit-appearance: none;
  -moz-appearance: textfield;
  background-color: white;
}

input[type="number"]:focus, .location-select:focus, .location-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.location-input:invalid {
  border-color: #dc3545;
}

.location-input:invalid:focus {
  border-color: #dc3545;
  box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.25);
}

.location-container {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.location-select {
  flex: 1;
  height: 44px;
}

.location-select:disabled {
  background-color: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}

.refresh-button {
  background: transparent;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #555;
  padding: 12px;
  cursor: pointer;
  font-size: 16px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  touch-action: manipulation;
  flex-shrink: 0;
}

.refresh-button:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #007bff;
  color: #007bff;
}

.refresh-button:disabled {
  background: transparent;
  border-color: #dee2e6;
  color: #6c757d;
  cursor: not-allowed;
}

.refresh-button:active {
  transform: scale(0.95);
}

.toggle-button {
  background: transparent;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #555;
  padding: 12px;
  cursor: pointer;
  font-size: 16px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  touch-action: manipulation;
  flex-shrink: 0;
}

.toggle-button:hover {
  background: #f8f9fa;
  border-color: #007bff;
  color: #007bff;
}

.toggle-button:active {
  transform: scale(0.95);
}

.selected-place-info {
  margin-top: 8px;
  padding: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  font-size: 14px;
  color: #495057;
  border-left: 3px solid #007bff;
}

button {
  width: 100%;
  padding: 14px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  touch-action: manipulation;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

button:active {
  transform: translateY(1px);
}

.message {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

/* Mobile optimizations */
@media (max-width: 480px) {
  .expense-form {
    padding: 12px;
    border-radius: 6px;
  }
  
  h2 {
    font-size: 1.3rem;
    margin-bottom: 15px;
  }
  
  input[type="number"] {
    padding: 14px;
    font-size: 16px;
  }
  
  button {
    padding: 16px;
    font-size: 16px;
  }
}
</style>