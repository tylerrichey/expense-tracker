import axios from 'axios'
import { logger } from './logger.js'

class PlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY
    this.baseURL = 'https://places.googleapis.com/v1/places:searchNearby'
  }

  calculateDistance(point1, point2) {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = point1.latitude * Math.PI / 180
    const φ2 = point2.latitude * Math.PI / 180
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c // Distance in meters
  }

  async searchNearbyPlaces(latitude, longitude, radius = 500) {
    if (!this.apiKey) {
      throw new Error('Google Places API key not configured')
    }

    const requestBody = {
      includedTypes: [
        'restaurant',
        'bar',
        'grocery_store',
        'convenience_store',
        'supermarket',
        'pub',
        'cafe',
        'bakery',
        'meal_takeaway',
        'coffee_shop'
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
    }

    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.location'
    }

    // Log the Google Places API request
    logger.logRequest(this.baseURL, requestHeaders, requestBody)

    try {
      const response = await axios.post(
        this.baseURL,
        requestBody,
        {
          headers: requestHeaders
        }
      )

      // Log the Google Places API response
      logger.logResponse(response.status, response.statusText, response.headers, response.data)

      const userLocation = { latitude: parseFloat(latitude), longitude: parseFloat(longitude) }
      
      const places = response.data.places?.map(place => ({
        id: place.id,
        name: place.displayName?.text || 'Unknown Place',
        address: place.formattedAddress || '',
        types: place.types || [],
        location: place.location,
        distance: this.calculateDistance(userLocation, place.location)
      })) || []
      
      // Sort by distance (closest first)
      return places.sort((a, b) => a.distance - b.distance)
    } catch (error) {
      // Log detailed error information for Google Places API
      logger.logError(error)
      
      console.error('Error fetching nearby places:', error.response?.data || error.message)
      throw new Error('Failed to fetch nearby places')
    }
  }
}

export const placesService = new PlacesService()