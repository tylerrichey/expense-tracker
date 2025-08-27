import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the database service
const mockAddExpense = vi.fn()
const mockDatabaseService = {
  addExpense: mockAddExpense,
  uploadExpenseImage: vi.fn(),
  getNearbyPlaces: vi.fn().mockResolvedValue([]),
  getAllUniquePlaces: vi.fn().mockResolvedValue([]),
  getPlaceAutocomplete: vi.fn().mockResolvedValue([])
}

vi.mock('../services/database', () => ({
  databaseService: mockDatabaseService
}))

// Mock geolocation
vi.mock('../services/geolocation', () => ({
  getCurrentLocation: vi.fn().mockResolvedValue({
    latitude: 40.7128,
    longitude: -74.0060
  })
}))

describe('Rating Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddExpense.mockResolvedValue({ id: 1 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should include rating in expense data when rating is set', async () => {
    const { mount } = await import('@vue/test-utils')
    const ExpenseForm = await import('../components/ExpenseForm.vue')
    
    const wrapper = mount(ExpenseForm.default, {
      global: {
        mocks: {
          navigator: {
            userAgent: 'test'
          }
        }
      }
    })

    // Set form values
    await wrapper.find('input[type="number"]').setValue('25.50')
    await wrapper.find('input[type="date"]').setValue('2025-08-27')
    
    // Set manual input mode and simulate rating selection
    const vm = wrapper.vm as any
    vm.showManualInput = true
    vm.manualPlaceName = 'Test Store'
    vm.rating = 4
    
    // Submit the form
    await wrapper.find('form').trigger('submit')
    
    // Wait for async operations
    await wrapper.vm.$nextTick()
    
    // Check that addExpense was called with rating
    expect(mockAddExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 25.5,
        rating: 4,
        place_name: 'Test Store'
      })
    )
  })

  it('should not include rating in expense data when rating is 0', async () => {
    const { mount } = await import('@vue/test-utils')
    const ExpenseForm = await import('../components/ExpenseForm.vue')
    
    const wrapper = mount(ExpenseForm.default, {
      global: {
        mocks: {
          navigator: {
            userAgent: 'test'
          }
        }
      }
    })

    // Set form values without rating
    await wrapper.find('input[type="number"]').setValue('15.25')
    await wrapper.find('input[type="date"]').setValue('2025-08-27')
    
    // Set manual input mode to avoid triggering place autocomplete
    const vm = wrapper.vm as any
    vm.showManualInput = true
    vm.manualPlaceName = 'Another Store'
    
    // Submit the form (rating defaults to 0)
    await wrapper.find('form').trigger('submit')
    
    // Wait for async operations
    await wrapper.vm.$nextTick()
    
    // Check that addExpense was called without rating (undefined)
    expect(mockAddExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15.25,
        rating: undefined,
        place_name: 'Another Store'
      })
    )
  })

  it('should have rating button in the form', async () => {
    const { mount } = await import('@vue/test-utils')
    const ExpenseForm = await import('../components/ExpenseForm.vue')
    
    const wrapper = mount(ExpenseForm.default, {
      global: {
        mocks: {
          navigator: {
            userAgent: 'test'
          }
        }
      }
    })

    // Check that rating button exists
    const ratingButton = wrapper.find('.rating-button')
    expect(ratingButton.exists()).toBe(true)
    expect(ratingButton.text()).toBe('⭐')
  })
})