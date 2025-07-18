<template>
  <div id="app">
    <LoginForm 
      v-if="!isAuthenticated" 
      @authenticated="handleAuthenticated" 
    />
    <div v-else>
      <header>
        <h1>Expense Tracker</h1>
      </header>
      <main>
        <ExpenseForm @expense-added="handleExpenseAdded" />
        <ExpenseSummary :refresh-trigger="refreshTrigger" />
        <ExpenseList :refresh-trigger="refreshTrigger" @expense-deleted="handleExpenseDeleted" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LoginForm from './components/LoginForm.vue'
import ExpenseForm from './components/ExpenseForm.vue'
import ExpenseSummary from './components/ExpenseSummary.vue'
import ExpenseList from './components/ExpenseList.vue'
import { AuthService } from './services/auth'

const refreshTrigger = ref(0)
const isAuthenticated = ref(false)

onMounted(() => {
  isAuthenticated.value = AuthService.isAuthenticated()
})

function handleExpenseAdded() {
  refreshTrigger.value++
}

function handleExpenseDeleted() {
  refreshTrigger.value++
}

function handleAuthenticated() {
  isAuthenticated.value = true
}

</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  background-color: #f5f5f5;
  color: #333;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background-color: #007bff;
  color: white;
  padding: 20px;
  text-align: center;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

header h1 {
  font-size: 2rem;
  font-weight: bold;
  margin: 0;
}


main {
  flex: 1;
  padding: 20px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

/* Desktop styles */
@media (min-width: 768px) {
  main {
    padding: 40px 20px;
    max-width: 600px;
  }
  
  header h1 {
    font-size: 2.5rem;
  }
}
</style>