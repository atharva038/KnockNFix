const ServiceProvider = require("../../models/ServiceProvider");
const {calculateDistance} = require("../../utils/distance");
const {findServiceDetails} = require("./helpers");

// Find providers for a specific service
async function findProvidersForService(serviceId, options = {}) {
  const {location, userLocation, distance = 30} = options; // Default to 30km

  // Base query for providers who offer this service
  const providerQuery = {
    "servicesOffered.services.service": serviceId,
    isActive: true,
  };

  console.log("Provider query:", JSON.stringify(providerQuery, null, 2));
  console.log("Search options:", {
    location,
    userLocation: !!userLocation,
    distance,
  });

  // Find all providers who offer this service (don't filter by location in query initially)
  let allProviders = await ServiceProvider.find(providerQuery)
    .populate({
      path: "user",
      select: "name email phone profileImage",
    })
    .populate({
      path: "servicesOffered.category",
      model: "Category",
    })
    .populate({
      path: "servicesOffered.services.service",
      model: "Service",
    })
    .lean();

  console.log(`Found ${allProviders.length} providers before processing`);

  // Process each provider to add service-specific information
  allProviders = allProviders.map((provider) => {
    const serviceDetails = findServiceDetails(provider, serviceId);

    // Add service-specific information to provider
    provider.serviceExperience = serviceDetails?.experience || "Not specified";
    provider.serviceCost = serviceDetails?.customCost;
    provider.formattedPrice = serviceDetails?.customCost
      ? `₹${serviceDetails.customCost}`
      : "Price on request";

    return provider;
  });

  // Apply location and distance filtering with enhanced regional logic
  if (userLocation || location) {
    // Use more lenient distance for regional searches - minimum 50km for location-based searches
    const effectiveDistance = location ? Math.max(distance, 50) : distance;

    allProviders = allProviders.filter((provider) => {
      return filterProvidersByLocationAndDistance(
        provider,
        userLocation,
        effectiveDistance,
        location
      );
    });

    console.log(
      `${allProviders.length} providers after location filtering (within ${effectiveDistance}km region)`
    );
  }

  return allProviders;
}

// Filter function with precise city and distance matching
function filterProvidersByLocationAndDistance(
  provider,
  userLocation,
  distance = 30,
  location
) {
  let hasNearbyServiceArea = false;
  let minDistance = Infinity;

  const providerCity = extractCityName(
    provider.serviceArea?.city || provider.businessAddress?.city || ""
  );

  // 1. City / Location-based matching
  if (location && location.trim() !== "") {
    const cityFromLocation = extractCityName(location.toLowerCase());

    if (cityFromLocation) {
      // Check main city
      const cityMatch = providerCity && areInSameCity(providerCity, cityFromLocation);

      // Check specific service areas
      let areaMatch = false;
      if (provider.serviceAreas && provider.serviceAreas.length > 0) {
        areaMatch = provider.serviceAreas.some((area) => {
          const areaName = extractCityName((area.name || "").toLowerCase());
          const areaAddress = extractCityName((area.address || "").toLowerCase());
          return (
            (areaName && areInSameCity(areaName, cityFromLocation)) ||
            (areaAddress && areInSameCity(areaAddress, cityFromLocation))
          );
        });
      }

      if (cityMatch || areaMatch) {
        hasNearbyServiceArea = true;
        minDistance = 10;
      }
    }
  }

  // 2. Coordinate-based distance matching
  if (userLocation && userLocation.latitude && userLocation.longitude) {
    // Check business address / main coordinates
    const mainCoords =
      provider.businessAddress?.coordinates || provider.serviceArea?.coordinates;
    if (mainCoords && mainCoords.latitude && mainCoords.longitude) {
      const providerDistance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        mainCoords.latitude,
        mainCoords.longitude
      );

      if (providerDistance <= distance) {
        minDistance = Math.min(minDistance, providerDistance);
        hasNearbyServiceArea = true;
      }
    }

    // Check specific service area coordinates
    if (provider.serviceAreas && provider.serviceAreas.length > 0) {
      provider.serviceAreas.forEach((area) => {
        if (area.lat && area.lng) {
          const areaDistance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            area.lat,
            area.lng
          );

          const maxRadius = area.radius || distance;
          if (areaDistance <= maxRadius) {
            minDistance = Math.min(minDistance, areaDistance);
            hasNearbyServiceArea = true;
          }
        }
      });
    }
  }

  // Set calculated distance on provider
  if (hasNearbyServiceArea && minDistance !== Infinity) {
    provider.distance = Math.round(minDistance * 10) / 10;
  }

  return hasNearbyServiceArea;
}

