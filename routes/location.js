const express = require('express');
const router = express.Router();
const locationController = require('../Controllers/locationController');
const {
    validateSuggestionsQuery,
    validateAutocompleteQuery,
    validateLatLngQuery,
    validatePlaceIdQuery,
    handleLocationValidationErrors,
} = require('../middleware/locationValidation');

// Location suggestions route (Places Autocomplete)
router.get('/suggestions', validateSuggestionsQuery, handleLocationValidationErrors, locationController.getSuggestions);

// Reverse geocoding route
router.get('/reverse-geocode', validateLatLngQuery, handleLocationValidationErrors, locationController.reverseGeocode);

// Place autocomplete endpoint
router.get('/autocomplete', validateAutocompleteQuery, handleLocationValidationErrors, locationController.getAutocomplete);

router.get('/current-location', validateLatLngQuery, handleLocationValidationErrors, locationController.getCurrentLocation);

router.get('/place-details', validatePlaceIdQuery, handleLocationValidationErrors, locationController.getPlaceDetails);

module.exports = router;