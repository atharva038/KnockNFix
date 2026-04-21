const providerProfileController = require("./provider/providerProfileController");
const providerServiceController = require("./provider/providerServiceController");

// Backward-compatible export surface for provider route imports.
module.exports = {
	...providerProfileController,
	...providerServiceController,
};
