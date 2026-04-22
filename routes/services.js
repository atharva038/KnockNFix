// routes/services.js
// Thin router — all business logic lives in Controllers/serviceController.js

const express = require("express");
const router = express.Router();
const serviceController = require("../Controllers/serviceController");
const { isLoggedIn } = require("../middleware");
const {
  validateObjectIdParam,
  validateServiceIdParam,
  validateProviderIdParam,
  handleServicePageValidationErrors,
} = require("../middleware/serviceValidation");

// Get all services/categories
router.get("/", serviceController.getAllServices);

// Route to list services by specific category
router.get(
  "/:id",
  validateObjectIdParam,
  handleServicePageValidationErrors("/services"),
  serviceController.getServicesByCategory
);

// Get providers for a specific service
router.get(
  "/:serviceId/providers",
  validateServiceIdParam,
  handleServicePageValidationErrors("/services"),
  serviceController.getProviders
);

// Book service route
router.get(
  "/:id/:provider/book",
  isLoggedIn,
  validateObjectIdParam,
  handleServicePageValidationErrors("/services"),
  validateProviderIdParam,
  handleServicePageValidationErrors("/services"),
  serviceController.bookService
);

// Update location route — requires auth
router.post("/update-location", isLoggedIn, serviceController.updateLocation);

module.exports = router;