<template>
  <div class="expense-table-view">
    <!-- Table Controls -->
    <div class="table-controls">
      <div class="search-filters">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by place name..."
            class="search-input"
          />
        </div>
        <div class="amount-filter">
          <input
            v-model.number="minAmount"
            type="number"
            placeholder="Min amount"
            class="amount-input"
            step="0.01"
            min="0"
          />
          <span class="filter-separator">-</span>
          <input
            v-model.number="maxAmount"
            type="number"
            placeholder="Max amount"
            class="amount-input"
            step="0.01"
            min="0"
          />
        </div>
        <div class="date-filter">
          <input
            v-model="startDate"
            type="date"
            class="date-input"
          />
          <span class="filter-separator">to</span>
          <input
            v-model="endDate"
            type="date"
            class="date-input"
          />
        </div>
      </div>
    </div>

    <!-- Table Summary -->
    <div class="table-summary">
      <span class="results-count">{{ filteredExpenses.length }} expenses</span>
      <span class="total-amount">${{ totalAmount.toFixed(2) }}</span>
    </div>

    <!-- Data Table -->
    <div class="table-container">
      <table class="expense-table">
        <thead>
          <tr>
            <th @click="sortBy('timestamp')" class="sortable" :class="getSortClass('timestamp')">
              Date
              <span class="sort-icon">{{ getSortIcon('timestamp') }}</span>
            </th>
            <th @click="sortBy('amount')" class="sortable" :class="getSortClass('amount')">
              Amount
              <span class="sort-icon">{{ getSortIcon('amount') }}</span>
            </th>
            <th @click="sortBy('place_name')" class="sortable" :class="getSortClass('place_name')">
              Location
              <span class="sort-icon">{{ getSortIcon('place_name') }}</span>
            </th>
            <th class="address-column">Address</th>
            <th class="actions-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="expense in paginatedExpenses" 
            :key="expense.id"
            class="expense-row"
            @click="openExpenseDetails(expense)"
          >
            <td class="date-cell">
              <div class="date-primary">{{ formatDate(expense.timestamp) }}</div>
              <div class="date-secondary">{{ formatTime(expense.timestamp) }}</div>
            </td>
            <td class="amount-cell">${{ expense.amount.toFixed(2) }}</td>
            <td class="location-cell">
              <div class="location-name">{{ expense.place_name || 'Unknown' }}</div>
            </td>
            <td class="address-cell address-column">{{ expense.place_address || '-' }}</td>
            <td class="actions-cell actions-column">
              <button 
                v-if="expense.has_image && expense.id" 
                @click.stop="viewImage(expense.id)"
                class="action-btn receipt-btn"
                :disabled="loadingImageId === expense.id"
                title="View Receipt"
              >
                {{ loadingImageId === expense.id ? '...' : '📄' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filteredExpenses.length === 0" class="no-results">
        <p>No expenses found matching your filters.</p>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button 
        @click="currentPage = 1" 
        :disabled="currentPage === 1"
        class="page-btn"
      >
        First
      </button>
      <button 
        @click="currentPage--" 
        :disabled="currentPage === 1"
        class="page-btn"
      >
        Previous
      </button>
      
      <span class="page-info">
        Page {{ currentPage }} of {{ totalPages }}
      </span>
      
      <button 
        @click="currentPage++" 
        :disabled="currentPage === totalPages"
        class="page-btn"
      >
        Next
      </button>
      <button 
        @click="currentPage = totalPages" 
        :disabled="currentPage === totalPages"
        class="page-btn"
      >
        Last
      </button>
    </div>

    <!-- Image Modal -->
    <ImageModal 
      :show-image-modal="showImageModal"
      :current-image-url="currentImageUrl"
      @close="closeImageModal"
    />

    <!-- Expense Details Modal -->
    <ExpenseDetailsModal
      :show="showExpenseDetails"
      :expense="selectedExpense"
      :loading-image-id="loadingImageId"
      :deleting-id="deletingId"
      @close="closeExpenseDetails"
      @view-receipt="viewImage"
      @delete-expense="handleDeleteExpense"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useImageModal } from '../composables/useImageModal'
import { databaseService } from '../services/database'
import ImageModal from './ImageModal.vue'
import ExpenseDetailsModal from './ExpenseDetailsModal.vue'

// Props
const props = defineProps({
  expenses: {
    type: Array,
    required: true
  }
})

// Emits
const emit = defineEmits(['expense-deleted'])

// Image modal functionality
const { loadingImageId, showImageModal, currentImageUrl, viewImage, closeImageModal } = useImageModal()

// Expense details modal
const showExpenseDetails = ref(false)
const selectedExpense = ref({})
const deletingId = ref(null)

// Reactive data
const searchQuery = ref('')
const minAmount = ref(null)
const maxAmount = ref(null)
const startDate = ref('')
const endDate = ref('')

const sortField = ref('timestamp')
const sortDirection = ref('desc') // 'asc' or 'desc'

const currentPage = ref(1)
const itemsPerPage = 50

// Computed properties
const filteredExpenses = computed(() => {
  let filtered = [...props.expenses]

  // Text search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(expense => 
      (expense.place_name || '').toLowerCase().includes(query) ||
      (expense.place_address || '').toLowerCase().includes(query)
    )
  }

  // Amount range filter
  if (minAmount.value !== null && minAmount.value !== '') {
    filtered = filtered.filter(expense => expense.amount >= minAmount.value)
  }
  if (maxAmount.value !== null && maxAmount.value !== '') {
    filtered = filtered.filter(expense => expense.amount <= maxAmount.value)
  }

  // Date range filter
  if (startDate.value) {
    const start = new Date(startDate.value)
    start.setHours(0, 0, 0, 0)
    filtered = filtered.filter(expense => {
      const expenseDate = new Date(expense.timestamp)
      expenseDate.setHours(0, 0, 0, 0)
      return expenseDate >= start
    })
  }
  if (endDate.value) {
    const end = new Date(endDate.value)
    end.setHours(23, 59, 59, 999)
    filtered = filtered.filter(expense => {
      const expenseDate = new Date(expense.timestamp)
      return expenseDate <= end
    })
  }

  // Sort
  filtered.sort((a, b) => {
    let aVal, bVal

    switch (sortField.value) {
      case 'amount':
        aVal = a.amount
        bVal = b.amount
        break
      case 'place_name':
        aVal = (a.place_name || '').toLowerCase()
        bVal = (b.place_name || '').toLowerCase()
        break
      case 'timestamp':
      default:
        aVal = new Date(a.timestamp).getTime()
        bVal = new Date(b.timestamp).getTime()
        break
    }

    if (aVal < bVal) return sortDirection.value === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection.value === 'asc' ? 1 : -1
    return 0
  })

  return filtered
})