// Helper function to extract clean city name from location string
function extractCityName(locationString) {
  if (!locationString || typeof locationString !== "string") return "";
  let cityName = locationString
    .toLowerCase()
    .replace(/,.*$/g, "") // Remove everything after first comma
    .replace(
      /\b(state|district|city|town|village|area|sector|block|ward|surrounding|suburbs)\b/gi,
      ""
    )
    .replace(/\b(india|bharat)\b/gi, "")
    .replace(/[&]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cityName.includes(",")) {
    cityName = cityName.split(",")[0].trim();
  }

  return cityName;
}

// Helper function to check if two city names refer to the same city
function areInSameCity(city1, city2) {
  if (!city1 || !city2) return false;

  const cleanCity1 = extractCityName(city1);
  const cleanCity2 = extractCityName(city2);

  if (!cleanCity1 || !cleanCity2) return false;
  if (cleanCity1 === cleanCity2) return true;

  // Exact word boundary or equality match
  if (
    cleanCity1.length >= 3 &&
    cleanCity2.length >= 3 &&
    (cleanCity1.includes(cleanCity2) || cleanCity2.includes(cleanCity1))
  ) {
    return true;
  }

  return false;
}

// Helper function to extract state keywords
function extractStateKeywords(locationString) {
  const stateKeywords = [
    "maharashtra",
    "karnataka",
    "gujarat",
    "rajasthan",
    "tamil nadu",
    "telangana",
    "andhra pradesh",
    "kerala",
    "punjab",
    "haryana",
    "uttar pradesh",
    "bihar",
    "west bengal",
    "odisha",
    "madhya pradesh",
    "chhattisgarh",
    "jharkhand",
    "assam",
    "himachal pradesh",
    "uttarakhand",
    "delhi",
    "mumbai",
    "bangalore",
    "chennai",
    "kolkata",
    "hyderabad",
    "pune",
    "ahmedabad",
    "surat",
    "jaipur",
  ];

  return stateKeywords.filter((keyword) => locationString.includes(keyword));
}

// Simple Levenshtein distance function for fuzzy string matching
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Process provider availability
async function processProviderAvailability(allProviders, date, time) {
  const availableProviders = [];
  const unavailableProviders = [];

  // Process each provider for availability
  for (const provider of allProviders) {
    let isAvailable = true;
    let unavailabilityReason = "";

    // Check date and time availability if provided
    if (date || time) {
      try {
        const availability = await checkProviderAvailability(
          provider._id,
          date,
          time
        );
        isAvailable = availability.isAvailable;
        if (!isAvailable) {
          unavailabilityReason =
            availability.reason || "Not available at selected time";
          provider.availableTimeSlots = availability.availableSlots || [];
        }
      } catch (error) {
        console.error(
          `Error checking availability for provider ${provider._id}:`,
          error
        );
        isAvailable = false;
        unavailabilityReason = "Error checking availability";
      }
    }

    // Add distance to display if available
    if (provider.distance !== undefined) {
      provider.distanceText = `${provider.distance.toFixed(1)} km away`;
    }

    // Add service area info for display
    provider.address = getProviderAddress(provider);

    // Add to appropriate array
    if (isAvailable) {
      availableProviders.push(provider);
    } else {
      provider.unavailabilityReason = unavailabilityReason;
      unavailableProviders.push(provider);
    }
  }

  // Sort providers
  sortProviders(availableProviders);
  sortProviders(unavailableProviders);

  return {
    available: availableProviders,
    unavailable: unavailableProviders,
  };
}

