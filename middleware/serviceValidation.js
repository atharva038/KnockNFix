// middleware/serviceValidation.js
// Shared param & error-handler middleware for /services and /dashboard routes.

const { param, validationResult } = require("express-validator");

// Validates a generic :id param as a MongoDB ObjectId
const validateObjectIdParam = [
  param("id").isMongoId().withMessage("Invalid ID format."),
];

// Validates :serviceId param as a MongoDB ObjectId
const validateServiceIdParam = [
  param("serviceId").isMongoId().withMessage("Invalid service ID format."),
];

// Validates :provider param as a MongoDB ObjectId
const validateProviderIdParam = [
  param("provider").isMongoId().withMessage("Invalid provider ID format."),
];

// Page-level error handler — redirects back with a flash message
const handleServicePageValidationErrors = (redirectTo = "/services") =>
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", errors.array().map((e) => e.msg).join(", "));
      return res.redirect(req.get("Referrer") || redirectTo);
    }
    return next();
  };

// API-level error handler — returns JSON 400
const handleServiceAPIValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: errors.array().map((e) => e.msg).join(", "),
      errors: errors.array(),
    });
  }
  return next();
};

module.exports = {
  validateObjectIdParam,
  validateServiceIdParam,
  validateProviderIdParam,
  handleServicePageValidationErrors,
  handleServiceAPIValidationErrors,
};
