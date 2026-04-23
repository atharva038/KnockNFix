(function () {
  // KNFCore utilities — available because core scripts load before this file
  var _api    = (window.KNFCore && window.KNFCore.api)    || null;
  var _notify = (window.KNFCore && window.KNFCore.notify) || null;

  function showToast(type, message) {
    if (_notify && typeof _notify[type] === 'function') return _notify[type](message);
    if (_notify && type === 'error' && typeof _notify.error === 'function') return _notify.error(message);
    alert(message);
  }

  // Global variables
  let map = null;
  let marker = null;
  let circle = null;
  let geocoder = null;
  let autocomplete = null;
  let detectLocationBtn = null;
  let mapContainer = null;
  let addLocationBtn = null;
  let serviceAreaMarkers = [];
  let isInitialized = false;

  // Initialize once DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    // Get element references
    mapContainer = document.getElementById("location-map");
    detectLocationBtn = document.getElementById("detect-location-btn");
    addLocationBtn = document.getElementById("add-location-btn");

    // Set up travel fee toggle
    setupTravelFeeToggle();

    // Set up location detection
    if (detectLocationBtn) {
      detectLocationBtn.addEventListener("click", detectCurrentLocation);
    }

    // Set up add location button
    if (addLocationBtn) {
      addLocationBtn.addEventListener("click", addLocation);
    }

    // Wait for Google Maps to be available
    waitForGoogleMaps();

    // Handle location section visibility changes
    setupVisibilityHandler();
  });

  // Wait for Google Maps API to be available
  function waitForGoogleMaps(retryCount = 0) {
    if (typeof google !== "undefined" && google.maps && google.maps.Map) {
      initializeMap();
      return;
    }

    // Check if we have the API key
    if (!window.googleMapsApiKey) {
      showMapError("Google Maps API key not configured");
      return;
    }

    // Try to load the API if it's not loaded
    if (retryCount === 0 && typeof window.loadGoogleMapsAPI === "function") {
      window
        .loadGoogleMapsAPI(window.googleMapsApiKey, window.googleMapsId)
        .then(() => {
          initializeMap();
        })
        .catch((error) => {
          showMapError("Failed to load Google Maps: " + error.message);
        });
      return;
    }

    // Retry up to 10 times with increasing delays
    if (retryCount < 10) {
      const delay = Math.min(1000 * Math.pow(1.5, retryCount), 5000);
      setTimeout(() => waitForGoogleMaps(retryCount + 1), delay);
    } else {
      showMapError("Google Maps failed to load. Please refresh the page.");
    }
  }

  // Set up travel fee toggle functionality
  function setupTravelFeeToggle() {
    const travelFeeToggle = document.getElementById("travel-fee-toggle");
    const travelFeeOptions = document.getElementById("travel-fee-options");

    if (travelFeeToggle && travelFeeOptions) {
      travelFeeToggle.addEventListener("change", function () {
        travelFeeOptions.style.display = this.checked ? "block" : "none";
      });
    }
  }

  // Set up visibility handler for the locations section
  function setupVisibilityHandler() {
    const locationsSection = document.getElementById("locations-section");
    if (!locationsSection) return;

    // Create a MutationObserver to watch for style changes
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.attributeName === "style") {
          const isVisible = locationsSection.style.display !== "none";
          if (isVisible && !map) {
            waitForGoogleMaps();
          } else if (isVisible && map) {
            // Trigger a resize to ensure maps render correctly when section becomes visible
            setTimeout(() => {
              google.maps.event.trigger(map, "resize");
            }, 100);
          }
        }
      });
    });

    // Start observing
    observer.observe(locationsSection, {
      attributes: true,
      attributeFilter: ["style"],
    });

    // Check current visibility
    if (locationsSection.style.display !== "none" && !map) {
      waitForGoogleMaps();
    }
  }

  // Function to initialize the map
  function initializeMap() {
    // Don't initialize again if already done
    if (isInitialized || map || !mapContainer) {
      return;
    }

    if (typeof google === "undefined" || !google.maps) {
      showMapError("Google Maps API not available");
      return;
    }

    try {
      // Show loading indicator
      mapContainer.innerHTML = `
        <div class="map-loading">
          <div class="text-center">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2 small text-muted">Initializing map...</div>
          </div>
        </div>
      `;

      // Initialize geocoder
      geocoder = new google.maps.Geocoder();

      // Default location (center of India)
      const defaultLocation = {lat: 20.5937, lng: 78.9629};

      // Create map options
      const mapOptions = {
        center: defaultLocation,
        zoom: 5,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_LEFT,
        },
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true,
        scaleControl: true,
      };

      // Add Map ID if available for advanced features
      if (window.googleMapsId && window.googleMapsId.trim()) {
        mapOptions.mapId = window.googleMapsId;
      }

      // Create the map
      map = new google.maps.Map(mapContainer, mapOptions);

      // Create marker
      marker = new google.maps.Marker({
        position: defaultLocation,
        map: map,
        draggable: true,
        animation: google.maps.Animation.DROP,
        title: "Service Location",
      });

      // Add marker drag event
      google.maps.event.addListener(marker, "dragend", function () {
        handleMarkerDragEnd();
      });

      // Create circle to represent service area
      circle = new google.maps.Circle({
        strokeColor: "#0d6efd",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#0d6efd",
        fillOpacity: 0.15,
        map: map,
        center: defaultLocation,
        radius: 10000, // 10km in meters
      });

      // Initialize autocomplete
      const locationInput = document.getElementById("new-location");
      if (locationInput) {
        setupAutocomplete(locationInput);
      }

      // Set up event listeners
      setupEventListeners();

      // If we have service areas, show them on the map
      if (window.providerData && window.providerData.serviceAreas) {
        renderServiceAreas();
      }

      // Trigger a resize after initialization
      setTimeout(() => {
        google.maps.event.trigger(map, "resize");
      }, 500);

      isInitialized = true;
    } catch (error) {
      showMapError("Map initialization failed: " + error.message);
    }
  }

  // Handle marker drag end
  function handleMarkerDragEnd() {
    const position = marker.getPosition();
    if (position && circle) {
      const lat = position.lat();
      const lng = position.lng();
      circle.setCenter({lat, lng});
      updateLocationInputFromPosition({lat, lng});
    }
  }

  // Setup autocomplete
  function setupAutocomplete(inputElement) {
    try {
      autocomplete = new google.maps.places.Autocomplete(inputElement, {
        types: ["geocode"],
        componentRestrictions: {country: "IN"},
        fields: ["place_id", "geometry", "name", "formatted_address"],
      });

      // Bind to map bounds for better results
      autocomplete.bindTo("bounds", map);

      autocomplete.addListener("place_changed", function () {
        const place = autocomplete.getPlace();
        handlePlaceSelection(place, inputElement);
      });
    } catch (error) {
      // Silent error handling
    }
  }

  // Handle place selection
  function handlePlaceSelection(place, inputElement) {
    if (!place.geometry || !place.geometry.location) {
      showToast("error", "No location data found for this place");
      return;
    }

    const location = place.geometry.location;
    const lat = location.lat();
    const lng = location.lng();

    // Update map
    if (map) {
      map.setCenter({lat, lng});
      map.setZoom(13);
    }

    // Update marker position
    if (marker) {
      marker.setPosition({lat, lng});
    }

    // Update circle
    if (circle) {
      circle.setCenter({lat, lng});
    }

    // Store coordinates in input element
    inputElement.dataset.lat = lat;
    inputElement.dataset.lng = lng;
  }

  // Set up all event listeners
  function setupEventListeners() {
    // Set up radius select
    const radiusSelect = document.getElementById("radius-select");
    if (radiusSelect) {
      radiusSelect.addEventListener("change", function () {
        const radius = parseInt(this.value) * 1000; // Convert to meters
        if (circle) {
          circle.setRadius(radius);
        }
      });

      // Set initial radius
      const initialRadius = parseInt(radiusSelect.value) * 1000;
      if (circle) circle.setRadius(initialRadius);
    }

    // Set up location removal buttons
    const removeLocationBtns = document.querySelectorAll(
      ".btn-remove-location"
    );
    removeLocationBtns.forEach((btn) => {
      btn.addEventListener("click", function () {
        const locationId = this.dataset.id;
        removeLocation(locationId, this);
      });
    });

    // Set up save location settings button
    const saveLocationSettingsBtn = document.getElementById(
      "save-location-settings"
    );
    if (saveLocationSettingsBtn) {
      saveLocationSettingsBtn.addEventListener("click", saveTravelFeeSettings);
    }
  }

  // Update location input from position via reverse geocoding
  function updateLocationInputFromPosition(position) {
    const locationInput = document.getElementById("new-location");
    if (geocoder && locationInput) {
      geocoder.geocode(
        {location: {lat: position.lat, lng: position.lng}},
        function (results, status) {
          if (status === "OK" && results[0]) {
            locationInput.value = results[0].formatted_address;
            locationInput.dataset.lat = position.lat;
            locationInput.dataset.lng = position.lng;
          }
        }
      );
    }
  }

  // Show map error message
  function showMapError(errorMessage) {
    if (mapContainer) {
      mapContainer.innerHTML = `
        <div class="map-error">
          <div class="text-center">
            <i class="fas fa-exclamation-triangle fa-2x mb-2 text-warning"></i>
            <div class="fw-bold">Map Loading Error</div>
            <div class="small text-muted mb-2">${errorMessage}</div>
            <button class="btn btn-sm btn-primary" onclick="location.reload()">
              <i class="fas fa-refresh me-1"></i>Reload Page
            </button>
          </div>
        </div>
      `;
    }
  }

  // Function to render service areas on the map
  function renderServiceAreas() {
    if (!map || !window.providerData || !window.providerData.serviceAreas)
      return;

    // Clear existing markers first
    serviceAreaMarkers.forEach((item) => {
      if (item.marker && item.marker.setMap) {
        item.marker.setMap(null);
      }
      if (item.circle && item.circle.setMap) {
        item.circle.setMap(null);
      }
    });
    serviceAreaMarkers = [];

    const bounds = new google.maps.LatLngBounds();
    let hasValidAreas = false;

    window.providerData.serviceAreas.forEach((area) => {
      if (!area.lat || !area.lng) return;

      hasValidAreas = true;
      const areaPosition = {
        lat: parseFloat(area.lat),
        lng: parseFloat(area.lng),
      };

      // Create marker for service area
      const areaMarker = new google.maps.Marker({
        position: areaPosition,
        map: map,
        title: area.name,
        icon: {
          url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        },
      });

      // Add circle for service area
      const areaCircle = new google.maps.Circle({
        strokeColor: "#3498db",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#3498db",
        fillOpacity: 0.1,
        map: map,
        center: areaPosition,
        radius: (area.radius || 10) * 1000, // Convert km to meters
      });

      // Store references to clean up later
      serviceAreaMarkers.push({
        marker: areaMarker,
        circle: areaCircle,
      });

      bounds.extend(areaPosition);
    });

    if (hasValidAreas) {
      map.fitBounds(bounds);
    }
  }

  // Function to add a location
  function addLocation() {
    const locationInput = document.getElementById("new-location");
    const radiusSelect = document.getElementById("radius-select");

    if (!locationInput || !locationInput.value.trim()) {
      showToast("error", "Please enter a location");
      return;
    }

    if (!radiusSelect) {
      showToast("error", "Please select a radius");
      return;
    }

    // Disable the button to prevent multiple clicks
    addLocationBtn.disabled = true;
    addLocationBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';

    // Get location coordinates
    let lat = locationInput.dataset.lat
      ? parseFloat(locationInput.dataset.lat)
      : null;
    let lng = locationInput.dataset.lng
      ? parseFloat(locationInput.dataset.lng)
      : null;
    const radius = parseInt(radiusSelect.value);
    const address = locationInput.value.trim();

    const processLocationData = async (position) => {
      try {
        const data = _api
          ? await _api.post('/dashboard/api/provider/locations', {
              name: address, address: address,
              lat: position.lat, lng: position.lng, radius: radius
            })
          : await fetch('/dashboard/api/provider/locations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: address, address: address, lat: position.lat, lng: position.lng, radius: radius })
            }).then(r => r.json());

        if (!data.success) throw new Error(data.message || 'Failed to add location');
        showToast('success', 'Location added successfully');
        updateLocationsList(data, position, address, radius);
        locationInput.value = '';
        locationInput.dataset.lat = '';
        locationInput.dataset.lng = '';
      } catch (error) {
        showToast('error', error.message || 'Error adding location');
      } finally {
        addLocationBtn.disabled = false;
        addLocationBtn.innerHTML = 'Add';
      }
    };

    // If we already have coordinates, use them directly
    if (lat && lng) {
      processLocationData({lat, lng});
    }
    // Otherwise geocode the address
    else if (geocoder) {
      geocoder
        .geocode({
          address: address,
          componentRestrictions: {country: "IN"},
        })
        .then((response) => {
          if (response.results && response.results[0]) {
            const position = {
              lat: response.results[0].geometry.location.lat(),
              lng: response.results[0].geometry.location.lng(),
            };
            processLocationData(position);
          } else {
            throw new Error("No results found for this location");
          }
        })
        .catch((error) => {
          addLocationBtn.disabled = false;
          addLocationBtn.innerHTML = "Add";
          showToast("error", "Could not find coordinates for this location");
        });
    } else {
      addLocationBtn.disabled = false;
      addLocationBtn.innerHTML = "Add";
      showToast("error", "Geocoding service not available");
    }
  }

  // Function to update the locations list after adding a new one
  function updateLocationsList(data, position, name, radius) {
    const existingAreas = document.getElementById("existing-service-areas");
    if (!existingAreas) return;

    // If this is the first location, clear the "no locations" message
    if (existingAreas.querySelector(".alert")) {
      existingAreas.innerHTML = '<div class="location-tags"></div>';
    }

    // Get or create the location tags container
    let locationTags = existingAreas.querySelector(".location-tags");
    if (!locationTags) {
      locationTags = document.createElement("div");
      locationTags.className = "location-tags";
      existingAreas.appendChild(locationTags);
    }

    // Create the new location tag
    const locationTag = document.createElement("div");
    locationTag.className =
      "location-tag d-inline-block bg-primary text-white rounded-pill px-3 py-1 me-2 mb-2";
    locationTag.dataset.id = data.locationId;
    locationTag.dataset.lat = position.lat;
    locationTag.dataset.lng = position.lng;
    locationTag.dataset.radius = radius;
    locationTag.dataset.name = name;

    locationTag.innerHTML = `
      <small>${name}</small>
      <button class="btn-remove-location border-0 bg-transparent text-white p-0 ms-1" data-id="${data.locationId}">
        <i class="fas fa-times-circle"></i>
      </button>
    `;

    locationTags.appendChild(locationTag);

    // Add event listener to the remove button
    const removeBtn = locationTag.querySelector(".btn-remove-location");
    if (removeBtn) {
      removeBtn.addEventListener("click", function () {
        const locationId = this.dataset.id;
        removeLocation(locationId, this);
      });
    }

    // Add to the map
    if (map && position) {
      const areaMarker = new google.maps.Marker({
        position: position,
        map: map,
        title: name,
        icon: {
          url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        },
      });

      const radiusInMeters = radius * 1000;
      const areaCircle = new google.maps.Circle({
        strokeColor: "#3498db",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#3498db",
        fillOpacity: 0.1,
        map: map,
        center: position,
        radius: radiusInMeters,
      });

      // Store references to clean up later
      serviceAreaMarkers.push({
        marker: areaMarker,
        circle: areaCircle,
      });
    }

    // Add this area to the provider data
    if (!window.providerData) {
      window.providerData = {serviceAreas: []};
    } else if (!window.providerData.serviceAreas) {
      window.providerData.serviceAreas = [];
    }

    window.providerData.serviceAreas.push({
      _id: data.locationId,
      name: name,
      lat: position.lat,
      lng: position.lng,
      radius: radius,
    });
  }

  // Function to remove a location
  function removeLocation(locationId, buttonElement) {
    if (!locationId) {
      showToast("error", "Invalid location ID");
      return;
    }

    if (confirm('Are you sure you want to remove this location?')) {
      buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      buttonElement.disabled = true;

      const doRemove = _api
        ? _api.delete(`/dashboard/api/provider/locations/${locationId}`)
        : fetch(`/dashboard/api/provider/locations/${locationId}`, { method: 'DELETE' })
            .then(r => { if (!r.ok) throw new Error(`Server returned status ${r.status}`); return r.json(); });

      doRemove
        .then((data) => {
          if (!data.success) throw new Error(data.message || 'Failed to remove location');
            // Remove from UI
            const locationTag = buttonElement.closest(".location-tag");
            if (locationTag) {
              locationTag.remove();
            }

            // Remove from provider data
            if (window.providerData && window.providerData.serviceAreas) {
              window.providerData.serviceAreas =
                window.providerData.serviceAreas.filter(
                  (area) => area._id !== locationId
                );
            }

            // Re-render service areas
            renderServiceAreas();

            // Check if we have any locations left
            const locationTags = document.querySelector(".location-tags");
            if (locationTags && !locationTags.children.length) {
              const existingAreas = document.getElementById(
                "existing-service-areas"
              );
              if (existingAreas) {
                existingAreas.innerHTML = `
                  <div class="alert alert-info py-2 px-3 mb-0">
                    <i class="fas fa-info-circle me-2"></i>
                    <small>You haven't added any specific service areas yet.</small>
                  </div>
                `;
              }
            }

            showToast("success", "Location removed successfully");
          } else {
            throw new Error(data.message || "Failed to remove location");
          }
        })
        .catch((error) => {
          showToast("error", error.message || "Failed to remove location");

          // Reset button
          buttonElement.innerHTML = '<i class="fas fa-times-circle"></i>';
          buttonElement.disabled = false;
        });
    }
  }

  // Function to save travel fee settings
  function saveTravelFeeSettings() {
    const travelFeeToggle = document.getElementById("travel-fee-toggle");
    const travelFeeAmount = document.getElementById("travel-fee-amount");

    if (!travelFeeToggle || !travelFeeAmount) {
      showToast("error", "Travel fee form elements not found");
      return;
    }

    const travelFeeEnabled = travelFeeToggle.checked;
    const amount = parseFloat(travelFeeAmount.value);

    if (travelFeeEnabled && (isNaN(amount) || amount <= 0)) {
      showToast("error", "Please enter a valid travel fee amount");
      return;
    }

    // Show loading state
    const button = document.getElementById("save-location-settings");
    button.disabled = true;
    button.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

    const doSave = _api
      ? _api.post('/profile/travel-fee', { enabled: travelFeeEnabled, amount: amount })
      : fetch('/profile/travel-fee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: travelFeeEnabled, amount: amount })
        }).then(r => { if (!r.ok) throw new Error(`Server returned status ${r.status}`); return r.json(); });

    doSave
      .then((data) => {
        if (data.success) {
          // Update provider data
          if (window.providerData) {
            window.providerData.travelFeeEnabled = travelFeeEnabled;
            window.providerData.travelFeeAmount = amount;
          }

          showToast("success", "Travel fee settings saved successfully");
        } else {
          throw new Error(data.message || "Failed to save travel fee settings");
        }
      })
      .catch((error) => {
        showToast(
          "error",
          error.message || "Failed to save travel fee settings"
        );
      })
      .finally(() => {
        // Reset button
        button.disabled = false;
        button.innerHTML = "Save Fee Settings";
      });
  }

  // Function to detect current location
  function detectCurrentLocation() {
    if (!navigator.geolocation) {
      showToast("error", "Geolocation is not supported by this browser");
      return;
    }

    // Show loading state
    detectLocationBtn.disabled = true;
    detectLocationBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Detecting...';

    navigator.geolocation.getCurrentPosition(
      async function (position) {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const locationInput = document.getElementById("new-location");

          // Update map to show current position
          if (map) {
            const currentLocation = {lat, lng};
            map.setCenter(currentLocation);
            map.setZoom(14);

            // Update marker position
            if (marker) {
              marker.setPosition(currentLocation);
            }

            // Update circle
            if (circle) {
              circle.setCenter(currentLocation);
            }

            // Reverse geocode to get address
            if (geocoder) {
              const response = await geocoder.geocode({
                location: currentLocation,
              });

              if (response && response.results && response.results[0]) {
                const address = response.results[0].formatted_address;

                // Update the location input field with the detected address
                if (locationInput) {
                  locationInput.value = address;
                  locationInput.dataset.lat = lat;
                  locationInput.dataset.lng = lng;
                }
              }
            }
          }

          showToast("success", "Current location detected successfully");
        } catch (error) {
          showToast(
            "error",
            "Failed to get address for current location: " + error.message
          );
        } finally {
          // Reset button state
          detectLocationBtn.disabled = false;
          detectLocationBtn.innerHTML =
            '<i class="fas fa-location-arrow"></i> Detect My Location';
        }
      },
      function (error) {
        detectLocationBtn.disabled = false;
        detectLocationBtn.innerHTML =
          '<i class="fas fa-location-arrow"></i> Detect My Location';

        let errorMessage = "Failed to detect your location";

        // More specific error messages based on the error code
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Location access denied. Please allow location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "The request to get user location timed out.";
            break;
        }

        showToast("error", errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  // Utility function to show a toast notification
  function showToast(type, message) {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className =
        "toast-container position-fixed bottom-0 end-0 p-3";
      toastContainer.style.zIndex = "9999";
      document.body.appendChild(toastContainer);
    }

    // Create the toast
    const toastId = "toast-" + Date.now();
    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-white bg-${
      type === "success" ? "success" : "danger"
    } border-0`;
    toast.id = toastId;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");

    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <i class="fas fa-${
            type === "success" ? "check-circle" : "exclamation-circle"
          } me-2"></i>
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;

    toastContainer.appendChild(toast);

    // Initialize and show the toast
    if (typeof bootstrap !== "undefined") {
      const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000,
      });
      bsToast.show();
    } else {
      // Fallback if Bootstrap is not available
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  }
})();