const totalAmount = computed(() => {
  return filteredExpenses.value.reduce((sum, expense) => sum + expense.amount, 0)
})

const totalPages = computed(() => {
  return Math.ceil(filteredExpenses.value.length / itemsPerPage)
})

const paginatedExpenses = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredExpenses.value.slice(start, end)
})

// Watch for filter changes to reset page
watch([searchQuery, minAmount, maxAmount, startDate, endDate], () => {
  currentPage.value = 1
})

// Methods
function sortBy(field) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = field === 'amount' ? 'desc' : 'asc' // Default to desc for amount, asc for others
  }
  currentPage.value = 1
}

function getSortClass(field) {
  if (sortField.value === field) {
    return sortDirection.value === 'asc' ? 'sort-asc' : 'sort-desc'
  }
  return ''
}

function getSortIcon(field) {
  if (sortField.value === field) {
    return sortDirection.value === 'asc' ? '↑' : '↓'
  }
  return '↕'
}

function formatDate(timestamp) {
  const date = new Date(timestamp)
  // Use shorter format on mobile devices
  if (window.innerWidth <= 768) {
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit'
    })
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTime(timestamp) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

function openExpenseDetails(expense) {
  selectedExpense.value = expense
  showExpenseDetails.value = true
}

function closeExpenseDetails() {
  showExpenseDetails.value = false
  selectedExpense.value = {}
}

async function handleDeleteExpense(expenseId) {
  if (!confirm('Are you sure you want to delete this expense?')) {
    return
  }

  deletingId.value = expenseId
  
  try {
    await databaseService.deleteExpense(expenseId)
    closeExpenseDetails()
    emit('expense-deleted')
  } catch (err) {
    console.error('Error deleting expense:', err)
    // Could add error handling UI here
    alert('Failed to delete expense. Please try again.')
  } finally {
    deletingId.value = null
  }
}
</script>

<style scoped>
.expense-table-view {
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 24px;
}

