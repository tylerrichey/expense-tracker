import { ref } from 'vue'
import { databaseService } from '../services/database'

export function useImageModal() {
  const loadingImageId = ref<number | null>(null)
  const showImageModal = ref(false)
  const currentImageUrl = ref('')
  const error = ref('')

  async function viewImage(expenseId: number) {
    loadingImageId.value = expenseId
    
    try {
      const imageUrl = await databaseService.getExpenseImage(expenseId)
      currentImageUrl.value = imageUrl
      showImageModal.value = true
    } catch (err) {
      console.error('Error loading image:', err)
      error.value = 'Failed to load image'
      setTimeout(() => {
        error.value = ''
      }, 3000)
    } finally {
      loadingImageId.value = null
    }
  }

  function closeImageModal() {
    showImageModal.value = false
    if (currentImageUrl.value) {
      URL.revokeObjectURL(currentImageUrl.value) // Clean up object URL
      currentImageUrl.value = ''
    }
  }

  return {
    loadingImageId,
    showImageModal,
    currentImageUrl,
    error,
    viewImage,
    closeImageModal
  }
}