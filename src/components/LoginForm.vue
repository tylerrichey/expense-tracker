<template>
  <div class="login-container">
    <div class="card login-card">
      <h2 class="card-title text-center">Authentication Required</h2>
      <p class="text-secondary text-center mb-xl">Please enter the password to access the expense tracker.</p>
      
      <form @submit.prevent="handleLogin" class="flex flex-col gap-lg">
        <div class="form-group">
          <label for="password" class="form-label">Password:</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="Enter password"
            required
            :disabled="isLoading"
            class="form-input"
          />
        </div>
        
        <button 
          type="submit" 
          :disabled="isLoading || !password.trim()"
          class="btn btn-primary btn-full"
        >
          {{ isLoading ? 'Authenticating...' : 'Login' }}
        </button>
        
        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AuthService } from '../services/auth'

const emit = defineEmits<{
  authenticated: []
}>()

const password = ref('')
const error = ref('')
const isLoading = ref(false)

async function handleLogin() {
  if (!password.value.trim()) return
  
  isLoading.value = true
  error.value = ''
  
  try {
    const result = await AuthService.login(password.value)
    
    if (result.success) {
      emit('authenticated')
    } else {
      error.value = result.error || 'Authentication failed'
      password.value = ''
    }
  } catch (err) {
    error.value = 'An unexpected error occurred'
    password.value = ''
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-primary);
  padding: var(--spacing-2xl);
}

.login-card {
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-lg);
}

.login-card .card-title {
  color: var(--primary-blue);
  font-size: var(--font-size-2xl);
}
</style>