const { Client } = require("@googlemaps/google-maps-services-js");
const axios = require("axios");

const client = new Client({});

exports.getSuggestions = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 3) {
      return res.json({
        status: "error",
        message: "Query must be at least 3 characters long",
        predictions: [],
      });
    }

    const response = await client.placeAutocomplete({
      params: {
        input: query,
        key: process.env.GOOGLE_MAPS_API_KEY,
        components: ["country:in"],
        language: "en",
        types: ["geocode", "establishment"],
      },
    });

    return res.json({
      status: "success",
      data: response.data,
    });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch location suggestions",
      error: error.message,
    });
  }
};

exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        status: "error",
        message: "Latitude and longitude are required",
      });
    }

    const response = await client.reverseGeocode({
      params: {
        latlng: { lat: parseFloat(lat), lng: parseFloat(lng) },
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      const addressComponents = result.address_components;

      let city = "";
      for (const component of addressComponents) {
        if (component.types.includes("locality")) {
          city = component.long_name;
          break;
        }
        if (component.types.includes("administrative_area_level_2")) {
          city = component.long_name;
          break;
        }
      }

      return res.json({
        success: true,
        address: city || result.formatted_address.split(",")[0],
        fullAddress: result.formatted_address,
        data: response.data,
      });
    }

    return res.json({
      success: false,
      message: "No address found for the given coordinates",
    });
  } catch (error) {
    console.error("Error in reverse geocoding:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get address",
      error: error.message,
    });
  }
};

exports.getAutocomplete = async (req, res) => {
  try {
    const { input } = req.query;
    if (!input || input.length < 3) {
      return res.json({
        status: "error",
        message: "Input must be at least 3 characters",
        predictions: [],
      });
    }

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json",
      {
        params: {
          input,
          key: process.env.GOOGLE_MAPS_API_KEY,
          components: "country:in",
          language: "en",
          types: "geocode|establishment",
        },
      }
    );

    return res.json({
      status: "success",
      data: response.data,
    });
  } catch (error) {
    console.error("Error fetching places:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

exports.getCurrentLocation = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    console.log(`Received location request for: ${lat}, ${lng}`);

    if (!lat || !lng) {
      return res.status(400).json({
        status: "error",
        message: "Latitude and longitude are required",
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (
      isNaN(latitude) ||
      isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid coordinates provided",
      });
    }

    const response = await client.reverseGeocode({
      params: {
        latlng: { lat: latitude, lng: longitude },
        key: process.env.GOOGLE_MAPS_API_KEY,
        language: "en",
        region: "in",
        locationTypes: [
          "ROOFTOP",
          "RANGE_INTERPOLATED",
          "GEOMETRIC_CENTER",
          "APPROXIMATE",
        ],
        resultType: ["street_address", "premise", "subpremise", "route"],
      },
    });

    console.log("Google API response status:", response.data.status);

    if (!response.data.results || response.data.results.length === 0) {
      throw new Error("No results found for this location");
    }

    const result = response.data.results[0];

    let locality = "";
    let administrative_area_level_1 = "";
    let administrative_area_level_2 = "";
    let postal_code = "";
    let sublocality = "";
    let route = "";

    if (result.address_components) {
      for (const component of result.address_components) {
        if (component.types.includes("locality")) {
          locality = component.long_name;
        }
        if (component.types.includes("administrative_area_level_1")) {
          administrative_area_level_1 = component.long_name;
        }
        if (component.types.includes("administrative_area_level_2")) {
          administrative_area_level_2 = component.long_name;
        }
        if (component.types.includes("postal_code")) {
          postal_code = component.long_name;
        }
        if (component.types.includes("sublocality")) {
          sublocality = component.long_name;
        }
        if (component.types.includes("route")) {
          route = component.long_name;
        }
      }
    }

    return res.json({
      status: "success",
      data: {
        formatted_address: result.formatted_address,
        location: result.geometry.location,
        place_id: result.place_id,
        address_components: result.address_components,
        locality,
        administrative_area_level_1,
        administrative_area_level_2,
        postal_code,
        sublocality,
        route,
        accuracy: result.geometry.location_type,
      },
    });
  } catch (error) {
    console.error("Error fetching current location:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch current location details",
      error: error.message,
    });
  }
};

exports.getPlaceDetails = async (req, res) => {
  try {
    const { placeId } = req.query;

    if (!placeId) {
      return res.status(400).json({
        status: "error",
        message: "Place ID is required",
      });
    }

    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        key: process.env.GOOGLE_MAPS_API_KEY,
        fields: ["formatted_address", "geometry", "name", "place_id"],
      },
    });

    return res.json({
      status: "success",
      data: response.data,
    });
  } catch (error) {
    console.error("Error fetching place details:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch place details",
      error: error.message,
    });
  }
};
