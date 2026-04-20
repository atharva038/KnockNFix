const providerProfileController = require("./provider/providerProfileController");

// Backward-compatible export surface for provider route imports.
module.exports = {
	...providerProfileController,
};
