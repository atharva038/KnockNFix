const Service = require("../../models/Service");
const {
  findProvidersForService,
  processProviderAvailability,
} = require("./providerSearchUtils");

// Get providers for a specific service
exports.getProviders = async (req, res) => {
  try {
    const {serviceId} = req.params;
    const {
      date,
      time,
      location,
      latitude,
      longitude,
      distance = 30,
    } = req.query;

    console.log("Providers request params:", {
      serviceId,
      date,
      time,
      location,
      latitude,
      longitude,
      distance,
    });

    // Parse coordinates if provided, or fallback to session location
    let userLocation = null;
    if (latitude && longitude) {
      userLocation = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };
    } else if (req.session.currentLocation) {
      // Fallback to session location if no coordinates in query
      userLocation = {
        latitude: req.session.currentLocation.latitude,
        longitude: req.session.currentLocation.longitude,
      };
      console.log("Using session location:", userLocation);
    }

    if (userLocation) {
      console.log("User location coordinates:", userLocation);
    }

    // Get the service and its category
    const service = await Service.findById(serviceId).populate("category");
    if (!service) {
      req.flash("error", "Service not found");
      return res.redirect("/services");
    }

    // Find providers for this service with increased search radius for regional coverage
    const searchDistance = parseInt(distance, 10);
    const providerData = await findProvidersForService(serviceId, {
      location,
      userLocation,
      distance: searchDistance,
    });

    console.log(
      `Found ${providerData.length} providers within ${searchDistance}km`
    );

    // If no providers found with default distance, try with larger radius
    let expandedSearch = false;
    if (providerData.length === 0 && userLocation && searchDistance < 100) {
      console.log("No providers found, expanding search radius to 100km...");
      const expandedProviders = await findProvidersForService(serviceId, {
        location,
        userLocation,
        distance: 100,
      });

      if (expandedProviders.length > 0) {
        providerData.push(...expandedProviders);
        expandedSearch = true;
        console.log(
          `Found ${expandedProviders.length} additional providers with expanded search`
        );
      }
    }

    // Process availability if date/time provided
    const processedProviders = await processProviderAvailability(
      providerData,
      date,
      time
    );

    // Get day of week for display purposes
    let dayOfWeek = "";
    if (date) {
      const requestedDate = new Date(date);
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      dayOfWeek = days[requestedDate.getDay()];
    }

    console.log(
      `Final results: ${processedProviders.available.length} available, ${processedProviders.unavailable.length} unavailable`
    );

    res.render("pages/public/providers", {
      providers: processedProviders,
      service,
      serviceId,
      category: service.category,
      selectedDate: date,
      selectedTime: time,
      location,
      latitude: userLocation?.latitude,
      longitude: userLocation?.longitude,
      distance: expandedSearch ? 100 : searchDistance,
      dayOfWeek,
      expandedSearch,
      title: `${service.name} Providers`,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    });
  } catch (error) {
    console.error("Error finding providers:", error);
    req.flash("error", "Failed to load providers");
    res.redirect("/services");
  }
};
