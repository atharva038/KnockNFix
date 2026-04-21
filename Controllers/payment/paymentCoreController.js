const paymentAutomatedService = require("./paymentAutomatedService");
const paymentManualService = require("./paymentManualService");

module.exports = {
  ...paymentAutomatedService,
  ...paymentManualService,
};
