<template>
  <div class="card expense-form">
    <h3 class="card-title text-center">Add Expense</h3>
    <form @submit.prevent="submitExpense" @keydown.enter="handleFormKeydown">
      <div class="form-group">
        <!-- <label for="amount">Amount ($):</label> -->
        <div class="amount-date-container flex gap-md">
          <input
            id="amount"
            v-model.number="amount"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            class="form-input amount-input flex-1"
          />
          <input
            id="expense-date"
            v-model="expenseDate"
            type="date"
            required
            class="form-input date-input"
            @click="handleDateInputClick"
          />
        </div>
      </div>
      <div class="form-group">
        <!-- <label for="location">Location:</label> -->
        <div v-if="showManualInput" class="location-container">
          <div class="autocomplete-container">
            <input
              id="location"
              v-model="manualPlaceName"
              type="text"
              placeholder="Enter location name"
              class="form-input location-input"
              required
              @input="onPlaceNameInput"
              @focus="onPlaceNameFocus"
              @blur="onPlaceNameBlur"
              @keydown="onPlaceNameKeydown"
              autocomplete="off"
            />
            <ul
              v-if="showSuggestions && filteredPlaces.length > 0"
              class="suggestions-list"
            >
              <li
                v-for="(place, index) in filteredPlaces"
                :key="place"
                :class="{ highlighted: selectedSuggestionIndex === index }"
                @mousedown="selectSuggestion(place)"
                @mouseenter="selectedSuggestionIndex = index"
                class="suggestion-item"
              >
                {{ place }}
              </li>
            </ul>
          </div>
          <!-- <button
            type="button"
            @click="refreshPlaces"
            :disabled="loadingPlaces"
            class="refresh-button"
            title="Try to load nearby places"
          >
            {{ loadingPlaces ? '⟳' : '🔄' }}
          </button> -->
          <button
            type="button"
            @click="toggleInputMode"
            class="toggle-button"
            title="Switch to dropdown"
          >
            📍
          </button>
          <button
            type="button"
            @click="triggerImageUpload"
            class="image-button"
            :title="
              receiptImage ? 'Receipt attached ✓' : 'Attach receipt image'
            "
          >
            {{ receiptImage ? "📄" : "📷" }}
          </button>
        </div>
        <div v-else class="location-container">
          <select
            id="location"
            v-model="selectedPlace"
            :disabled="loadingPlaces"
            class="form-select location-select"
            required
          >
            <option value="" disabled>Select a location</option>
            <option v-for="place in places" :key="place.id" :value="place">
              {{ place.name }}
            </option>
          </select>
          <!-- <button
            type="button"
            @click="refreshPlaces"
            :disabled="loadingPlaces || !currentLocation"
            class="refresh-button"
            title="Refresh nearby places"
          >
            {{ loadingPlaces ? "⟳" : "🔄" }}
          </button> -->
          <button
            type="button"
            @click="toggleInputMode"
            class="toggle-button"
            title="Switch to manual entry"
          >
            ✏️
          </button>
          <button
            type="button"
            @click="triggerImageUpload"
            class="image-button"
            :title="
              receiptImage ? 'Receipt attached ✓' : 'Attach receipt image'
            "
          >
            {{ receiptImage ? "📄" : "📷" }}
          </button>
        </div>
        <div
          v-if="selectedPlace && typeof selectedPlace === 'object'"
          class="selected-place-info"
        >
          📍 {{ selectedPlace.address }}
        </div>
        <div
          v-if="showManualInput && manualPlaceName"
          class="selected-place-info"
        >
          📍 {{ manualPlaceName }}
        </div>
      </div>
      <button type="submit" :disabled="isSubmitting" class="btn btn-primary btn-full">
        <span v-if="isSubmitting">Adding<span class="loading-dots"></span></span>
        <span v-else>Add Expense</span>
      </button>
    </form>
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      :capture="isMobile ? 'environment' : undefined"
      @change="handleImageUpload"
      style="display: none"
    />
    <div v-if="message" class="alert" :class="messageType === 'success' ? 'alert-success' : 'alert-error'">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { databaseService } from "../services/database";
import { getCurrentLocation } from "../services/geolocation";
import { Place } from "../types/expense";

