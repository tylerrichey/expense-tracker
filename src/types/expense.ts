export interface Expense {
  id?: number
  amount: number
  latitude?: number
  longitude?: number
  place_id?: string
  place_name?: string
  place_address?: string
  timestamp: Date
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