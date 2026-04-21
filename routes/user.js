const express = require("express");
const router = express.Router();
const isLoggedIn = require("../middleware").isLoggedIn;
const userController = require("../Controllers/userController");
const {
	validateAddressPayload,
	validateAddressIndexParam,
	validateUpdateLocationPayload,
	handleUserFormValidationErrors,
	handleUserAPIValidationErrors,
} = require("../middleware/userValidation");

// Add address route
router.post(
	"/add-address",
	isLoggedIn,
	validateAddressPayload,
	handleUserFormValidationErrors,
	userController.addAddress
);

// Update address route
router.post(
	"/update-address/:index",
	isLoggedIn,
	validateAddressIndexParam,
	validateAddressPayload,
	handleUserFormValidationErrors,
	userController.updateAddress
);

// Delete address route
router.post(
	"/delete-address/:index",
	isLoggedIn,
	validateAddressIndexParam,
	handleUserFormValidationErrors,
	userController.deleteAddress
);

// Set default address route
router.post(
	"/set-default-address/:index",
	isLoggedIn,
	validateAddressIndexParam,
	handleUserFormValidationErrors,
	userController.setDefaultAddress
);

// Update user's current location
router.post(
	"/update-location",
	isLoggedIn,
	validateUpdateLocationPayload,
	handleUserAPIValidationErrors,
	userController.updateCurrentLocation
);

// Export the router
module.exports = router;