const amount = ref<number>(0);
const expenseDate = ref(new Date().toISOString().split("T")[0]);
const isSubmitting = ref(false);
const message = ref("");
const messageType = ref<"success" | "error">("success");
const places = ref<Place[]>([]);
const selectedPlace = ref<Place | string>("");
const loadingPlaces = ref(false);
const currentLocation = ref<{ latitude: number; longitude: number } | null>(
  null
);
const showManualInput = ref(false);
const manualPlaceName = ref("");
const allPlaces = ref<string[]>([]);
const filteredPlaces = ref<string[]>([]);
const showSuggestions = ref(false);
const selectedSuggestionIndex = ref(-1);
const receiptImage = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

// Detect if we're on mobile for better camera handling
const isMobile = computed(() => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
});

// Reference to the beforeunload handler for cleanup
let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

const emit = defineEmits<{
  expenseAdded: [];
}>();

async function loadCurrentLocationAndPlaces() {
  try {
    const location = await getCurrentLocation();
    if (location) {
      currentLocation.value = location;
      await loadNearbyPlaces(location.latitude, location.longitude);
    } else {
      // No location available, show manual input
      showManualInput.value = true;
      selectedPlace.value = "";

      // Show message if location is not available due to HTTPS
      if (
        !window.isSecureContext &&
        window.location.protocol !== "https:" &&
        !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
      ) {
        showMessage("Location services require HTTPS in production", "error");
      }
    }
  } catch (error) {
    console.error("Error getting location:", error);
    showMessage("Could not access location services", "error");
    // Show manual input on error
    showManualInput.value = true;
    selectedPlace.value = "";
  }
}

async function loadNearbyPlaces(latitude: number, longitude: number) {
  loadingPlaces.value = true;
  try {
    places.value = await databaseService.getNearbyPlaces(latitude, longitude);

    if (places.value.length > 0) {
      // Show dropdown but don't auto-select anything
      selectedPlace.value = "";
      showManualInput.value = false;
    } else {
      // No places found, show manual input
      showManualInput.value = true;
      selectedPlace.value = "";
    }
  } catch (error) {
    console.error("Error loading places:", error);
    showMessage("Could not load nearby places", "error");
    // Show manual input on error
    showManualInput.value = true;
    selectedPlace.value = "";
  } finally {
    loadingPlaces.value = false;
  }
}

// async function refreshPlaces() {
//   try {
//     // Get a fresh, accurate location reading
//     const freshLocation = await getFreshLocation();
//     if (freshLocation) {
//       currentLocation.value = freshLocation;
//       await loadNearbyPlaces(freshLocation.latitude, freshLocation.longitude);
//     } else {
//       // Fallback to cached location if fresh location fails
//       if (currentLocation.value) {
//         await loadNearbyPlaces(
//           currentLocation.value.latitude,
//           currentLocation.value.longitude
//         );
//       } else {
//         await loadCurrentLocationAndPlaces();
//       }
//     }
//   } catch (error) {
//     console.error("Error refreshing location:", error);
//     // Fallback to existing behavior
//     if (currentLocation.value) {
//       await loadNearbyPlaces(
//         currentLocation.value.latitude,
//         currentLocation.value.longitude
//       );
//     } else {
//       await loadCurrentLocationAndPlaces();
//     }
//   }
// }

function toggleInputMode() {
  showManualInput.value = !showManualInput.value;

  if (showManualInput.value) {
    // Switching to manual input
    selectedPlace.value = "";
    manualPlaceName.value = "";
  } else {
    // Switching to dropdown
    selectedPlace.value = "";
    manualPlaceName.value = "";
  }
}

function triggerImageUpload() {
  // Ensure the file input is properly reset before opening
  if (fileInput.value) {
    fileInput.value.value = "";

    // Remove any existing handler first
    if (beforeUnloadHandler) {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    }

    // Add a temporary beforeunload handler to prevent page refreshes during camera capture
    beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    // Add the handler when opening camera
    window.addEventListener("beforeunload", beforeUnloadHandler);

    // Remove the handler after a delay (camera should be done by then)
    setTimeout(() => {
      if (beforeUnloadHandler) {
        window.removeEventListener("beforeunload", beforeUnloadHandler);
        beforeUnloadHandler = null;
      }
    }, 30000); // Remove after 30 seconds

    fileInput.value.click();
  }
}

