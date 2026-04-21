/**
 * Booking Map Management - Clean Version
 * Handles Google Maps integration for booking page
 */

// Global variables with conflict prevention
if (typeof window.bookingMap === "undefined") {
  window.bookingMap = null;
}
if (typeof window.bookingMarker === "undefined") {
  window.bookingMarker = null;
}
if (typeof window.bookingAutocomplete === "undefined") {
  window.bookingAutocomplete = null;
}
if (typeof window.bookingGeocoder === "undefined") {
  window.bookingGeocoder = null;
}
if (typeof window.isBookingMapInitialized === "undefined") {
  window.isBookingMapInitialized = false;
}

let bookingMap = window.bookingMap;
let bookingMarker = window.bookingMarker;
let bookingAutocomplete = window.bookingAutocomplete;
let bookingGeocoder = window.bookingGeocoder;
let isBookingMapInitialized = window.isBookingMapInitialized;

// Configuration
const BOOKING_MAP_CONFIG = {
  defaultLocation: {lat: 18.4088, lng: 76.5604},
  zoom: 13,
  mapTypeId: "roadmap",
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  gestureHandling: "cooperative",
};

// Prevent duplicate event listeners
if (!window.bookingMapListenersAdded) {
  document.addEventListener("DOMContentLoaded", initBookingMapWhenReady);
  document.addEventListener("google-maps-loaded", initBookingMapWhenReady);
  window.bookingMapListenersAdded = true;
}

/**
 * Initialize booking map when API is ready
 */
function initBookingMapWhenReady() {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  if (typeof google === "undefined" || !google.maps) {
    if (
      typeof window.loadGoogleMapsAPI === "function" &&
      !window.googleMapsLoading
    ) {
      const apiKey = getValidAPIKey();
      if (!apiKey) {
        showBookingMapError("Google Maps API key is not configured.");
        return;
      }

      window
        .loadGoogleMapsAPI(apiKey)
        .then(() => initBookingMapWhenReady())
        .catch(handleAPILoadError);
    } else {
      setTimeout(initBookingMapWhenReady, 1000);
    }
    return;
  }

  if (window.isBookingMapInitialized) return;

  try {
    initializeBookingMap();
  } catch (error) {
    handleMapInitError(error);
  }
}

/**
 * Get valid API key
 */
function getValidAPIKey() {
  const metaApiKey = document.querySelector(
    'meta[name="google-maps-api-key"]'
  )?.content;
  if (metaApiKey && metaApiKey.startsWith("AIza") && metaApiKey.length > 20) {
    return metaApiKey;
  }

  if (
    window.GOOGLE_MAPS_API_KEY &&
    window.GOOGLE_MAPS_API_KEY.startsWith("AIza")
  ) {
    return window.GOOGLE_MAPS_API_KEY;
  }

  return null;
}

/**
 * Handle API loading errors
 */
function handleAPILoadError(error) {
  let errorMessage = "Failed to load Google Maps. ";

  if (error.message?.includes("InvalidKey")) {
    errorMessage += "The API key is invalid.";
  } else if (error.message?.includes("RequestDenied")) {
    errorMessage += "API access denied.";
  } else {
    errorMessage += "Please check your connection and refresh.";
  }

  showBookingMapError(errorMessage);
}

/**
 * Handle map initialization errors
 */
function handleMapInitError(error) {
  let errorMessage = "Error initializing map. ";

  if (error.message?.includes("InvalidKey")) {
    errorMessage += "Invalid API key.";
  } else if (error.message?.includes("QuotaExceeded")) {
    errorMessage += "API quota exceeded.";
  } else {
    errorMessage += "Please refresh the page.";
  }

  showBookingMapError(errorMessage);
}

/**
 * Initialize the booking map
 */
