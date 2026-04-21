/**
 * Map initialization script
 * Centralized Google Maps API loader with modern APIs
 */

// Global variables to track API state
window.googleMapsLoaded = false;
window.googleMapsLoading = false;
window.mapsCallbacks = [];
window.googleMapsApiKey = null;
window.googleMapsId = null;

// Add a function to suppress specific deprecation warnings
window.suppressGoogleMapsWarnings = function () {
  const originalWarn = console.warn;
  console.warn = function (...args) {
    const message = args.join(" ");

    // Skip known Google Maps deprecation warnings that we're aware of
    if (
      message.includes("google.maps.Marker is deprecated") ||
      message.includes("google.maps.places.Autocomplete is not available") ||
      message.includes("Use google.maps.marker.AdvancedMarkerElement") ||
      message.includes("Use google.maps.places.PlaceAutocompleteElement") ||
      message.includes("As of February 21st, 2024") ||
      message.includes("As of March 1st, 2025") ||
      message.includes("The map is initialized without a valid Map ID")
    ) {
      return; // Skip these warnings
    }

    // Allow all other warnings
    originalWarn.apply(console, args);
  };
};

// Call warning suppression immediately
if (typeof window !== "undefined") {
  window.suppressGoogleMapsWarnings();
}

// Callback function for Google Maps API
function initGoogleMapsAPI() {
  window.googleMapsLoaded = true;
  window.googleMapsLoading = false;

  // Execute any callbacks that were registered before the API loaded
  while (window.mapsCallbacks.length > 0) {
    const callback = window.mapsCallbacks.shift();
    try {
      callback();
    } catch (error) {
      // Silent error handling
    }
  }

  // Dispatch an event that other scripts can listen for
  document.dispatchEvent(new CustomEvent("google-maps-loaded"));
}

// Register a callback to execute when maps API is loaded
window.waitForGoogleMaps = function (callback) {
  if (typeof callback !== "function") {
    return;
  }

  if (window.googleMapsLoaded) {
    try {
      callback();
    } catch (error) {
      // Silent error handling
    }
  } else {
    window.mapsCallbacks.push(callback);
  }
};