async function handleImageUpload(event: Event) {
  // Prevent any default behavior that might cause page navigation
  event.preventDefault();
  event.stopPropagation();

  // Remove any beforeunload handlers that might have been added
  if (beforeUnloadHandler) {
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    beforeUnloadHandler = null;
  }

  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      showMessage("Please select an image file", "error");
      // Clear the file input to prevent any lingering state
      target.value = "";
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      showMessage(
        "Image file too large. Please select a file smaller than 5MB",
        "error"
      );
      // Clear the file input to prevent any lingering state
      target.value = "";
      return;
    }

    receiptImage.value = file;
    showMessage(`Receipt image attached: ${file.name}`, "success");

    // Keep the file input value to maintain the file reference
    // but ensure we don't trigger any unwanted behavior
  } else {
    // If no file was selected (user cancelled), clear the input
    target.value = "";
  }
}

async function submitExpense() {
  if (amount.value <= 0) {
    showMessage("Please enter a valid amount", "error");
    return;
  }

  // Validate location is provided (either manual input or selected place)
  if (showManualInput.value) {
    if (!manualPlaceName.value || manualPlaceName.value.trim() === "") {
      showMessage("Please enter a location name", "error");
      return;
    }
  } else {
    if (
      !selectedPlace.value ||
      (typeof selectedPlace.value === "string" &&
        selectedPlace.value.trim() === "")
    ) {
      showMessage("Please select a location", "error");
      return;
    }
  }

  isSubmitting.value = true;
  message.value = "";

  try {
    const location = currentLocation.value || (await getCurrentLocation());

    // Create timestamp: use current time for today's date, 12:00 PM for previous dates
    const today = new Date().toISOString().split("T")[0];
    const isToday = expenseDate.value === today;
    const timestamp = isToday 
      ? new Date() // Use current time for today
      : new Date(expenseDate.value + "T12:00:00"); // Use 12 PM for previous dates

    const expenseData = {
      amount: amount.value,
      latitude: location?.latitude,
      longitude: location?.longitude,
      place_id:
        typeof selectedPlace.value === "object"
          ? selectedPlace.value.id
          : undefined,
      place_name: showManualInput.value
        ? manualPlaceName.value.trim()
        : typeof selectedPlace.value === "object"
        ? selectedPlace.value.name
        : undefined,
      place_address:
        typeof selectedPlace.value === "object"
          ? selectedPlace.value.address
          : undefined,
      timestamp: timestamp,
    };

    if (import.meta.env.DEV) {
      console.log(
        "Saving expense with data:",
        JSON.stringify(expenseData, null, 2)
      );
    }

    // Step 1: Save the expense and get the ID
    const savedExpense = await databaseService.addExpense(expenseData);

    // Step 2: If there's an image, upload it separately
    if (receiptImage.value && savedExpense.id) {
      try {
        await databaseService.uploadExpenseImage(
          savedExpense.id,
          receiptImage.value
        );
        console.log("Image uploaded successfully for expense", savedExpense.id);
      } catch (imageError) {
        console.error("Failed to upload image:", imageError);
        // Show a warning but don't fail the whole operation
        showMessage(
          "Expense saved but image upload failed. Please try uploading the image again.",
          "error"
        );
        return; // Exit early to avoid showing success message
      }
    }

    const message = receiptImage.value
      ? "Expense and receipt image added successfully!"
      : "Expense added successfully!";
    showMessage(message, "success");
    amount.value = 0;
    expenseDate.value = new Date().toISOString().split("T")[0];

    // Reset location fields based on current mode
    if (showManualInput.value) {
      manualPlaceName.value = "";
    } else {
      // Reset dropdown to empty selection
      selectedPlace.value = "";
    }

    // Reset image
    receiptImage.value = null;
    if (fileInput.value) {
      fileInput.value.value = "";
    }

    emit("expenseAdded");
  } catch (error) {
    console.error("Error adding expense:", error);
    showMessage("Failed to add expense", "error");
  } finally {
    isSubmitting.value = false;
  }
}

function showMessage(text: string, type: "success" | "error") {
  message.value = text;
  messageType.value = type;
  setTimeout(() => {
    message.value = "";
  }, 3000);
}

async function loadAllPlaces() {
  try {
    allPlaces.value = await databaseService.getAllUniquePlaces();
  } catch (error) {
    console.error("Error loading places:", error);
  }
}

function onPlaceNameInput() {
  const inputValue = manualPlaceName.value.toLowerCase().trim();

  if (inputValue.length > 0) {
    filteredPlaces.value = allPlaces.value
      .filter((place) => place.toLowerCase().includes(inputValue))
      .slice(0, 5); // Limit to 5 suggestions
    showSuggestions.value = filteredPlaces.value.length > 0;
  } else {
    filteredPlaces.value = [];
    showSuggestions.value = false;
  }

  selectedSuggestionIndex.value = -1;
}

