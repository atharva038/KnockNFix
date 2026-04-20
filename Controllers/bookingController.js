const bookingCreateController = require("./booking/bookingCreateController");
const bookingStatusController = require("./booking/bookingStatusController");
const bookingViewController = require("./booking/bookingViewController");
const bookingAdminController = require("./booking/bookingAdminController");

// Backward-compatible export surface for existing route imports.
module.exports = {
    ...bookingCreateController,
    ...bookingStatusController,
    ...bookingViewController,
    ...bookingAdminController
};
