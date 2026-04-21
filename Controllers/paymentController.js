const automatedPaymentController = require("./payment/automatedPaymentController");
const manualPaymentController = require("./payment/manualPaymentController");
const payoutController = require("./payment/payoutController");

// Backward-compatible export surface for existing route imports.
module.exports = {
  ...automatedPaymentController,
  ...manualPaymentController,
  ...payoutController,
};
