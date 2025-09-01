export interface Expense {
  id?: number
  amount: number
  latitude?: number
  longitude?: number
  place_id?: string
  place_name?: string
  place_address?: string
  receipt_image?: Uint8Array | null
  has_image?: boolean
  rating?: number
  timestamp: Date
  // AI Classification fields
  cuisine_type?: string | null
  meal_time?: string | null
  ai_confidence_cuisine?: number | null
  ai_confidence_meal?: number | null
}

export interface Place {
  id: string
  name: string
  address: string
  types: string[]
  location: {
    latitude: number
    longitude: number
  }
}