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
          Set your timezone to ensure budget periods roll over at the correct local time.
        </p>
        
        <div class="timezone-selector">
          <label for="timezone-select">
            Current Timezone: {{ currentTimezone || 'UTC' }}
          </label>
          
          <select 
            id="timezone-select"
            v-model="selectedTimezone"
            @change="updateTimezone"
            :disabled="updating"
          >
            <option v-for="tz in timezones" :key="tz.value" :value="tz.value">
              {{ tz.label }}
            </option>
          </select>
          
          <div v-if="updating" class="update-message text-gray-500">
            Updating timezone...
          </div>
          
          <div v-if="updateMessage" class="update-message" :class="updateMessageClass">
            {{ updateMessage }}
          </div>
        </div>

        <div class="mt-4 p-3 bg-blue-50">
          <p class="text-blue-800">
            <strong>Note:</strong> Changing your timezone will affect when budget periods start and end. 
            Existing budget periods will continue using their original timezone until they complete.
          </p>
        </div>
      </div>

      <!-- Future Settings Sections -->
      <div class="settings-section">
        <h2>Other Settings</h2>
        <p>
          Additional settings will be available here in future updates.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { AuthService } from '../services/auth'

const currentTimezone = ref('UTC')
const selectedTimezone = ref('UTC')
const timezones = ref([])
const updating = ref(false)
const updateMessage = ref('')

const updateMessageClass = computed(() => {
  if (updateMessage.value.includes('success')) {
    return 'text-green-600'
  } else if (updateMessage.value.includes('error') || updateMessage.value.includes('failed')) {
    return 'text-red-600'
  }
  return 'text-gray-600'
})

async function loadTimezones() {
  try {
    const response = await fetch('/api/timezones', {
      method: 'GET',
      headers: AuthService.getAuthHeaders()
    })

    if (!response.ok) {
      throw new Error('Failed to load timezones')
    }

    timezones.value = await response.json()
  } catch (error) {
    console.error('Error loading timezones:', error)
    updateMessage.value = 'Error loading available timezones'
  }
}

async function loadCurrentTimezone() {
  try {
    const response = await fetch('/api/settings/timezone', {
      method: 'GET',
      headers: AuthService.getAuthHeaders()
    })

    if (response.ok) {
      const setting = await response.json()
      currentTimezone.value = setting.value
      selectedTimezone.value = setting.value
    } else if (response.status === 404) {
      // Setting doesn't exist yet, use default
      currentTimezone.value = 'UTC'
      selectedTimezone.value = 'UTC'
    } else {
      throw new Error('Failed to load timezone setting')
    }
  } catch (error) {
    console.error('Error loading current timezone:', error)
    updateMessage.value = 'Error loading current timezone setting'
  }
}

async function updateTimezone() {
  if (selectedTimezone.value === currentTimezone.value) {
    return // No change
  }

  updating.value = true
  updateMessage.value = ''

  try {
    const response = await fetch('/api/settings/timezone', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...AuthService.getAuthHeaders()
      },
      body: JSON.stringify({ value: selectedTimezone.value })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to update timezone')
    }

    const updatedSetting = await response.json()
    currentTimezone.value = updatedSetting.value
    updateMessage.value = 'Timezone updated successfully'

    // Clear success message after 3 seconds
    setTimeout(() => {
      updateMessage.value = ''
    }, 3000)

  } catch (error) {
    console.error('Error updating timezone:', error)
    updateMessage.value = `Error updating timezone: ${error.message}`
    
    // Revert selection on error
    selectedTimezone.value = currentTimezone.value
  } finally {
    updating.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadTimezones(),
    loadCurrentTimezone()
  ])
})
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

.settings-section .text-blue-800 {
  color: #60a5fa;
}

.settings-section .text-blue-800 strong {
  color: #93c5fd;
  font-weight: 600;
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
}
</style>