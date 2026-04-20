const serviceBrowseController = require("./service/serviceBrowseController");
const providerSearchController = require("./service/providerSearchController");
const serviceBookingController = require("./service/serviceBookingController");
const serviceLocationController = require("./service/serviceLocationController");

// Backward-compatible export surface for existing route imports.
module.exports = {
  ...serviceBrowseController,
  ...providerSearchController,
  ...serviceBookingController,
  ...serviceLocationController,
};