function initializeBookingMap() {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  mapElement.innerHTML = "";

  try {
    bookingMap = new google.maps.Map(mapElement, {
      center: BOOKING_MAP_CONFIG.defaultLocation,
      zoom: BOOKING_MAP_CONFIG.zoom,
      mapTypeId: BOOKING_MAP_CONFIG.mapTypeId,
      mapTypeControl: BOOKING_MAP_CONFIG.mapTypeControl,
      streetViewControl: BOOKING_MAP_CONFIG.streetViewControl,
      fullscreenControl: BOOKING_MAP_CONFIG.fullscreenControl,
      gestureHandling: BOOKING_MAP_CONFIG.gestureHandling,
    });

    window.bookingMap = bookingMap;

    google.maps.event.addListenerOnce(bookingMap, "idle", function () {
      bookingMarker = new google.maps.Marker({
        map: bookingMap,
        position: BOOKING_MAP_CONFIG.defaultLocation,
        draggable: true,
        animation: google.maps.Animation.DROP,
        title: "Your Service Location",
      });

      window.bookingMarker = bookingMarker;

      bookingGeocoder = new google.maps.Geocoder();
      window.bookingGeocoder = bookingGeocoder;

      initializeBookingAutocomplete();
      setupBookingMapEventListeners();

      isBookingMapInitialized = true;
      window.isBookingMapInitialized = true;

      hideBookingMapError();
    });
  } catch (error) {
    handleMapInitError(error);
  }
}

/**
 * Initialize autocomplete for address input
 */
function initializeBookingAutocomplete() {
  const addressInput = document.getElementById("address-input");
  if (!addressInput) return;

  try {
    if (!google.maps.places?.Autocomplete) return;

    bookingAutocomplete = new google.maps.places.Autocomplete(addressInput, {
      componentRestrictions: {country: "in"},
      types: ["geocode"],
      fields: [
        "geometry",
        "formatted_address",
        "place_id",
        "address_components",
      ],
    });

    window.bookingAutocomplete = bookingAutocomplete;
    bookingAutocomplete.bindTo("bounds", bookingMap);
    bookingAutocomplete.addListener("place_changed", handleBookingPlaceChange);
  } catch (error) {
    // Silently fail if autocomplete can't be initialized
  }
}

/**
 * Setup event listeners for map interactions
 */
function setupBookingMapEventListeners() {
  if (!bookingMap || !bookingMarker) return;

  google.maps.event.addListener(bookingMarker, "dragend", function () {
    const position = bookingMarker.getPosition();
    const lat = position.lat();
    const lng = position.lng();

    updateBookingCoordinates(lat, lng);
    performBookingReverseGeocode(lat, lng);
  });

  google.maps.event.addListener(bookingMap, "click", function (event) {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    bookingMarker.setPosition(event.latLng);
    updateBookingCoordinates(lat, lng);
    performBookingReverseGeocode(lat, lng);
  });
}

/**
 * Handle autocomplete place selection
 */
function handleBookingPlaceChange() {
  const place = bookingAutocomplete.getPlace();

  if (!place.geometry?.location) {
    showBookingAlert(
      "error",
      "Please select a valid address from the suggestions"
    );
    return;
  }

  const location = place.geometry.location;
  const lat = location.lat();
  const lng = location.lng();

  bookingMap.setCenter(location);
  bookingMap.setZoom(17);
  bookingMarker.setPosition(location);

  updateBookingCoordinates(lat, lng);

  const detailedAddressInput = document.getElementById("detailed-address");
  if (detailedAddressInput && !detailedAddressInput.value.trim()) {
    detailedAddressInput.value = place.formatted_address;
  }

  showBookingAlert("success", "Location selected successfully!");
}

/**
 * Update coordinate form fields
 */
function updateBookingCoordinates(lat, lng) {
  let latInput = document.getElementById("latitude");
  let lngInput = document.getElementById("longitude");

  if (!latInput) {
    latInput = document.createElement("input");
    latInput.type = "hidden";
    latInput.id = "latitude";
    latInput.name = "latitude";
    document.getElementById("bookingForm")?.appendChild(latInput);
  }

  if (!lngInput) {
    lngInput = document.createElement("input");
    lngInput.type = "hidden";
    lngInput.id = "longitude";
    lngInput.name = "longitude";
    document.getElementById("bookingForm")?.appendChild(lngInput);
  }

  latInput.value = lat.toFixed(6);
  lngInput.value = lng.toFixed(6);
}

/**
 * Perform reverse geocoding to get address from coordinates
 */
function performBookingReverseGeocode(lat, lng) {
  if (!bookingGeocoder) return;

  const latlng = {lat: lat, lng: lng};

  bookingGeocoder.geocode({location: latlng}, (results, status) => {
    if (status === "OK" && results?.[0]) {
      const addressInput = document.getElementById("address-input");
      const detailedAddressInput = document.getElementById("detailed-address");

      if (addressInput) {
        addressInput.value = results[0].formatted_address;
        addressInput.classList.remove("is-invalid");
        addressInput.classList.add("is-valid");
      }

      if (detailedAddressInput && !detailedAddressInput.value.trim()) {
        detailedAddressInput.value = results[0].formatted_address;
        detailedAddressInput.classList.remove("is-invalid");
        detailedAddressInput.classList.add("is-valid");
      }
    }
  });
}

