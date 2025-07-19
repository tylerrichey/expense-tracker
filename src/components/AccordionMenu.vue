<template>
  <div class="accordion-menu">
    <div class="accordion-item" v-for="item in menuItems" :key="item.id">
      <button
        class="accordion-header"
        :class="{ active: activeItem === item.id }"
        @click="toggleItem(item.id)"
      >
        <span class="accordion-title">{{ item.title }}</span>
        <span class="accordion-icon" :class="{ rotated: activeItem === item.id }">▼</span>
      </button>
      <div
        class="accordion-content"
        :class="{ active: activeItem === item.id }"
        v-if="activeItem === item.id"
      >
        <component 
          :is="item.component" 
          v-bind="item.props"
          @expense-added="$emit('expense-added')"
          @expense-deleted="$emit('expense-deleted')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface MenuItem {
  id: string
  title: string
  component: any
  props?: Record<string, any>
}

interface Props {
  menuItems: MenuItem[]
  defaultActive?: string
}

const props = defineProps<Props>()
defineEmits<{
  'expense-added': []
  'expense-deleted': []
}>()

const activeItem = ref(props.defaultActive || props.menuItems[0]?.id || '')

function toggleItem(itemId: string) {
  activeItem.value = activeItem.value === itemId ? '' : itemId
}
</script>

<style scoped>
.accordion-menu {
  width: 100%;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  margin-bottom: 20px;
}

.accordion-item {
  border-bottom: 1px solid #e0e0e0;
}

.accordion-item:last-child {
  border-bottom: none;
}

.accordion-header {
  width: 100%;
  padding: 16px 20px;
  background: #f8f9fa;
  border: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 500;
  color: #333;
  transition: all 0.3s ease;
}

.accordion-header:hover {
  background: #e9ecef;
}

.accordion-header.active {
  background: #007bff;
  color: white;
}

.accordion-title {
  flex: 1;
}

.accordion-icon {
  transition: transform 0.3s ease;
  font-size: 12px;
  margin-left: 10px;
}

.accordion-icon.rotated {
  transform: rotate(180deg);
}

.accordion-content {
  padding: 20px;
  background: white;
  border-top: 1px solid #e0e0e0;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
  }
  to {
    opacity: 1;
    max-height: 1000px;
    padding-top: 20px;
    padding-bottom: 20px;
  }
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .accordion-header {
    padding: 14px 16px;
    font-size: 15px;
  }
  
  .accordion-content {
    padding: 16px;
  }
}
</style>