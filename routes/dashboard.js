// routes/dashboard.js
// Thin router — all business logic lives in Controllers/dashboardController.js

const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { isLoggedIn } = require("../middleware");
const dc = require("../Controllers/dashboardController");

// Main dashboard
router.get("/", isLoggedIn, dc.showDashboard);

// Booking data API
router.get("/api/bookings", isLoggedIn, dc.getBookingsAPI);

// Provider profile
router.post("/provider/update-info", isLoggedIn, dc.updateProviderInfo);

// Service registration
router.get("/registerService", isLoggedIn, dc.showRegisterService);
router.post(
  "/registerService",
  isLoggedIn,
  [
    body("serviceCategories").notEmpty().withMessage("Service category is required."),
    body("services").notEmpty().withMessage("Service is required."),
    body("cost").notEmpty().withMessage("Cost is required."),
    body("experience").notEmpty().withMessage("Experience is required."),
  ],
  dc.registerService
);

// Service management
router.post("/service/delete/:id", isLoggedIn, dc.deleteService);
router.get("/service/:id", dc.getServiceDetails);

// Booking payment routes (simple internal-only, non-Razorpay)
router.post("/:id/advance-payment", isLoggedIn, dc.advancePayment);
router.post("/:id/complete-payment", isLoggedIn, dc.completePayment);

// Provider availability & service area
router.post("/provider/update-availability", isLoggedIn, dc.updateAvailability);
router.post("/provider/update-service-area", isLoggedIn, dc.updateServiceArea);

// Provider location management
router.post("/api/provider/locations", isLoggedIn, dc.addLocation);
router.delete("/api/provider/locations/:id", isLoggedIn, dc.deleteLocation);
router.post("/api/provider/location-settings", isLoggedIn, dc.updateLocationSettings);

module.exports = router;
