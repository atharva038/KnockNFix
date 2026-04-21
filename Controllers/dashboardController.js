const overviewController = require("./dashboard/overviewController");
const providerOperationsController = require("./dashboard/providerOperationsController");

// Backward-compatible export surface for existing route imports.
module.exports = {
  ...overviewController,
  ...providerOperationsController,
};
