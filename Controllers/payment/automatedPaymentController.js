const paymentCoreController = require("./paymentCoreController");

module.exports = {
  createAdvanceOrder: paymentCoreController.createAdvanceOrder,
  createFinalOrder: paymentCoreController.createFinalOrder,
  verifyAutomatedPayment: paymentCoreController.verifyAutomatedPayment,
};
