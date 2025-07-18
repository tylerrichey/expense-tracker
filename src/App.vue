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
        <AccordionMenu 
          :menu-items="menuItems" 
          default-active="home"
          @expense-added="handleExpenseAdded"
          @expense-deleted="handleExpenseDeleted"
        />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, markRaw, computed } from 'vue'
import LoginForm from './components/LoginForm.vue'
import AccordionMenu from './components/AccordionMenu.vue'
import Home from './components/Home.vue'
import Reports from './components/Reports.vue'
import { AuthService } from './services/auth'

const refreshTrigger = ref(0)
const isAuthenticated = ref(false)

const menuItems = computed(() => [
  {
    id: 'home',
    title: 'Home',
    component: markRaw(Home),
    props: {
      refreshTrigger: refreshTrigger.value
    }
  },
  {
    id: 'reports',
    title: 'Reports',
    component: markRaw(Reports)
  }
])

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