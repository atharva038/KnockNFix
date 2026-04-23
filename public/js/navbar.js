document.addEventListener("DOMContentLoaded", function () {
    // Initialize location functionality
    initializeLocationBar();

    function initializeLocationBar() {
      const locationInput = document.getElementById("navbar-location");
      const mobileLocationInput = document.getElementById(
        "mobile-navbar-location"
      );
      const changeLocationBtn = document.getElementById("change-location-btn");
      const mobileChangeLocationBtn = document.getElementById(
        "mobile-change-location-btn"
      );

      // Check if location modal exists before creating instance
      const locationModalElement = document.getElementById("locationModal");
      const locationModal = locationModalElement
        ? new bootstrap.Modal(locationModalElement)
        : null;

      const locationSearch = document.getElementById("location-search");
      const locationSuggestions = document.getElementById(
        "location-suggestions"
      );
      const detectLocationBtn = document.getElementById(
        "detect-current-location"
      );
      const saveLocationBtn = document.getElementById("save-location-btn");

      let currentLocation = null;
      let selectedLocation = null;
      let searchTimeout = null;

      // Modal event listeners for accessibility
      if (locationModalElement) {
        // Clear focus and reset when modal is hidden
        locationModalElement.addEventListener("hidden.bs.modal", function () {
          const focusedElement = locationModalElement.querySelector(":focus");
          if (focusedElement) {
            focusedElement.blur();
          }
          resetModalState();
        });

        // Set proper focus when modal is shown
        locationModalElement.addEventListener("shown.bs.modal", function () {
          if (locationSearch) {
            setTimeout(() => {
              locationSearch.focus();
            }, 100);
          }
        });

        // Handle focus trap when modal is hiding
        locationModalElement.addEventListener("hide.bs.modal", function () {
          const focusedElement = locationModalElement.querySelector(":focus");
          if (focusedElement) {
            focusedElement.blur();
          }
        });
      }

      // Reset modal state function
      function resetModalState() {
        if (locationSearch) {
          locationSearch.value = "";
          locationSearch.disabled = false;
          locationSearch.placeholder = "Enter city, area, or pincode";
        }

        if (detectLocationBtn) {
          detectLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
          detectLocationBtn.disabled = false;
        }

        if (locationSuggestions) {
          locationSuggestions.style.display = "none";
          locationSuggestions.innerHTML = "";
        }

        selectedLocation = null;
      }

      // Initialize location display and check for first visit
      initializeLocationDisplay();

      // Event listeners
      if (changeLocationBtn && locationModal) {
        changeLocationBtn.addEventListener("click", function () {
          locationModal.show();
        });
      }

      if (mobileChangeLocationBtn && locationModal) {
        mobileChangeLocationBtn.addEventListener("click", function () {
          locationModal.show();
        });
      }

      // Make location inputs clickable to open modal
      if (locationInput) {
        locationInput.addEventListener("click", function () {
          if (locationModal) {
            locationModal.show();
          }
        });
      }

      if (mobileLocationInput) {
        mobileLocationInput.addEventListener("click", function () {
          if (locationModal) {
            locationModal.show();
          }
        });
      }

      if (locationSearch) {
        locationSearch.addEventListener("input", function () {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(function () {
            searchLocations();
          }, 300);
        });
      }

      if (detectLocationBtn) {
        detectLocationBtn.addEventListener("click", function () {
          detectUserLocationInModal();
        });
      }

      if (saveLocationBtn) {
        saveLocationBtn.addEventListener("click", function () {
          saveSelectedLocation();
        });
      }

      // Check if this is user's first visit to the website
      function isFirstVisit() {
        const hasVisited = localStorage.getItem("hasVisitedBefore");
        const hasLocation = localStorage.getItem("userLocation");
        return !hasVisited || !hasLocation;
      }

      // Mark that user has visited the website
      function markAsVisited() {
        localStorage.setItem("hasVisitedBefore", "true");
        localStorage.setItem("firstVisitDate", new Date().toISOString());
      }

      // Get location from URL parameters
      function getLocationFromURL() {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const location = urlParams.get("location");
          const latitude = urlParams.get("latitude");
          const longitude = urlParams.get("longitude");

          if (location && latitude && longitude) {
            return {
              city: location,
              fullAddress: location,
              coordinates: {
                lat: parseFloat(latitude),
                lng: parseFloat(longitude),
              },
              fromURL: true,
              setAt: new Date().toISOString(),
            };
          }
        } catch (e) {
          // Handle error silently
        }
        return null;
      }

      // Initialize location display and handle first visit
      function initializeLocationDisplay() {
        // FIRST: Check if location is in URL parameters (highest priority)
        const urlLocation = getLocationFromURL();
        if (urlLocation) {
          currentLocation = urlLocation;
          updateLocationDisplay(urlLocation.city, "success");

          // Also store this location for future use (but don't override manual settings)
          const storedLocation = getStoredLocation();
          if (!storedLocation || !storedLocation.manuallySet) {
            storeLocationInStorage(urlLocation);
            updateServerLocation(urlLocation);
          }
          return;
        }

        // SECOND: Check stored location
        const storedLocation = getStoredLocation();
        if (storedLocation) {
          currentLocation = storedLocation;
          updateLocationDisplay(storedLocation.city, "success");
          updateServerLocation(storedLocation);
          return;
        }

        // THIRD: Handle first visit auto-detection
        if (isFirstVisit()) {
          updateLocationDisplay("Detecting location...", "loading");
          markAsVisited();

          setTimeout(function () {
            detectUserLocationFirstTime();
          }, 1500);
        } else {
          updateLocationDisplay("Select location", "normal");
        }
      }

      // Special location detection for first-time visitors
      function detectUserLocationFirstTime() {
        if (!navigator.geolocation) {
          updateLocationDisplay("Select location", "normal");
          return;
        }

        const options = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        };

        navigator.geolocation.getCurrentPosition(
          function (position) {
            processLocationCoordinates(position);
          },
          function (error) {
            updateLocationDisplay("Select location", "normal");
            showLocationBenefitsToast();
          },
          options
        );
      }

      // Location detection specifically for modal button
      function detectUserLocationInModal() {
        // Update the search input to show loading state
        if (locationSearch) {
          locationSearch.value = "Detecting location...";
          locationSearch.disabled = true;
        }

        // Change button state
        if (detectLocationBtn) {
          detectLocationBtn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i>';
          detectLocationBtn.disabled = true;
        }

        if (!navigator.geolocation) {
          resetModalLocationState("Geolocation not supported");
          return;
        }

        const options = {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 600000,
        };

        navigator.geolocation.getCurrentPosition(
          function (position) {
            processModalLocationCoordinates(position);
          },
          function (error) {
            let errorMessage = "Location detection failed";
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage =
                  "Location permission denied. Please enter manually.";
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = "Location unavailable. Please enter manually.";
                break;
              case error.TIMEOUT:
                errorMessage =
                  "Location detection timed out. Please try again.";
                break;
            }

            resetModalLocationState(errorMessage);
          },
          options
        );
      }

      // Process coordinates specifically for modal
      function processModalLocationCoordinates(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Store coordinates globally for use in service searches
        window.userLocation = {
          latitude: lat,
          longitude: lng,
          timestamp: Date.now(),
        };

        // Try to get proper address from reverse geocoding
        axios
          .get("/api/location/reverse-geocode", {
            params: {
              lat: lat,
              lng: lng,
            },
            timeout: 10000,
          })
          .then(function (response) {
            let cityName = "Current Location";
            let fullAddress = `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(
              4
            )}`;

            if (response.data.success && response.data.address) {
              cityName = response.data.address;
              fullAddress = response.data.fullAddress || response.data.address;
            } else if (
              response.data.data &&
              response.data.data.results &&
              response.data.data.results[0]
            ) {
              const address = response.data.data.results[0];
              cityName = extractCityFromAddress(address);
              fullAddress = address.formatted_address;
            }

            // Update the modal search input
            if (locationSearch) {
              locationSearch.value = fullAddress;
            }

            // Create the selected location object
            selectedLocation = {
              placeId: "detected_" + Date.now(),
              description: fullAddress,
              city: cityName,
              coordinates: {lat: lat, lng: lng},
              autoDetected: true,
            };

            // Reset button state
            resetModalLocationState("Location detected successfully!");

            // Show success message briefly
            setTimeout(function () {
              if (locationSearch) {
                locationSearch.value = fullAddress;
              }
            }, 1000);
          })
          .catch(function (error) {
            // Fallback to coordinates
            const cityName = `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
            const fullAddress = `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(
              4
            )}`;

            if (locationSearch) {
              locationSearch.value = fullAddress;
            }

            selectedLocation = {
              placeId: "detected_" + Date.now(),
              description: fullAddress,
              city: cityName,
              coordinates: {lat: lat, lng: lng},
              autoDetected: true,
            };

            resetModalLocationState("Location detected (approximate)");
          });
      }

      // Reset modal location detection state
      function resetModalLocationState(message) {
        // Reset search input
        if (locationSearch) {
          locationSearch.disabled = false;
          if (
            message.includes("failed") ||
            message.includes("denied") ||
            message.includes("unavailable")
          ) {
            locationSearch.value = "";
            locationSearch.placeholder = message;
          }
        }

        // Reset button
        if (detectLocationBtn) {
          detectLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
          detectLocationBtn.disabled = false;
        }
      }

      // Regular location detection (for manual requests)
      function detectUserLocation() {
        updateLocationDisplay("Detecting location...", "loading");

        if (!navigator.geolocation) {
          updateLocationDisplay("Location not supported", "error");
          return;
        }

        const options = {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 600000,
        };

        navigator.geolocation.getCurrentPosition(
          function (position) {
            processLocationCoordinates(position);
          },
          function (error) {
            let errorMessage = "Location unavailable";
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = "Location permission denied";
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = "Location unavailable";
                break;
              case error.TIMEOUT:
                errorMessage = "Location detection timed out";
                break;
            }

            updateLocationDisplay(errorMessage, "error");

            setTimeout(function () {
              updateLocationDisplay("Select location", "normal");
            }, 3000);
          },
          options
        );
      }

      // Process coordinates and get address (shared function)
      function processLocationCoordinates(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Store coordinates globally for use in service searches
        window.userLocation = {
          latitude: lat,
          longitude: lng,
          timestamp: Date.now(),
        };

        // Create initial location with coordinates
        const cityName =
          "Location (" + lat.toFixed(2) + ", " + lng.toFixed(2) + ")";

        currentLocation = {
          city: cityName,
          fullAddress: "Coordinates: " + lat.toFixed(4) + ", " + lng.toFixed(4),
          coordinates: {lat: lat, lng: lng},
          detectedAt: new Date().toISOString(),
          autoDetected: true,
        };

        updateLocationDisplay(cityName, "success");
        storeLocationInStorage(currentLocation);
        updateServerLocation(currentLocation);

        // Try to get proper address from reverse geocoding using axios
        axios
          .get("/api/location/reverse-geocode", {
            params: {
              lat: lat,
              lng: lng,
            },
            timeout: 10000,
          })
          .then(function (response) {
            if (response.data.success && response.data.address) {
              currentLocation.city = response.data.address;
              currentLocation.fullAddress =
                response.data.fullAddress || response.data.address;
              updateLocationDisplay(response.data.address, "success");
              storeLocationInStorage(currentLocation);
              updateServerLocation(currentLocation);
            } else if (
              response.data.data &&
              response.data.data.results &&
              response.data.data.results[0]
            ) {
              const address = response.data.data.results[0];
              const city = extractCityFromAddress(address);

              currentLocation.city = city;
              currentLocation.fullAddress = address.formatted_address;
              updateLocationDisplay(city, "success");
              storeLocationInStorage(currentLocation);
              updateServerLocation(currentLocation);
            }

            // Update providers if on services page
            if (window.location.pathname.includes("/services")) {
              updateProvidersForLocation(currentLocation);
            }
          })
          .catch(function (error) {
            // Keep the coordinates-based location
          });
      }

      // Update server location using axios
      function updateServerLocation(location) {
        if (!location || !location.coordinates) {
          return;
        }

        axios
          .post(
            "/services/update-location",
            {
              latitude: location.coordinates.lat,
              longitude: location.coordinates.lng,
            },
            {
              timeout: 5000,
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
          .then(function (response) {
            // Handle success silently
          })
          .catch(function (error) {
            // Handle error silently
          });
      }

      // Show subtle notification about location benefits
      function showLocationBenefitsToast() {
        const hasSeenToast = localStorage.getItem("hasSeenLocationToast");
        if (hasSeenToast) return;

        const toast = document.createElement("div");
        toast.style.cssText =
          "position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 20px; border-radius: 25px; font-size: 14px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); z-index: 9999; opacity: 0; transition: opacity 0.3s ease; max-width: 90%; text-align: center;";

        toast.innerHTML =
          '<i class="fas fa-map-marker-alt me-2"></i>Enable location to find nearby service providers<button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; margin-left: 10px; cursor: pointer;"><i class="fas fa-times"></i></button>';

        document.body.appendChild(toast);

        setTimeout(function () {
          toast.style.opacity = "1";
        }, 100);

        setTimeout(function () {
          toast.style.opacity = "0";
          setTimeout(function () {
            if (toast.parentElement) {
              toast.remove();
            }
          }, 300);
        }, 5000);

        localStorage.setItem("hasSeenLocationToast", "true");
      }

      // Search for locations using axios
      function searchLocations() {
        const query = locationSearch ? locationSearch.value.trim() : "";

        if (query.length < 3) {
          if (locationSuggestions) locationSuggestions.style.display = "none";
          return;
        }

        axios
          .get("/api/location/suggestions", {
            params: {
              query: query,
            },
            timeout: 8000,
          })
          .then(function (response) {
            if (
              response.data.status === "success" &&
              response.data.data.predictions
            ) {
              displayLocationSuggestions(response.data.data.predictions);
            } else if (response.data.predictions) {
              displayLocationSuggestions(response.data.predictions);
            } else {
              // Fallback suggestion
              displayLocationSuggestions([
                {
                  place_id: "manual_" + Date.now(),
                  description: query + ", India",
                  structured_formatting: {
                    main_text: query,
                    secondary_text: "India",
                  },
                },
              ]);
            }
          })
          .catch(function (error) {
            displayLocationSuggestions([
              {
                place_id: "manual_" + Date.now(),
                description: query + ", India",
                structured_formatting: {
                  main_text: query,
                  secondary_text: "India",
                },
              },
            ]);
          });
      }

      // Display location suggestions
      function displayLocationSuggestions(predictions) {
        if (!locationSuggestions) return;

        locationSuggestions.innerHTML = "";

        if (predictions.length === 0) {
          locationSuggestions.style.display = "none";
          return;
        }

        predictions.forEach(function (prediction) {
          const div = document.createElement("div");
          div.className = "location-suggestion";
          div.innerHTML =
            '<div class="main-text">' +
            (prediction.structured_formatting
              ? prediction.structured_formatting.main_text
              : prediction.description) +
            '</div><div class="sub-text">' +
            (prediction.structured_formatting
              ? prediction.structured_formatting.secondary_text || ""
              : "") +
            "</div>";

          div.addEventListener("click", function () {
            selectLocationSuggestion(prediction);
          });
          locationSuggestions.appendChild(div);
        });

        locationSuggestions.style.display = "block";
      }

      // Select a location suggestion
      function selectLocationSuggestion(prediction) {
        if (locationSearch) locationSearch.value = prediction.description;
        if (locationSuggestions) locationSuggestions.style.display = "none";

        selectedLocation = {
          placeId: prediction.place_id,
          description: prediction.description,
          city: prediction.structured_formatting
            ? prediction.structured_formatting.main_text
            : prediction.description.split(",")[0],
        };
      }

      // Save selected location using axios
      function saveSelectedLocation() {
        if (!selectedLocation) {
          alert("Please select a location first");
          return;
        }

        // Handle auto-detected locations
        if (selectedLocation.placeId.startsWith("detected_")) {
          currentLocation = {
            city: selectedLocation.city,
            fullAddress: selectedLocation.description,
            coordinates: selectedLocation.coordinates,
            manuallySet: true,
            autoDetected: true,
            setAt: new Date().toISOString(),
          };

          updateLocationDisplay(currentLocation.city, "success");
          storeLocationInStorage(currentLocation);
          updateServerLocation(currentLocation);

          // Proper modal hiding with focus management
          if (locationModal) {
            if (saveLocationBtn) {
              saveLocationBtn.blur();
            }

            setTimeout(() => {
              locationModal.hide();
            }, 50);
          }

          updateProvidersForLocation(currentLocation);
          showLocationSuccessToast(currentLocation.city);
          return;
        }

        // Handle manual locations
        if (selectedLocation.placeId.startsWith("manual_")) {
          currentLocation = {
            city: selectedLocation.city,
            fullAddress: selectedLocation.description,
            coordinates: {lat: 28.6139, lng: 77.209}, // Default to Delhi
            manuallySet: true,
            setAt: new Date().toISOString(),
          };

          updateLocationDisplay(currentLocation.city, "success");
          storeLocationInStorage(currentLocation);
          updateServerLocation(currentLocation);

          if (locationModal) {
            if (saveLocationBtn) {
              saveLocationBtn.blur();
            }
            setTimeout(() => {
              locationModal.hide();
            }, 50);
          }

          updateProvidersForLocation(currentLocation);
          showLocationSuccessToast(currentLocation.city);
        } else {
          // Try to get details for the place using axios
          axios
            .get("/api/location/place-details", {
              params: {
                placeId: selectedLocation.placeId,
              },
              timeout: 8000,
            })
            .then(function (response) {
              if (
                response.data.status === "success" &&
                response.data.data.result &&
                response.data.data.result.geometry
              ) {
                const location = response.data.data.result;
                currentLocation = {
                  city: selectedLocation.city,
                  fullAddress: location.formatted_address,
                  coordinates: {
                    lat: location.geometry.location.lat,
                    lng: location.geometry.location.lng,
                  },
                  manuallySet: true,
                  setAt: new Date().toISOString(),
                };
              } else {
                // Fallback
                currentLocation = {
                  city: selectedLocation.city,
                  fullAddress: selectedLocation.description,
                  coordinates: {lat: 28.6139, lng: 77.209},
                  manuallySet: true,
                  setAt: new Date().toISOString(),
                };
              }

              updateLocationDisplay(currentLocation.city, "success");
              storeLocationInStorage(currentLocation);
              updateServerLocation(currentLocation);

              if (locationModal) {
                if (saveLocationBtn) {
                  saveLocationBtn.blur();
                }
                setTimeout(() => {
                  locationModal.hide();
                }, 50);
              }

              updateProvidersForLocation(currentLocation);
              showLocationSuccessToast(currentLocation.city);
            })
            .catch(function (error) {
              // Fallback
              currentLocation = {
                city: selectedLocation.city,
                fullAddress: selectedLocation.description,
                coordinates: {lat: 28.6139, lng: 77.209},
                manuallySet: true,
                setAt: new Date().toISOString(),
              };

              updateLocationDisplay(currentLocation.city, "success");
              storeLocationInStorage(currentLocation);
              updateServerLocation(currentLocation);

              if (locationModal) {
                if (saveLocationBtn) {
                  saveLocationBtn.blur();
                }
                setTimeout(() => {
                  locationModal.hide();
                }, 50);
              }

              updateProvidersForLocation(currentLocation);
              showLocationSuccessToast(currentLocation.city);
            });
        }
      }

      // Show success message
      function showLocationSuccessToast(cityName) {
        const toast = document.createElement("div");
        toast.style.cssText =
          "position: fixed; bottom: 20px; right: 20px; background: #28a745; color: white; padding: 12px 20px; border-radius: 8px; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9999; opacity: 0; transition: opacity 0.3s ease; max-width: 300px;";

        toast.innerHTML =
          '<i class="fas fa-check-circle me-2"></i>Location updated to ' +
          cityName;

        document.body.appendChild(toast);

        setTimeout(function () {
          toast.style.opacity = "1";
        }, 100);

        setTimeout(function () {
          toast.style.opacity = "0";
          setTimeout(function () {
            if (toast.parentElement) {
              toast.remove();
            }
          }, 300);
        }, 3000);
      }

      // Update location display
      function updateLocationDisplay(text, state) {
        state = state || "normal";
        const inputs = [locationInput, mobileLocationInput].filter(Boolean);
        const containers = document.querySelectorAll(
          ".location-input-container"
        );

        inputs.forEach(function (input) {
          input.value = text;
          input.className = "location-input " + state;
        });

        containers.forEach(function (container) {
          container.className = "location-input-container " + state;
        });
      }

      // Extract city from address components
      function extractCityFromAddress(address) {
        if (address.address_components) {
          for (let i = 0; i < address.address_components.length; i++) {
            const component = address.address_components[i];
            if (component.types.includes("locality")) {
              return component.long_name;
            }
            if (component.types.includes("administrative_area_level_2")) {
              return component.long_name;
            }
          }
        }
        return address.formatted_address.split(",")[0];
      }

      // Storage functions
      function storeLocationInStorage(location) {
        try {
          localStorage.setItem("userLocation", JSON.stringify(location));
          localStorage.setItem(
            "userLocationTimestamp",
            new Date().toISOString()
          );
        } catch (e) {
          // Handle error silently
        }
      }

      function getStoredLocation() {
        try {
          const stored = localStorage.getItem("userLocation");
          const timestamp = localStorage.getItem("userLocationTimestamp");

          if (!stored) return null;

          const location = JSON.parse(stored);

          // If manually set, don't expire
          if (location.manuallySet) return location;

          // For auto-detected locations, check age
          if (timestamp) {
            const storedDate = new Date(timestamp);
            const now = new Date();
            const hoursDiff = (now - storedDate) / (1000 * 60 * 60);

            // Auto-detected locations expire after 7 days
            if (hoursDiff > 168) {
              localStorage.removeItem("userLocation");
              localStorage.removeItem("userLocationTimestamp");
              return null;
            }
          }

          return location;
        } catch (e) {
          return null;
        }
      }

      function updateProvidersForLocation(location) {
        try {
          const currentPath = window.location.pathname;

          // Check if we're on a providers page
          if (
            currentPath.includes("/services/") &&
            currentPath.includes("/providers")
          ) {
            const url = new URL(window.location);

            // Set location parameters
            url.searchParams.set("location", location.city);
            url.searchParams.set("latitude", location.coordinates.lat);
            url.searchParams.set("longitude", location.coordinates.lng);

            // Force reload with new location parameters
            window.location.href = url.href;
          } else if (currentPath.includes("/services")) {
            // Show a notification that location has been updated
            showLocationSuccessToast(
              location.city + " - Will be used when viewing providers"
            );
          } else {
            // Show a general notification
            showLocationSuccessToast(location.city);
          }
        } catch (e) {
          // Handle error silently
        }
      }
    }

    // Existing navbar code
    handleNavbarScrolling();
    handleMobileMenu();

    function handleNavbarScrolling() {
      window.addEventListener("scroll", function () {
        const navbar = document.querySelector(".navbar");
        if (navbar) {
          if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
          } else {
            navbar.classList.remove("scrolled");
          }
        }
      });
    }

    function handleMobileMenu() {
      const navbarToggler = document.querySelector(".navbar-toggler");
      const navbarCollapse = document.querySelector(".navbar-collapse");

      if (navbarToggler && navbarCollapse) {
        navbarToggler.addEventListener("click", function () {
          const togglerIcon = this.querySelector("i");
          if (togglerIcon) {
            if (togglerIcon.classList.contains("fa-bars")) {
              togglerIcon.classList.remove("fa-bars");
              togglerIcon.classList.add("fa-times");
            } else {
              togglerIcon.classList.remove("fa-times");
              togglerIcon.classList.add("fa-bars");
            }
          }
        });

        document.addEventListener("click", function (e) {
          if (
            navbarCollapse.classList.contains("show") &&
            !navbarToggler.contains(e.target) &&
            !navbarCollapse.contains(e.target)
          ) {
            const bsCollapse = new bootstrap.Collapse(navbarCollapse);
            bsCollapse.hide();

            const togglerIcon = navbarToggler.querySelector("i");
            if (togglerIcon) {
              togglerIcon.classList.remove("fa-times");
              togglerIcon.classList.add("fa-bars");
            }
          }
        });
      }
    }
  });