/**
 * Enhanced geolocation with multiple fallback strategies
 */
async function getCurrentLocationForBooking() {
  // Prevent multiple simultaneous location requests
  if (window.locationDetectionInProgress) return;
  window.locationDetectionInProgress = true;

  if (!navigator.geolocation) {
    showBookingAlert("error", "Geolocation is not supported by your browser");
    window.locationDetectionInProgress = false;
    return;
  }

  const button = document.getElementById("fetch-location-btn");
  if (!button) {
    window.locationDetectionInProgress = false;
    return;
  }

  // Show loading state
  const originalText = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Detecting...';

  // Clear previous states
  const addressInput = document.getElementById("address-input");
  if (addressInput) {
    addressInput.value = "";
    addressInput.classList.remove("is-invalid", "is-valid");
  }

  document
    .querySelectorAll(".location-alert")
    .forEach((alert) => alert.remove());

  try {
    // Strategy 1: Try optimized GPS detection
    const position = await tryOptimizedGeolocation();

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    // Update map and form
    if (bookingMap && bookingMarker) {
      const pos = {lat, lng};
      bookingMap.setCenter(pos);
      bookingMap.setZoom(17);
      bookingMarker.setPosition(pos);
    }

    updateBookingCoordinates(lat, lng);
    performBookingReverseGeocode(lat, lng);

    showBookingAlert(
      "success",
      `Location detected successfully! (±${Math.round(accuracy)}m)`
    );
  } catch (gpsError) {
    try {
      // Strategy 2: Fallback to IP-based location
      const ipLocation = await tryIPGeolocation();

      if (bookingMap && bookingMarker) {
        const pos = {lat: ipLocation.lat, lng: ipLocation.lng};
        bookingMap.setCenter(pos);
        bookingMap.setZoom(15); // Slightly zoomed out for IP location
        bookingMarker.setPosition(pos);
      }

      updateBookingCoordinates(ipLocation.lat, ipLocation.lng);
      performBookingReverseGeocode(ipLocation.lat, ipLocation.lng);

      showBookingAlert(
        "success",
        `Approximate location: ${ipLocation.city}, ${ipLocation.region}`
      );
    } catch (ipError) {
      // Strategy 3: Show manual input option
      handleLocationFailure();
    }
  } finally {
    // Reset button state
    button.disabled = false;
    button.innerHTML = originalText;
    window.locationDetectionInProgress = false;
  }
}

/**
 * Try optimized geolocation for better compatibility
 */
