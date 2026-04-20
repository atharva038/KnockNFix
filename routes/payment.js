// routes/payment.js
// Thin router — all business logic lives in Controllers/paymentController.js

const express = require("express");
const router = express.Router();
const { isLoggedIn, isServiceProvider } = require("../middleware");
const pc = require("../Controllers/paymentController");
const {
	validateBookingIdParam,
	validateProviderIdParam,
	validatePaymentSuccessBookingParam,
	validateCreateAdvanceOrderPayload,
	validateCreateFinalOrderPayload,
	validateVerifyAutomatedPaymentPayload,
	validateCreateOrderPayload,
	validateVerifyManualPaymentPayload,
	validatePaymentSuccessPayload,
	handlePaymentAPIValidationErrors,
	handlePaymentFormValidationErrors,
} = require("../middleware/paymentValidation");

// Automated payment flow (advance + final)
router.post(
	"/create-advance-order",
	isLoggedIn,
	validateCreateAdvanceOrderPayload,
	handlePaymentAPIValidationErrors,
	pc.createAdvanceOrder
);
router.post(
	"/create-final-order",
	isLoggedIn,
	validateCreateFinalOrderPayload,
	handlePaymentAPIValidationErrors,
	pc.createFinalOrder
);
router.post(
	"/verify-automated",
	isLoggedIn,
	validateVerifyAutomatedPaymentPayload,
	handlePaymentAPIValidationErrors,
	pc.verifyAutomatedPayment
);

// Manual payment flow (customer dashboard)
router.post(
	"/create-order",
	isLoggedIn,
	validateCreateOrderPayload,
	handlePaymentAPIValidationErrors,
	pc.createOrder
);
router.post(
	"/verify-payment",
	isLoggedIn,
	validateVerifyManualPaymentPayload,
	handlePaymentAPIValidationErrors,
	pc.verifyPayment
);

// Payment success page
router.get(
	"/success/:bookingId",
	isLoggedIn,
	validatePaymentSuccessBookingParam,
	handlePaymentFormValidationErrors,
	pc.showPaymentSuccess
);

// Booking-specific payment initiation
router.post(
	"/:id/complete-payment",
	isLoggedIn,
	validateBookingIdParam,
	handlePaymentAPIValidationErrors,
	pc.initiateCompletePayment
);
router.post(
	"/:id/advance-payment",
	isLoggedIn,
	validateBookingIdParam,
	handlePaymentAPIValidationErrors,
	pc.initiateAdvancePayment
);

// Legacy success handler (form-based)
router.post(
	"/payment-success",
	isLoggedIn,
	validatePaymentSuccessPayload,
	handlePaymentFormValidationErrors,
	pc.handlePaymentSuccess
);

// Provider payout history
router.get(
	"/provider-payout/:providerId",
	isLoggedIn,
	isServiceProvider,
	validateProviderIdParam,
	handlePaymentAPIValidationErrors,
	pc.getProviderPayoutHistory
);

module.exports = router;