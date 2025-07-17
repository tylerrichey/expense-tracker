<template>
  <div class="login-container">
    <div class="login-card">
      <h2>Authentication Required</h2>
      <p>Please enter the password to access the expense tracker.</p>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="password">Password:</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="Enter password"
            required
            :disabled="isLoading"
            class="password-input"
          />
        </div>
        
        <button 
          type="submit" 
          :disabled="isLoading || !password.trim()"
          class="login-button"
        >
          {{ isLoading ? 'Authenticating...' : 'Login' }}
        </button>
        
        <div v-if="error" class="error-message">
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
  background-color: #f5f5f5;
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 8px;
  padding: 40px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.login-card h2 {
  color: #007bff;
  margin-bottom: 10px;
  font-size: 1.5rem;
}

.login-card p {
  color: #666;
  margin-bottom: 30px;
  line-height: 1.5;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #333;
  font-weight: 500;
}

.password-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.password-input:focus {
  outline: none;
  border-color: #007bff;
}

.password-input:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
}

.login-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
}

.login-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.login-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.error-message {
  color: #dc3545;
  font-size: 14px;
  margin-top: 10px;
  padding: 10px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}
</style>