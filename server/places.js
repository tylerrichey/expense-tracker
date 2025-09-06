import axios from "axios";
import { logger } from "./logger.js";
import { databaseService } from "./database.js";

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

  async savePlaceToDatabase(placeData) {
    try {
      await databaseService.upsertPlace(placeData);
    } catch (error) {
      logger.error('Error saving place to database', { 
        placeId: placeData.id, 
        error: error.message 
      });
    }
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
        "places.id,places.displayName,places.formattedAddress,places.types,places.location,places.generativeSummary,places.reviewSummary",
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
          generativeSummary: place.generativeSummary?.overview?.text || null,
          reviewSummary: place.reviewSummary?.text || null,
          distance: this.calculateDistance(userLocation, place.location),
        })) || [];

      // Save places to database (don't await to avoid slowing down response)
      places.forEach(place => {
        this.savePlaceToDatabase({
          id: place.id,
          name: place.name,
          address: place.address,
          types: place.types,
          location: place.location,
          generativeSummary: place.generativeSummary,
          reviewSummary: place.reviewSummary
        });
      });

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

  async getPlaceDetails(placeId) {
    if (!this.apiKey) {
      throw new Error("Google Places API key not configured");
    }

    if (!placeId) {
      throw new Error("Place ID is required");
    }

    const detailsURL = `https://places.googleapis.com/v1/places/${placeId}`;
    
    const requestHeaders = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": this.apiKey,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location,types,generativeSummary,reviewSummary",
    };

    try {
      const response = await axios.get(detailsURL, {
        headers: requestHeaders,
      });

      const place = response.data;
      const placeData = {
        id: place.id,
        name: place.displayName?.text || "Unknown Place",
        address: place.formattedAddress || "",
        location: place.location,
        types: place.types || [],
        generativeSummary: place.generativeSummary?.overview?.text || null,
        reviewSummary: place.reviewSummary?.text || null,
      };

      // Save place to database (don't await to avoid slowing down response)
      this.savePlaceToDatabase(placeData);

      return placeData;
    } catch (error) {
      logger.logGooglePlacesError(error);
      logger.error("Error fetching place details", {
        placeId,
        error: error.response?.data || error.message,
      });
      throw new Error("Failed to fetch place details");
    }
  }

  async searchAutocomplete(
    input,
    latitude = null,
    longitude = null,
    radius = 1000,
    includeDetails = false
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
                address: prediction.text?.text || "", // Use the full text as the address fallback
              };
            }
            return null;
          })
          .filter(Boolean) || [];

      // If includeDetails is true, fetch full place details for each suggestion
      if (includeDetails) {
        const detailedSuggestions = await Promise.all(
          suggestions.map(async (suggestion) => {
            try {
              const details = await this.getPlaceDetails(suggestion.id);
              const detailedSuggestion = {
                ...suggestion,
                address: details.address,
                location: details.location,
                types: details.types,
                generativeSummary: details.generativeSummary,
                reviewSummary: details.reviewSummary,
              };
              
              // Save the detailed place data to database
              // Note: getPlaceDetails already saves basic data, but this ensures we have the complete info
              this.savePlaceToDatabase({
                id: details.id,
                name: details.name,
                address: details.address,
                types: details.types,
                location: details.location,
                generativeSummary: details.generativeSummary,
                reviewSummary: details.reviewSummary
              });
              
              return detailedSuggestion;
            } catch (error) {
              logger.error(`Failed to fetch details for place ${suggestion.id}`, {
                error: error.message,
              });
              // Return original suggestion if details fetch fails
              return suggestion;
            }
          })
        );
        return detailedSuggestions;
      }

      // For basic suggestions without details, save what we have (without types)
      suggestions.forEach(suggestion => {
        this.savePlaceToDatabase({
          id: suggestion.id,
          name: suggestion.name,
          address: suggestion.address,
          types: [], // No types available without details
          location: null // No location available without details
        });
      });

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
