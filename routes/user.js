const express = require("express");
const router = express.Router();
const isLoggedIn = require("../middleware").isLoggedIn;
const userController = require("../Controllers/userController");

// Add address route
router.post("/add-address", isLoggedIn, userController.addAddress);

// Update address route
router.post("/update-address/:index", isLoggedIn, userController.updateAddress);

// Delete address route
router.post("/delete-address/:index", isLoggedIn, userController.deleteAddress);

// Set default address route
router.post("/set-default-address/:index", isLoggedIn, userController.setDefaultAddress);

// Update user's current location
router.post("/update-location", isLoggedIn, userController.updateCurrentLocation);

// Export the router
module.exports = router;
