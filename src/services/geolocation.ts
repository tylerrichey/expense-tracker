export interface Location {
  latitude: number
  longitude: number
}

export async function getCurrentLocation(): Promise<Location | null> {
  // Check if geolocation is supported
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser')
    return null
  }

  // Check if we're on a secure origin (HTTPS or localhost)
  const isSecureContext = window.isSecureContext || 
    window.location.protocol === 'https:' || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'

  if (!isSecureContext) {
    console.warn('Geolocation requires HTTPS in production. Please use HTTPS or localhost.')
    return null
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      },
      (error) => {
        let errorMessage = 'Error getting location: '
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Location access denied by user'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information unavailable'
            break
          case error.TIMEOUT:
            errorMessage += 'Location request timed out'
            break
          default:
            if (error.message.includes('secure origins')) {
              errorMessage += 'HTTPS required for location access in production'
            } else {
              errorMessage += error.message
            }
            break
        }
        
        console.warn(errorMessage)
        resolve(null)
      },
      {
        timeout: 15000, // Increased timeout for GPS
        enableHighAccuracy: true, // Use GPS for better accuracy
        maximumAge: 60000 // Cache location for 1 minute only
      }
    )
  })
}

export async function getFreshLocation(): Promise<Location | null> {
  // Check if geolocation is supported
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser')
    return null
  }

  // Check if we're on a secure origin (HTTPS or localhost)
  const isSecureContext = window.isSecureContext || 
    window.location.protocol === 'https:' || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'

  if (!isSecureContext) {
    console.warn('Geolocation requires HTTPS in production. Please use HTTPS or localhost.')
    return null
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      },
      (error) => {
        let errorMessage = 'Error getting fresh location: '
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Location access denied by user'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information unavailable'
            break
          case error.TIMEOUT:
            errorMessage += 'Location request timed out'
            break
          default:
            if (error.message.includes('secure origins')) {
              errorMessage += 'HTTPS required for location access in production'
            } else {
              errorMessage += error.message
            }
            break
        }
        
        console.warn(errorMessage)
        resolve(null)
      },
      {
        timeout: 20000, // Longer timeout for fresh GPS reading
        enableHighAccuracy: true, // Use GPS for better accuracy
        maximumAge: 0 // Force fresh reading, no cache
      }
    )
  })
}