// Main function to load Google Maps API with modern libraries
window.loadGoogleMapsAPI = function (apiKey, mapId) {
  if (!apiKey || typeof apiKey !== "string") {
    return Promise.reject(new Error("Invalid API key"));
  }

  // Only set API key if not already set
  if (!window.googleMapsApiKey) {
    window.googleMapsApiKey = apiKey;
  }

  // Only set Map ID if we have a valid one and don't already have one
  if (mapId && mapId.trim() && mapId !== "undefined" && mapId !== "null") {
    if (!window.googleMapsId) {
      window.googleMapsId = mapId;
    } else if (window.googleMapsId !== mapId) {
      window.googleMapsId = mapId;
    }
  } else if (!window.googleMapsId) {
    // Only set to null if we don't already have a Map ID
    window.googleMapsId = null;
  }

  if (window.googleMapsLoaded && typeof google !== "undefined" && google.maps) {
    return Promise.resolve();
  }

  if (window.googleMapsLoading) {
    return new Promise((resolve) => {
      window.waitForGoogleMaps(resolve);
    });
  }

  const existingScript = document.querySelector(
    'script[src*="maps.googleapis.com/maps/api/js"]'
  );
  if (existingScript) {
    window.googleMapsLoading = true;
    return new Promise((resolve) => {
      window.waitForGoogleMaps(resolve);
    });
  }

  window.googleMapsLoading = true;

  return new Promise((resolve, reject) => {
    window.waitForGoogleMaps(resolve);

    const script = document.createElement("script");

    // Include both places and marker libraries for modern APIs
    const params = new URLSearchParams({
      key: apiKey,
      libraries: "places,marker",
      callback: "initGoogleMapsAPI",
      loading: "async",
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.type = "text/javascript";

    script.onerror = function (error) {
      window.googleMapsLoading = false;
      reject(new Error("Failed to load Google Maps API"));
    };

    document.head.appendChild(script);
  });
};

// Helper function to validate Map ID
window.hasValidMapId = function () {
  const mapId = window.googleMapsId;
  const isValid =
    mapId &&
    typeof mapId === "string" &&
    mapId.trim() !== "" &&
    mapId !== "undefined" &&
    mapId !== "null";

  return isValid;
};

// Helper function to check if Advanced Markers are available
window.hasAdvancedMarkers = function () {
  return !!(
    typeof google !== "undefined" &&
    google.maps &&
    google.maps.marker &&
    google.maps.marker.AdvancedMarkerElement
  );
};

// Helper function to check if Modern Autocomplete is available
window.hasModernAutocomplete = function () {
  return !!(
    typeof google !== "undefined" &&
    google.maps &&
    google.maps.places &&
    google.maps.places.PlaceAutocompleteElement
  );
};

// Modern marker creation function using AdvancedMarkerElement
window.createAdvancedMarker = function (options = {}) {
  if (!window.googleMapsLoaded || !window.hasAdvancedMarkers()) {
    return null;
  }

  if (!window.hasValidMapId()) {
    return null;
  }

  const {position, map, title, draggable = false, onDragEnd} = options;

  if (!map || !position) {
    return null;
  }

  try {
    const markerOptions = {
      position,
      map,
      gmpDraggable: draggable,
    };

    if (title) markerOptions.title = title;

    const marker = new google.maps.marker.AdvancedMarkerElement(markerOptions);

    // Add drag event listener if provided
    if (draggable && onDragEnd && typeof onDragEnd === "function") {
      marker.addListener("dragend", onDragEnd);
    }

    return marker;
  } catch (error) {
    return null;
  }
};

// Legacy marker creation function
window.createLegacyMarker = function (options = {}) {
  const {
    position,
    map,
    title,
    draggable = false,
    onDragEnd,
    animation,
  } = options;

  if (!map || !position) {
    return null;
  }

  try {
    const marker = new google.maps.Marker({
      position,
      map,
      title,
      draggable,
      animation: animation || google.maps.Animation.DROP,
    });

    // Add drag event listener if provided
    if (draggable && onDragEnd && typeof onDragEnd === "function") {
      google.maps.event.addListener(marker, "dragend", onDragEnd);
    }

    return marker;
  } catch (error) {
    return null;
  }
};

// Smart marker creation that chooses the best available option
window.createMarker = function (options = {}) {
  // Check conditions for Advanced Markers
  const canUseAdvanced = window.hasAdvancedMarkers() && window.hasValidMapId();

  // Try Advanced Marker first if conditions are met
  if (canUseAdvanced) {
    const advancedMarker = window.createAdvancedMarker(options);
    if (advancedMarker) {
      return advancedMarker;
    }
  }

  // Fall back to Legacy Marker
  return window.createLegacyMarker(options);
};

// Modern autocomplete creation using PlaceAutocompleteElement
window.createModernAutocomplete = function (inputElement, options = {}) {
  if (!inputElement) {
    return null;
  }

  if (!window.hasModernAutocomplete()) {
    return null;
  }

  try {
    const autocompleteElement = new google.maps.places.PlaceAutocompleteElement(
      {
        componentRestrictions: options.componentRestrictions || {country: "in"},
        types: options.types || ["geocode"],
      }
    );

    // Store reference to original input for form handling
    autocompleteElement.originalInput = inputElement;

    // Copy important attributes from original input
    if (inputElement.id) autocompleteElement.id = inputElement.id;
    if (inputElement.className)
      autocompleteElement.className = inputElement.className;
    if (inputElement.placeholder)
      autocompleteElement.placeholder = inputElement.placeholder;

    // Replace the input element with the autocomplete element
    inputElement.parentNode.replaceChild(autocompleteElement, inputElement);

    // Add event listener for place selection
    if (
      options.onPlaceChanged &&
      typeof options.onPlaceChanged === "function"
    ) {
      autocompleteElement.addEventListener("gmp-placeselect", (event) => {
        const place = event.place;
        options.onPlaceChanged(place);
      });
    }

    return autocompleteElement;
  } catch (error) {
    return null;
  }
};

// Legacy autocomplete creation
window.createLegacyAutocomplete = function (inputElement, options = {}) {
  if (!inputElement) {
    return null;
  }

  try {
    const autocomplete = new google.maps.places.Autocomplete(inputElement, {
      types: options.types || ["geocode"],
      componentRestrictions: options.componentRestrictions || {country: "in"},
      fields: ["place_id", "geometry", "name", "formatted_address"],
    });

    if (
      options.onPlaceChanged &&
      typeof options.onPlaceChanged === "function"
    ) {
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        options.onPlaceChanged(place);
      });
    }

    return autocomplete;
  } catch (error) {
    return null;
  }
};