function onPlaceNameFocus() {
  if (manualPlaceName.value.trim()) {
    onPlaceNameInput();
  }
}

function onPlaceNameBlur() {
  // Delay hiding suggestions to allow for click events
  setTimeout(() => {
    showSuggestions.value = false;
    selectedSuggestionIndex.value = -1;
  }, 150);
}

function onPlaceNameKeydown(event: KeyboardEvent) {
  if (!showSuggestions.value || filteredPlaces.value.length === 0) return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      selectedSuggestionIndex.value = Math.min(
        selectedSuggestionIndex.value + 1,
        filteredPlaces.value.length - 1
      );
      break;
    case "ArrowUp":
      event.preventDefault();
      selectedSuggestionIndex.value = Math.max(
        selectedSuggestionIndex.value - 1,
        -1
      );
      break;
    case "Enter":
      if (selectedSuggestionIndex.value >= 0) {
        event.preventDefault();
        selectSuggestion(filteredPlaces.value[selectedSuggestionIndex.value]);
      }
      break;
    case "Escape":
      showSuggestions.value = false;
      selectedSuggestionIndex.value = -1;
      break;
  }
}

function selectSuggestion(place: string) {
  manualPlaceName.value = place;
  showSuggestions.value = false;
  selectedSuggestionIndex.value = -1;
}

function handleDateInputClick(event: Event) {
  const target = event.target as HTMLInputElement;
  try {
    // Try to trigger the date picker on mobile/modern browsers
    if (target.showPicker) {
      target.showPicker();
    }
  } catch (error) {
    // showPicker() might not be supported on all browsers/devices
    // The browser will handle the date input naturally in this case
    console.debug("showPicker not supported:", error);
  }
}

function handleFormKeydown(event: KeyboardEvent) {
  // Prevent Enter key from submitting the form when not intended
  // especially important for mobile browsers
  const target = event.target as HTMLElement;
  if (target.tagName === "INPUT" && target.getAttribute("type") === "file") {
    event.preventDefault();
    event.stopPropagation();
  }
}

onMounted(() => {
  loadCurrentLocationAndPlaces();
  loadAllPlaces();
});
</script>

<style scoped>
.expense-form {
  width: 100%;
  margin: 0;
}

.amount-input {
  flex: 2;
}

.date-input {
  flex: 1;
  min-width: 140px;
}

/* Date input dark theme styling */
input[type="date"] {
  color-scheme: dark;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
}

input[type="date"]::-webkit-calendar-picker-indicator {
  background-color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  filter: invert(1);
}

input[type="date"]::-moz-calendar-picker-indicator {
  background-color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.location-container {
  display: flex;
  gap: var(--spacing-sm);
  align-items: stretch;
}

.autocomplete-container {
  position: relative;
  flex: 1;
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-secondary);
  border-top: none;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
  z-index: var(--z-dropdown);
}

.suggestion-item {
  padding: var(--spacing-base);
  cursor: pointer;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-primary);
  transition: background-color var(--transition-base);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.highlighted {
  background-color: var(--bg-hover);
}

.suggestion-item.highlighted {
  background-color: var(--primary-blue);
  color: white;
}

.location-select,
.location-input {
  flex: 1;
  height: 44px;
  box-sizing: border-box;
}

.location-select:disabled {
  background-color: var(--bg-quaternary);
  color: var(--text-disabled);
  cursor: not-allowed;
}

.refresh-button,
.toggle-button,
.image-button {
  background: transparent;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  padding: var(--spacing-base);
  cursor: pointer;
  font-size: var(--font-size-md);
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
  touch-action: manipulation;
  flex-shrink: 0;
}

.refresh-button:hover:not(:disabled),
.toggle-button:hover,
.image-button:hover {
  background: var(--bg-hover);
  border-color: var(--primary-blue);
  color: var(--primary-blue);
}

.refresh-button:disabled {
  background: transparent;
  border-color: var(--border-primary);
  color: var(--text-disabled);
  cursor: not-allowed;
}

.refresh-button:active,
.toggle-button:active,
.image-button:active {
  transform: scale(0.95);
}

.selected-place-info {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  border-left: 3px solid var(--primary-blue);
}

/* Mobile optimizations */
@media (max-width: 480px) {
  .amount-date-container {
    flex-direction: column;
  }

  .amount-input,
  .date-input {
    flex: 1;
  }
}
</style>
