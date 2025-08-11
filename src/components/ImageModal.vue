<template>
  <!-- Image Modal -->
  <div v-if="showImageModal" class="modal-overlay" @click="closeImageModal">
    <div class="modal-content image-modal" @click.stop>
      <button class="modal-close" @click="closeImageModal" title="Close">×</button>
      <img :src="currentImageUrl" alt="Receipt image" class="modal-image" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  showImageModal: boolean
  currentImageUrl: string
}>()

const emit = defineEmits<{
  close: []
}>()

function closeImageModal() {
  emit('close')
}
</script>

<style scoped>
/* Modal overlay styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1010;
  padding: 20px;
}

.modal-content {
  background: #1e1e1e;
  border: 2px solid #444;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.2s;
}

.modal-close:hover {
  background: rgba(0, 0, 0, 0.9);
}

/* Image Modal Styles */
.image-modal {
  position: relative;
  width: auto;
  height: auto;
  max-width: 90vw;
  max-height: 90vh;
  backdrop-filter: blur(2px);
  background: transparent;
  border: none;
}

.modal-image {
  max-width: calc(90vw - 40px);
  max-height: calc(90vh - 40px);
  width: auto;
  height: auto;
  display: block;
  object-fit: contain;
  border-radius: 8px;
}

/* Mobile modal adjustments */
@media (max-width: 768px) {
  .image-modal {
    max-width: 95vw;
    max-height: 95vh;
  }
  
  .modal-image {
    max-width: calc(95vw - 20px);
    max-height: calc(95vh - 20px);
  }
}
</style>