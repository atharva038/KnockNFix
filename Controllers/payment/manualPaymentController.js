const paymentCoreController = require("./paymentCoreController");

module.exports = {
  createOrder: paymentCoreController.createOrder,
  verifyPayment: paymentCoreController.verifyPayment,
  showPaymentSuccess: paymentCoreController.showPaymentSuccess,
  initiateCompletePayment: paymentCoreController.initiateCompletePayment,
  initiateAdvancePayment: paymentCoreController.initiateAdvancePayment,
  handlePaymentSuccess: paymentCoreController.handlePaymentSuccess,
};
