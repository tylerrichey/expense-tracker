import axios from 'axios'

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
        'bar_and_grill'
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
    console.log('\n🌍 === GOOGLE PLACES API REQUEST ===')
    console.log('URL:', this.baseURL)
    console.log('Headers:', JSON.stringify({
      ...requestHeaders,
      'X-Goog-Api-Key': '[REDACTED]' // Hide API key in logs
    }, null, 2))
    console.log('Request Body:', JSON.stringify(requestBody, null, 2))
    console.log('=====================================\n')

    try {
      const response = await axios.post(
        this.baseURL,
        requestBody,
        {
          headers: requestHeaders
        }
      )

      // Log the Google Places API response
      console.log('\n🌍 === GOOGLE PLACES API RESPONSE ===')
      console.log('Status:', response.status, response.statusText)
      console.log('Response Headers:', JSON.stringify(response.headers, null, 2))
      console.log('Response Data:', JSON.stringify(response.data, null, 2))
      console.log('Total Places Found:', response.data.places?.length || 0)
      console.log('=====================================\n')

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
      console.log('\n❌ === GOOGLE PLACES API ERROR ===')
      console.log('Error Message:', error.message)
      if (error.response) {
        console.log('Error Status:', error.response.status, error.response.statusText)
        console.log('Error Headers:', JSON.stringify(error.response.headers, null, 2))
        console.log('Error Data:', JSON.stringify(error.response.data, null, 2))
      } else if (error.request) {
        console.log('Request made but no response received')
        console.log('Request Details:', error.request)
      }
      console.log('================================\n')
      
      console.error('Error fetching nearby places:', error.response?.data || error.message)
      throw new Error('Failed to fetch nearby places')
    }
  }
}

export const placesService = new PlacesService()