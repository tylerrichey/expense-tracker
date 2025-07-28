<template>
  <div id="app">
    <LoginForm 
      v-if="!isAuthenticated" 
      @authenticated="handleAuthenticated" 
    />
    <div v-else>
      <main>
        <HorizontalNav 
          :nav-items="navItems" 
          default-active="home"
          @expense-added="handleExpenseAdded"
          @expense-deleted="handleExpenseDeleted"
        />
      </main>
      <AppFooter />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, markRaw, computed } from 'vue'
import LoginForm from './components/LoginForm.vue'
import HorizontalNav from './components/HorizontalNav.vue'
import Home from './components/Home.vue'
import Budget from './components/Budget.vue'
import Calendar from './components/Calendar.vue'
import Reports from './components/Reports.vue'
import SettingsPage from './components/SettingsPage.vue'
import AppFooter from './components/AppFooter.vue'
import { AuthService } from './services/auth'

const refreshTrigger = ref(0)
const isAuthenticated = ref(false)

const navItems = computed(() => [
  {
    id: 'home',
    title: 'Home',
    component: markRaw(Home),
    props: {
      refreshTrigger: refreshTrigger.value
    }
  },
  {
    id: 'budget',
    title: 'Budget',
    component: markRaw(Budget),
    props: {
      refreshTrigger: refreshTrigger.value
    }
  },
  {
    id: 'calendar',
    title: 'Calendar',
    component: markRaw(Calendar),
    props: {
      refreshTrigger: refreshTrigger.value
    }
  },
  {
    id: 'reports',
    title: 'Reports',
    component: markRaw(Reports)
  },
  {
    id: 'settings',
    title: 'Settings',
    component: markRaw(SettingsPage)
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
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
}

main {
  flex: 1;
  padding: var(--spacing-2xl) var(--spacing-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: var(--container-sm);
  margin: 0 auto;
}

/* Desktop styles */
@media (min-width: 768px) {
  main {
    padding: var(--spacing-4xl) var(--spacing-2xl);
    max-width: var(--container-lg);
  }
}
</style>