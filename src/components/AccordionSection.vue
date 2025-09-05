<template>
  <div class="accordion-section">
    <div 
      class="accordion-header"
      @click="toggle"
      :class="{ expanded: isExpanded }"
    >
      <h2 class="accordion-title">{{ title }}</h2>
      <div class="accordion-icon" :class="{ rotated: isExpanded }">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6,9 12,15 18,9"></polyline>
        </svg>
      </div>
    </div>
    
    <div 
      class="accordion-content" 
      :class="{ expanded: isExpanded }"
      ref="contentElement"
    >
      <div class="accordion-content-inner">
        <p v-if="description" class="accordion-description">{{ description }}</p>
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  title: string
  description?: string
  defaultExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  defaultExpanded: false
})

const emit = defineEmits<{
  toggle: [expanded: boolean]
}>()

const isExpanded = ref(props.defaultExpanded)
const contentElement = ref<HTMLElement>()

function toggle() {
  isExpanded.value = !isExpanded.value
  emit('toggle', isExpanded.value)
}

defineExpose({
  isExpanded,
  toggle
})
</script>

<style scoped>
.accordion-section {
  background: #2a2a2a;
  border-radius: 8px;
  border: 1px solid #444;
  overflow: hidden;
  transition: all 0.2s ease;
}

.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  background: #2a2a2a;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
  user-select: none;
}

.accordion-header:hover {
  background: #333;
}

.accordion-header.expanded {
  border-bottom-color: #444;
}

.accordion-title {
  color: #e0e0e0;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.accordion-icon {
  color: #b0b0b0;
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.accordion-icon.rotated {
  transform: rotate(180deg);
}

.accordion-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.accordion-content.expanded {
  max-height: 2000px; /* Large enough to accommodate content */
}

.accordion-content-inner {
  padding: 1.5rem;
  border-top: 1px solid #333;
}

.accordion-description {
  color: #b0b0b0;
  margin-bottom: 1.5rem;
  line-height: 1.5;
  font-size: 0.9rem;
}
</style>