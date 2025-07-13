import axios from 'axios'

class PlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY
    this.baseURL = 'https://places.googleapis.com/v1/places:searchNearby'
  }

  async searchNearbyPlaces(latitude, longitude, radius = 800) {
    if (!this.apiKey) {
      throw new Error('Google Places API key not configured')
    }

    try {
      const response = await axios.post(
        this.baseURL,
        {
          includedTypes: [
            'restaurant',
            'bar',
            'gas_station',
            'supermarket',
            'shopping_mall',
            'store',
            'pharmacy',
            'hospital',
            'bank',
            'atm',
            'cafe',
            'lodging'
          ],
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
              },
              radius: radius
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.location'
          }
        }
      )

      return response.data.places?.map(place => ({
        id: place.id,
        name: place.displayName?.text || 'Unknown Place',
        address: place.formattedAddress || '',
        types: place.types || [],
        location: place.location
      })) || []
    } catch (error) {
      console.error('Error fetching nearby places:', error.response?.data || error.message)
      throw new Error('Failed to fetch nearby places')
    }
  }
}

export const placesService = new PlacesService()