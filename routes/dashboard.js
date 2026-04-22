// routes/dashboard.js
// Thin router — all business logic lives in Controllers/dashboardController.js

const express = require("express");
const router = express.Router();
const { body, param, validationResult } = require("express-validator");
const { isLoggedIn } = require("../middleware");
const dc = require("../Controllers/dashboardController");

// Validates :id as a MongoDB ObjectId. Returns JSON for API calls, redirect for page requests.
const validateObjectId = [
  param("id").isMongoId().withMessage("Invalid ID format."),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const isApiCall =
        req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"));
      if (isApiCall) {
        return res.status(400).json({
          success: false,
          error: errors.array().map((e) => e.msg).join(", "),
        });
      }
      req.flash("error", errors.array().map((e) => e.msg).join(", "));
      return res.redirect("/dashboard");
    }
    return next();
  },
];

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
router.post("/service/delete/:id", isLoggedIn, validateObjectId, dc.deleteService);
router.get("/service/:id", validateObjectId, dc.getServiceDetails);

// Booking payment routes (simple internal-only, non-Razorpay)
router.post("/:id/advance-payment", isLoggedIn, validateObjectId, dc.advancePayment);
router.post("/:id/complete-payment", isLoggedIn, validateObjectId, dc.completePayment);

// Provider availability & service area
router.post("/provider/update-availability", isLoggedIn, dc.updateAvailability);
router.post("/provider/update-service-area", isLoggedIn, dc.updateServiceArea);

// Provider location management
router.post("/api/provider/locations", isLoggedIn, dc.addLocation);
router.delete("/api/provider/locations/:id", isLoggedIn, validateObjectId, dc.deleteLocation);
router.post("/api/provider/location-settings", isLoggedIn, dc.updateLocationSettings);

module.exports = router;