.table-controls {
  margin-bottom: 16px;
}

.search-filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: flex-start;
}

.search-box {
  min-width: 250px;
}

.search-input,
.amount-input,
.date-input {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-size: 14px;
}

.search-input {
  width: 100%;
}

.search-input::placeholder {
  color: #888;
}

.amount-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.amount-input {
  width: 100px;
}

.date-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-separator {
  color: #b0b0b0;
  font-size: 14px;
}

.table-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.results-count {
  color: #b0b0b0;
  font-size: 14px;
  font-weight: 500;
}

.total-amount {
  color: #28a745;
  font-weight: 600;
  font-size: 18px;
}

.table-container {
  background: #2a2a2a;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}

.expense-table {
  width: 100%;
  border-collapse: collapse;
}

.expense-table th {
  background: #333;
  color: #e0e0e0;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #444;
  position: sticky;
  top: 0;
  z-index: 10;
}

.expense-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.expense-table th.sortable:hover {
  background: #3a3a3a;
}

.expense-table th.sort-asc,
.expense-table th.sort-desc {
  background: #007bff;
  color: white;
}

.sort-icon {
  margin-left: 8px;
  font-size: 12px;
  opacity: 0.7;
}

.expense-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #444;
  color: #e0e0e0;
}

.expense-row {
  cursor: pointer;
  transition: background-color 0.2s;
}

.expense-row:hover {
  background: #333;
}

.date-cell {
  min-width: 120px;
}

.date-primary {
  font-weight: 500;
  margin-bottom: 2px;
}

.date-secondary {
  font-size: 12px;
  color: #888;
}

.amount-cell {
  font-weight: 600;
  color: #28a745;
  text-align: right;
  min-width: 100px;
}

.location-cell {
  min-width: 150px;
}

.location-name {
  font-weight: 500;
}

.address-cell {
  color: #b0b0b0;
  font-size: 14px;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions-cell {
  text-align: center;
  width: 80px;
}

.action-btn {
  background: #3a3a3a;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 12px;
  color: #e0e0e0;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #4a4a4a;
  border-color: #007bff;
}

.receipt-btn {
  background: #007bff;
  border-color: #007bff;
}

.receipt-btn:hover {
  background: #0056b3;
}

.no-results {
  text-align: center;
  padding: 60px 20px;
  color: #888;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.page-btn {
  background: #3a3a3a;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #4a4a4a;
  border-color: #007bff;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #b0b0b0;
  font-size: 14px;
  margin: 0 8px;
}

/* Responsive */
@media (max-width: 768px) {
  .search-filters {
    flex-direction: column;
    gap: 12px;
  }

  .search-box {
    min-width: auto;
    width: 100%;
  }

  .search-input {
    width: 100%;
  }

  .amount-filter {
    width: 100%;
    display: flex !important;
    flex-direction: row !important;
  }

  .amount-input {
    flex: 1;
    min-width: 60px;
    max-width: none;
  }

  .date-filter {
    width: 100%;
    display: flex !important;
    flex-direction: row !important;
  }

  .date-input {
    flex: 1;
    min-width: 80px;
  }

  .expense-table {
    font-size: 14px;
  }

  .expense-table th,
  .expense-table td {
    padding: 6px 8px;
  }

  .date-cell {
    min-width: 90px;
    width: 90px;
  }

  .date-primary {
    font-size: 13px;
    margin-bottom: 1px;
  }

  .date-secondary {
    font-size: 11px;
  }

  .amount-cell {
    min-width: 80px;
    width: 80px;
    font-size: 14px;
  }

  .location-cell {
    min-width: auto;
    width: auto;
    flex: 1;
    max-width: none;
  }

  .location-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .address-column {
    display: none;
  }

  .actions-column {
    display: none;
  }

  .pagination {
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .expense-table-view {
    padding: 16px;
  }

  .amount-filter,
  .date-filter {
    flex-direction: column;
    gap: 4px;
  }

  .filter-separator {
    display: none;
  }

  .date-cell {
    min-width: 75px;
    width: 75px;
  }

  .date-primary {
    font-size: 12px;
  }

  .date-secondary {
    font-size: 10px;
  }

  .amount-cell {
    min-width: 70px;
    width: 70px;
    font-size: 13px;
  }

  .expense-table th,
  .expense-table td {
    padding: 4px 6px;
  }
}
</style>