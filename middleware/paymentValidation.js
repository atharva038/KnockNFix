const { body, param, validationResult } = require("express-validator");

const validateBookingIdParam = [
  param("id").isMongoId().withMessage("Invalid booking id."),
];

const validateProviderIdParam = [
  param("providerId").isMongoId().withMessage("Invalid provider id."),
];

const validatePaymentSuccessBookingParam = [
  param("bookingId").isMongoId().withMessage("Invalid booking id."),
];

const validateCreateAdvanceOrderPayload = [
  body("amount")
    .isFloat({ gt: 0 })
    .withMessage("Amount must be a valid number greater than 0."),
  body("automation")
    .exists({ checkNull: true })
    .withMessage("automation is required.")
    .bail()
    .isObject()
    .withMessage("automation must be an object."),
  body("bookingData")
    .exists({ checkNull: true })
    .withMessage("bookingData is required.")
    .bail()
    .isObject()
    .withMessage("bookingData must be an object."),
  body("bookingData.serviceId")
    .isMongoId()
    .withMessage("Valid bookingData.serviceId is required."),
  body("bookingData.providerId")
    .isMongoId()
    .withMessage("Valid bookingData.providerId is required."),
  body("bookingData.date")
    .isISO8601()
    .withMessage("Valid bookingData.date is required."),
  body("bookingData.cost")
    .isFloat({ gt: 0 })
    .withMessage("bookingData.cost must be greater than 0."),
  body("bookingData")
    .custom((bookingData) => {
      const hasAddress = bookingData && (bookingData.address || bookingData.detailedAddress);
      return Boolean(hasAddress);
    })
    .withMessage("bookingData.address or bookingData.detailedAddress is required."),
];

const validateCreateFinalOrderPayload = [
  body("amount")
    .isFloat({ gt: 0 })
    .withMessage("Amount must be a valid number greater than 0."),
  body("automation")
    .exists({ checkNull: true })
    .withMessage("automation is required.")
    .bail()
    .isObject()
    .withMessage("automation must be an object."),
  body("splitDetails")
    .exists({ checkNull: true })
    .withMessage("splitDetails is required.")
    .bail()
    .isObject()
    .withMessage("splitDetails must be an object."),
  body("splitDetails.providerId")
    .isMongoId()
    .withMessage("Valid splitDetails.providerId is required."),
];

const validateVerifyAutomatedPaymentPayload = [
  body("orderId").trim().notEmpty().withMessage("orderId is required."),
  body("razorpay_payment_id")
    .trim()
    .notEmpty()
    .withMessage("razorpay_payment_id is required."),
  body("razorpay_signature")
    .trim()
    .notEmpty()
    .withMessage("razorpay_signature is required."),
];

const validateCreateOrderPayload = [
  body("amount")
    .isFloat({ gt: 0 })
    .withMessage("Amount must be a valid number greater than 0."),
  body("bookingId").isMongoId().withMessage("Valid bookingId is required."),
  body("paymentType")
    .optional({ nullable: true })
    .isIn(["advance", "final"])
    .withMessage("paymentType must be 'advance' or 'final'."),
];

const validateVerifyManualPaymentPayload = [
  body("bookingId").isMongoId().withMessage("Valid bookingId is required."),
  body("razorpay_order_id")
    .trim()
    .notEmpty()
    .withMessage("razorpay_order_id is required."),
  body("razorpay_payment_id")
    .trim()
    .notEmpty()
    .withMessage("razorpay_payment_id is required."),
  body("razorpay_signature")
    .trim()
    .notEmpty()
    .withMessage("razorpay_signature is required."),
  body("paymentType")
    .optional({ nullable: true })
    .isIn(["advance", "final"])
    .withMessage("paymentType must be 'advance' or 'final'."),
];

const validatePaymentSuccessPayload = [
  body("bookingId").isMongoId().withMessage("Valid bookingId is required."),
  body("razorpay_order_id")
    .trim()
    .notEmpty()
    .withMessage("razorpay_order_id is required."),
  body("razorpay_payment_id")
    .trim()
    .notEmpty()
    .withMessage("razorpay_payment_id is required."),
  body("razorpay_signature")
    .trim()
    .notEmpty()
    .withMessage("razorpay_signature is required."),
];

const handlePaymentAPIValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    success: false,
    error: errors.array().map((err) => err.msg).join(", "),
    errors: errors.array(),
  });
};

const handlePaymentFormValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  req.flash("error", errors.array().map((err) => err.msg).join(", "));
  return res.redirect(req.get("Referrer") || "/dashboard");
};

module.exports = {
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
};