// Get provider address for display
function getProviderAddress(provider) {
  if (provider.serviceArea) {
    return (
      provider.serviceArea.city ||
      provider.serviceArea.state ||
      "Service area available"
    );
  }
  if (provider.serviceAreas && provider.serviceAreas.length > 0) {
    return provider.serviceAreas[0].address || "Service area available";
  }
  return "Service area available";
}

// Sort providers by distance or name
function sortProviders(providers) {
  return providers.sort((a, b) => {
    // If both have distance, sort by distance
    if (a.distance !== undefined && b.distance !== undefined) {
      return a.distance - b.distance;
    }
    // If only one has distance, prioritize it
    if (a.distance !== undefined) return -1;
    if (b.distance !== undefined) return 1;
    // Otherwise sort by name
    return (a.user.name || "").localeCompare(b.user.name || "");
  });
}

// Helper function to check provider availability
async function checkProviderAvailability(providerId, date, time) {
  try {
    const provider = await ServiceProvider.findById(providerId);
    if (!provider || !provider.availability) {
      return {
        isAvailable: false,
        reason: "Provider availability not configured",
        availableSlots: [],
      };
    }

    // If no date/time specified, consider available
    if (!date && !time) {
      return {
        isAvailable: true,
        reason: "",
        availableSlots: [],
      };
    }

    // Get day of week for the requested date
    let dayOfWeek = "";
    if (date) {
      const requestedDate = new Date(date);
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      dayOfWeek = days[requestedDate.getDay()];
    }

    // If date is provided but no time, check if provider is available on that day
    if (date && !time) {
      const dayAvailability = provider.availability[dayOfWeek];
      if (!dayAvailability || !dayAvailability.isAvailable) {
        return {
          isAvailable: false,
          reason: `Not available on ${dayOfWeek}`,
          availableSlots: [],
        };
      }

      return {
        isAvailable: true,
        reason: "",
        availableSlots: dayAvailability.slots || [],
      };
    }

    // If time is provided, check specific time slot availability
    if (time) {
      const requestedTime = time;
      const [requestedHour, requestedMinute] = requestedTime
        .split(":")
        .map(Number);
      const requestedTimeInMinutes = requestedHour * 60 + requestedMinute;

      // If no date provided, assume it's for today or a general check
      if (!date) {
        const today = new Date();
        const todayDay = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ][today.getDay()];
        dayOfWeek = todayDay;
      }

      const dayAvailability = provider.availability[dayOfWeek];
      if (!dayAvailability || !dayAvailability.isAvailable) {
        return {
          isAvailable: false,
          reason: `Not available on ${dayOfWeek}`,
          availableSlots: dayAvailability ? dayAvailability.slots : [],
        };
      }

      // Check if requested time falls within any available slot
      let isTimeAvailable = false;
      const availableSlots = [];

      if (dayAvailability.slots) {
        dayAvailability.slots.forEach((slot) => {
          if (slot.isActive) {
            const [startHour, startMinute] = slot.startTime
              .split(":")
              .map(Number);
            const [endHour, endMinute] = slot.endTime.split(":").map(Number);

            const startTimeInMinutes = startHour * 60 + startMinute;
            const endTimeInMinutes = endHour * 60 + endMinute;

            availableSlots.push({
              startTime: slot.startTime,
              endTime: slot.endTime,
            });

            if (
              requestedTimeInMinutes >= startTimeInMinutes &&
              requestedTimeInMinutes < endTimeInMinutes
            ) {
              isTimeAvailable = true;
            }
          }
        });
      }

      return {
        isAvailable: isTimeAvailable,
        reason: isTimeAvailable
          ? ""
          : `Not available at ${formatTime(requestedTime)}`,
        availableSlots,
      };
    }

    return {
      isAvailable: true,
      reason: "",
      availableSlots: [],
    };
  } catch (error) {
    console.error("Error checking provider availability:", error);
    return {
      isAvailable: false,
      reason: "Error checking availability",
      availableSlots: [],
    };
  }
}

// Helper function to format time
function formatTime(time) {
  if (!time) return "N/A";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes || "00"} ${ampm}`;
}

module.exports = {
  findProvidersForService,
  processProviderAvailability,
};