function tryOptimizedGeolocation() {
  return new Promise((resolve, reject) => {
    // Single attempt with Safari/iOS optimized settings
    const options = {
      enableHighAccuracy: false, // Better for indoor/desktop environments
      timeout: 10000, // Reasonable timeout
      maximumAge: 300000, // 5 minutes cache
    };

    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Try IP-based geolocation as fallback
 */
async function tryIPGeolocation() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.latitude && data.longitude && !data.error) {
      return {
        lat: parseFloat(data.latitude),
        lng: parseFloat(data.longitude),
        city: data.city || "Unknown",
        region: data.region || "Unknown",
      };
    } else {
      throw new Error(data.reason || "No location data available");
    }
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Handle complete location detection failure
 */
function handleLocationFailure() {
  showBookingAlert(
    "warning",
    "Could not detect location automatically. Please search and select your location manually using the search box above."
  );

  // Focus on address input for manual entry
  const addressInput = document.getElementById("address-input");
  if (addressInput) {
    addressInput.focus();
    addressInput.placeholder = "Please enter your address manually...";
  }
}

/**
 * Show alert messages for booking map
 */
function showBookingAlert(type, message) {
  document
    .querySelectorAll(".location-alert")
    .forEach((alert) => alert.remove());

  const alertClass =
    type === "success"
      ? "alert-success"
      : type === "warning"
      ? "alert-warning"
      : "alert-danger";
  const icon =
    type === "success"
      ? "fa-check-circle"
      : type === "warning"
      ? "fa-exclamation-triangle"
      : "fa-exclamation-circle";

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert ${alertClass} location-alert mt-2 fade show`;
  alertDiv.innerHTML = `<i class="fas ${icon} me-2"></i>${message}`;

  const mapSection = document.getElementById("map-section");
  if (mapSection) {
    mapSection.appendChild(alertDiv);
  } else {
    const mapElement = document.getElementById("map");
    if (mapElement?.parentNode) {
      mapElement.parentNode.insertBefore(alertDiv, mapElement.nextSibling);
    }
  }

  const timeout = type === "error" ? 8000 : type === "warning" ? 6000 : 4000;
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.classList.remove("show");
      setTimeout(() => alertDiv.remove(), 150);
    }
  }, timeout);
}

/**
 * Show map error message
 */
function showBookingMapError(message) {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  mapElement.innerHTML = `
    <div class="alert alert-danger text-center p-4 m-0 h-100 d-flex flex-column justify-content-center">
      <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
      <h6 class="alert-heading">Map Configuration Error</h6>
      <p class="mb-3">${message}</p>
      <div class="mt-3">
        <button class="btn btn-primary btn-sm me-2" onclick="location.reload()">
          <i class="fas fa-refresh me-1"></i>Refresh Page
        </button>
        <button class="btn btn-outline-secondary btn-sm" onclick="initBookingMapWhenReady()">
          <i class="fas fa-redo me-1"></i>Retry
        </button>
      </div>
    </div>
  `;

  const errorDiv = document.getElementById("map-error");
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove("d-none");
  }
}

/**
 * Hide map error message
 */
function hideBookingMapError() {
  const errorDiv = document.getElementById("map-error");
  if (errorDiv) {
    errorDiv.classList.add("d-none");
  }
}

/**
 * Validate booking location before form submission
 */
function validateBookingLocation() {
  const addressInput = document.getElementById("address-input");
  const detailedAddress = document.getElementById("detailed-address");
  const latitude = document.getElementById("latitude");
  const longitude = document.getElementById("longitude");

  let isValid = true;
  const errors = [];

  if (!addressInput?.value.trim()) {
    addressInput?.classList.add("is-invalid");
    errors.push("Please enter a service location");
    isValid = false;
  } else {
    addressInput?.classList.remove("is-invalid");
    addressInput?.classList.add("is-valid");
  }

  if (!detailedAddress?.value.trim()) {
    detailedAddress?.classList.add("is-invalid");
    errors.push("Please provide detailed address information");
    isValid = false;
  } else {
    detailedAddress?.classList.remove("is-invalid");
    detailedAddress?.classList.add("is-valid");
  }

  if (!latitude?.value || !longitude?.value) {
    errors.push("Please select a location on the map or use current location");
    isValid = false;
  }

  if (!isValid) {
    showBookingAlert("error", errors.join(". "));
  }

  return isValid;
}

/**
 * Reset booking map to default state
 */
function resetBookingMap() {
  if (bookingMap && bookingMarker) {
    bookingMap.setCenter(BOOKING_MAP_CONFIG.defaultLocation);
    bookingMap.setZoom(BOOKING_MAP_CONFIG.zoom);
    bookingMarker.setPosition(BOOKING_MAP_CONFIG.defaultLocation);

    const addressInput = document.getElementById("address-input");
    const detailedAddress = document.getElementById("detailed-address");
    const latitude = document.getElementById("latitude");
    const longitude = document.getElementById("longitude");

    if (addressInput) {
      addressInput.value = "";
      addressInput.classList.remove("is-valid", "is-invalid");
    }
    if (detailedAddress) {
      detailedAddress.value = "";
      detailedAddress.classList.remove("is-valid", "is-invalid");
    }
    if (latitude) latitude.value = "";
    if (longitude) longitude.value = "";
  }
}

/**
 * Process location coordinates (for external use)
 */
function processLocation(lat, lng) {
  if (bookingMap && bookingMarker) {
    const pos = {lat, lng};
    bookingMap.setCenter(pos);
    bookingMap.setZoom(17);
    bookingMarker.setPosition(pos);
  }

  updateBookingCoordinates(lat, lng);
  performBookingReverseGeocode(lat, lng);
}

// Export functions for global access
if (!window.bookingMapManager) {
  window.bookingMapManager = {
    initBookingMapWhenReady,
    getCurrentLocationForBooking,
    validateBookingLocation,
    resetBookingMap,
    showBookingAlert,
    processLocation,
    isInitialized: () => window.isBookingMapInitialized,
  };
}

// Export individual functions for backward compatibility
if (!window.getCurrentLocationForBooking) {
  window.getCurrentLocationForBooking = getCurrentLocationForBooking;
}
if (!window.validateBookingLocation) {
  window.validateBookingLocation = validateBookingLocation;
}
