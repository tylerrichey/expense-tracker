import axios from "axios";
import { logger } from "./logger.js";

class PlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
    this.baseURL = "https://places.googleapis.com/v1/places:searchNearby";
    this.autocompleteURL =
      "https://places.googleapis.com/v1/places:autocomplete";
  }

  calculateDistance(point1, point2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  async searchNearbyPlaces(latitude, longitude, radius = 200) {
    if (!this.apiKey) {
      throw new Error("Google Places API key not configured");
    }

    const requestBody = {
      includedTypes: [
        "restaurant",
        "bar",
        "grocery_store",
        "convenience_store",
        "supermarket",
        "pub",
        "cafe",
        "bakery",
        "meal_takeaway",
        "coffee_shop",
        "golf_course",
        "wine_bar",
      ],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
          },
          radius: radius,
        },
      },
    };

    const requestHeaders = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": this.apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.types,places.location",
    };

    // Log the Google Places API request
    logger.logGooglePlacesRequest(this.baseURL, requestHeaders, requestBody);

    try {
      const response = await axios.post(this.baseURL, requestBody, {
        headers: requestHeaders,
      });

      // Log the Google Places API response
      logger.logGooglePlacesResponse(
        response.status,
        response.statusText,
        response.headers,
        response.data
      );

      const userLocation = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };

      const places =
        response.data.places?.map((place) => ({
          id: place.id,
          name: place.displayName?.text || "Unknown Place",
          address: place.formattedAddress || "",
          types: place.types || [],
          location: place.location,
          distance: this.calculateDistance(userLocation, place.location),
        })) || [];

      // Sort by distance (closest first)
      return places.sort((a, b) => a.distance - b.distance);
    } catch (error) {
      // Log detailed error information for Google Places API
      logger.logGooglePlacesError(error);

      logger.error("Error fetching nearby places", {
        error: error.response?.data || error.message,
      });
      throw new Error("Failed to fetch nearby places");
    }
  }

  async searchAutocomplete(
    input,
    latitude = null,
    longitude = null,
    radius = 1000
  ) {
    if (!this.apiKey) {
      throw new Error("Google Places API key not configured");
    }

    if (!input || input.trim().length === 0) {
      throw new Error("Search input is required");
    }

    const requestBody = {
      input: input.trim(),
    };

    // Add location bias if coordinates are provided
    if (latitude && longitude) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
          },
          radius: radius,
        },
      };
    }

    const requestHeaders = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": this.apiKey,
    };

    // Log the Google Places Autocomplete API request
    logger.logGooglePlacesRequest(
      this.autocompleteURL,
      requestHeaders,
      requestBody
    );

    try {
      const response = await axios.post(this.autocompleteURL, requestBody, {
        headers: requestHeaders,
      });

      // Log the Google Places Autocomplete API response
      logger.logGooglePlacesResponse(
        response.status,
        response.statusText,
        response.headers,
        response.data
      );

      const suggestions =
        response.data.suggestions
          ?.map((suggestion) => {
            const prediction = suggestion.placePrediction;
            if (prediction) {
              return {
                id: prediction.placeId,
                name:
                  prediction.structuredFormat.mainText.text || "Unknown Place",
                description: prediction.text?.text || "",
              };
            }
            return null;
          })
          .filter(Boolean) || [];

      return suggestions;
    } catch (error) {
      // Log detailed error information for Google Places Autocomplete API
      logger.logGooglePlacesError(error);

      logger.error("Error fetching autocomplete suggestions", {
        error: error.response?.data || error.message,
      });
      throw new Error("Failed to fetch autocomplete suggestions");
    }
  }
}

export const placesService = new PlacesService();