// Smart autocomplete creation that chooses the best available option
window.createAutocomplete = function (inputElement, options = {}) {
  const canUseModern = window.hasModernAutocomplete();

  // Try Modern Autocomplete first if available
  if (canUseModern) {
    const modernAutocomplete = window.createModernAutocomplete(
      inputElement,
      options
    );
    if (modernAutocomplete) {
      return modernAutocomplete;
    }
  }

  // Fall back to Legacy Autocomplete
  return window.createLegacyAutocomplete(inputElement, options);
};

// Helper function to create a standard map
window.createStandardMap = function (element, options = {}) {
  if (!element) {
    return null;
  }

  if (!window.isGoogleMapsReady()) {
    return null;
  }

  const defaultOptions = {
    zoom: 10,
    center: {lat: 20.5937, lng: 78.9629},
    mapTypeControl: true,
    streetViewControl: true,
    fullscreenControl: true,
  };

  const mapOptions = {...defaultOptions, ...options};

  try {
    const map = new google.maps.Map(element, mapOptions);
    return map;
  } catch (error) {
    return null;
  }
};

// Helper function to create a map with advanced features
window.createAdvancedMap = function (element, options = {}) {
  if (!element) {
    return null;
  }

  if (!window.isGoogleMapsReady()) {
    return null;
  }

  if (!window.hasValidMapId()) {
    return window.createStandardMap(element, options);
  }

  const defaultOptions = {
    zoom: 10,
    center: {lat: 20.5937, lng: 78.9629},
    mapTypeControl: true,
    streetViewControl: true,
    fullscreenControl: true,
  };

  const mapOptions = {
    ...defaultOptions,
    ...options,
    mapId: window.googleMapsId,
  };

  try {
    const map = new google.maps.Map(element, mapOptions);
    return map;
  } catch (error) {
    return window.createStandardMap(element, options);
  }
};

// Helper function to create a map with automatic fallback
window.createMap = function (element, options = {}) {
  if (!element) {
    return null;
  }

  // Clear any loading content first
  if (element.innerHTML) {
    element.innerHTML = "";
  }

  let map = null;

  // Try Advanced Map first if we have a valid Map ID
  if (window.hasValidMapId()) {
    map = window.createAdvancedMap(element, options);
  }

  // If Advanced Map failed or no Map ID, use Standard Map
  if (!map) {
    map = window.createStandardMap(element, options);
  }

  return map;
};

// Helper function to check if Google Maps API is ready
window.isGoogleMapsReady = function () {
  return (
    window.googleMapsLoaded && typeof google !== "undefined" && google.maps
  );
};

// Helper function to get current API status
window.getGoogleMapsStatus = function () {
  return {
    loaded: window.googleMapsLoaded,
    loading: window.googleMapsLoading,
    apiKey: window.googleMapsApiKey
      ? "***" + window.googleMapsApiKey.slice(-4)
      : null,
    mapId: window.googleMapsId,
    callbacksQueued: window.mapsCallbacks.length,
    advancedMarkersAvailable: window.hasAdvancedMarkers(),
    modernAutocompleteAvailable: window.hasModernAutocomplete(),
  };
};

// Validation function to check if map configuration is correct
window.validateMapConfiguration = function () {
  const config = {
    hasApiKey: !!window.googleMapsApiKey,
    hasMapId: window.hasValidMapId(),
    mapsLoaded: window.googleMapsLoaded,
    advancedMarkersReady: window.hasAdvancedMarkers(),
    modernAutocompleteReady: window.hasModernAutocomplete(),
  };

  return config;
};

// Utility function to check if modern APIs are available
window.hasModernGoogleMapsAPIs = function () {
  return window.hasAdvancedMarkers() && window.hasModernAutocomplete();
};

// Enhanced debug function
window.debugMaps = function () {
  return window.getGoogleMapsStatus();
};

// Initialize callbacks array if not exists
if (!Array.isArray(window.mapsCallbacks)) {
  window.mapsCallbacks = [];
}

// Clean up function for page unload
window.addEventListener("beforeunload", function () {
  window.mapsCallbacks = [];
});

// Expose initGoogleMapsAPI globally for the callback
window.initGoogleMapsAPI = initGoogleMapsAPI;

// Function to force enable modern APIs (for testing)
window.enableModernGoogleMapsAPIs = function () {
  return window.hasModernGoogleMapsAPIs();
};
