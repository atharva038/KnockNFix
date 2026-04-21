const express = require("express");
const providerController = require("../Controllers/providerController");
const { isLoggedIn, isServiceProvider } = require("../middleware");
const {
  validateServiceIdParam,
  validateProviderServiceUpdate,
  handleProviderValidationErrors,
} = require("../middleware/providerValidation");
const router = express.Router();

router.use(isLoggedIn, isServiceProvider);

// Route for service providers to view their services
router.get("/myservices", providerController.showMyServices);

// Route for service providers to edit a service
router.post(
  "/edit/:serviceId",
  validateServiceIdParam,
  validateProviderServiceUpdate,
  handleProviderValidationErrors,
  providerController.editService
);

module.exports = router;
