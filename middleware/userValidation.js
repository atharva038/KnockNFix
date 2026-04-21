const { body, param, validationResult } = require("express-validator");

const isBooleanLike = (value) => {
  return value === true || value === false || value === "true" || value === "false";
};

const validateAddressPayload = [
  body("street")
    .optional({ nullable: true })
    .trim(),
  body("city")
    .trim()
    .notEmpty()
    .withMessage("City is required."),
  body("state")
    .trim()
    .notEmpty()
    .withMessage("State is required."),
  body("pincode")
    .trim()
    .notEmpty()
    .withMessage("Pincode is required."),
  body("label")
    .optional({ nullable: true })
    .trim(),
  body("makeDefault")
    .optional({ nullable: true })
    .custom(isBooleanLike)
    .withMessage("makeDefault must be true or false."),
];

const validateAddressIndexParam = [
  param("index")
    .isInt({ min: 0 })
    .withMessage("Address index must be a non-negative integer."),
];

const validateUpdateLocationPayload = [
  body("latitude")
    .notEmpty()
    .withMessage("Latitude is required.")
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90."),
  body("longitude")
    .notEmpty()
    .withMessage("Longitude is required.")
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180."),
];

const handleUserFormValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const errorText = errors.array().map((err) => err.msg).join(", ");

  if (typeof req.flash === "function") {
    req.flash("error", errorText);
    return res.redirect(req.get("Referrer") || "/");
  }

  return res.status(400).json({
    success: false,
    error: errorText,
    errors: errors.array(),
  });
};

const handleUserAPIValidationErrors = (req, res, next) => {
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

module.exports = {
  validateAddressPayload,
  validateAddressIndexParam,
  validateUpdateLocationPayload,
  handleUserFormValidationErrors,
  handleUserAPIValidationErrors,
};
