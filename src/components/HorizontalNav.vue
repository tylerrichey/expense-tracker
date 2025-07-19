<template>
  <div class="horizontal-nav">
    <div class="nav-buttons">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-button"
        :class="{ active: activeItem === item.id }"
        @click="setActiveItem(item.id)"
      >
        {{ item.title }}
      </button>
    </div>
    
    <div class="nav-content">
      <component 
        :is="activeComponent" 
        v-bind="activeProps"
        @expense-added="$emit('expense-added')"
        @expense-deleted="$emit('expense-deleted')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface NavItem {
  id: string
  title: string
  component: any
  props?: Record<string, any>
}

interface Props {
  navItems: NavItem[]
  defaultActive?: string
}

const props = defineProps<Props>()
defineEmits<{
  'expense-added': []
  'expense-deleted': []
}>()

const activeItem = ref(props.defaultActive || props.navItems[0]?.id || '')

const activeComponent = computed(() => {
  const item = props.navItems.find(item => item.id === activeItem.value)
  return item?.component
})

const activeProps = computed(() => {
  const item = props.navItems.find(item => item.id === activeItem.value)
  return item?.props || {}
})

function setActiveItem(itemId: string) {
  activeItem.value = itemId
}
</script>

<style scoped>
.horizontal-nav {
  width: 100%;
}

.nav-buttons {
  display: flex;
  justify-content: center;
  background: #2a2a2a;
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 20px;
  gap: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.nav-button {
  flex: none;
  min-width: 120px;
  padding: 12px 20px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  color: #b0b0b0;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.nav-button:hover {
  background: #3a3a3a;
  color: #e0e0e0;
}

.nav-button.active {
  background: #007bff;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
}

.nav-content {
  width: 100%;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .nav-buttons {
    padding: 3px;
    gap: 3px;
    margin-bottom: 16px;
  }
  
  .nav-button {
    padding: 10px 12px;
    font-size: 15px;
    min-width: 80px;
  }
}

/* Very small screens */
@media (max-width: 480px) {
  .nav-buttons {
    justify-content: center;
  }
  
  .nav-button {
    flex: none;
    min-width: 70px;
    padding: 10px 8px;
    font-size: 14px;
  }
}
</style>