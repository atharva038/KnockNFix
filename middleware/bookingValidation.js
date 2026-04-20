const { body, param, validationResult } = require("express-validator");

const validateBookingIdParam = [
  param("id").isMongoId().withMessage("Invalid booking id."),
];

const validateCreateBookingPayload = [
  body("serviceId").isMongoId().withMessage("Valid serviceId is required."),
  body("providerId").isMongoId().withMessage("Valid providerId is required."),
  body("date").isISO8601().withMessage("Valid booking date is required."),
  body("detailedAddress")
    .trim()
    .isLength({ min: 5, max: 300 })
    .withMessage("Detailed address must be between 5 and 300 characters."),
  body("cost")
    .isFloat({ gt: 0 })
    .withMessage("Cost must be a valid number greater than 0."),
  body("paymentId")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("paymentId must be between 3 and 200 characters."),
  body("latitude")
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be between -90 and 90."),
  body("longitude")
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be between -180 and 180."),
  body("notes")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters."),
];

const validateConfirmBookingPayload = [
  body("serviceId").isMongoId().withMessage("Valid serviceId is required."),
  body("providerId").isMongoId().withMessage("Valid providerId is required."),
  body("date").isISO8601().withMessage("Valid booking date is required."),
  body("detailedAddress")
    .trim()
    .isLength({ min: 5, max: 300 })
    .withMessage("Detailed address must be between 5 and 300 characters."),
  body("addressId")
    .optional({ nullable: true })
    .custom((value) => value === "new" || /^\d+$/.test(String(value)))
    .withMessage("addressId must be 'new' or a valid numeric index."),
  body("latitude")
    .optional({ nullable: true })
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be between -90 and 90."),
  body("longitude")
    .optional({ nullable: true })
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be between -180 and 180."),
  body("notes")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters."),
];

const validateCancelBookingPayload = [
  body("reason")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage("Cancellation reason must be between 3 and 500 characters."),
];

const validateAdminStatusUpdatePayload = [
  body("status")
    .trim()
    .isIn(["pending", "confirmed", "rejected", "in_progress", "completed", "cancelled"])
    .withMessage("Invalid booking status."),
  body("notes")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters."),
  body("reason")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters."),
  body("cancellationReason")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Cancellation reason cannot exceed 500 characters."),
];

const handleBookingAPIValidationErrors = (req, res, next) => {
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

const handleBookingPageValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  req.flash("error", errors.array().map((err) => err.msg).join(", "));
  return res.redirect(req.get("Referrer") || "/booking/mybookings");
};

module.exports = {
  validateBookingIdParam,
  validateCreateBookingPayload,
  validateConfirmBookingPayload,
  validateCancelBookingPayload,
  validateAdminStatusUpdatePayload,
  handleBookingAPIValidationErrors,
  handleBookingPageValidationErrors,
};
