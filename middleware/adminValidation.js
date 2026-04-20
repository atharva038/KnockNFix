const { body, param, validationResult } = require("express-validator");

const isBooleanLike = (value) => {
  return value === true || value === false || value === "true" || value === "false";
};

const validateProviderIdParam = [
  param("providerId").isMongoId().withMessage("Invalid provider id."),
];

const validateObjectIdParam = [
  param("id").isMongoId().withMessage("Invalid id."),
];

const validateRejectProvider = [
  ...validateProviderIdParam,
  body("reason")
    .trim()
    .isLength({ min: 10 })
    .withMessage("Rejection reason must be at least 10 characters long."),
];

const validateManageProviderPermissions = [
  ...validateProviderIdParam,
  body("dashboardAccess")
    .exists({ checkNull: true })
    .withMessage("dashboardAccess is required.")
    .bail()
    .custom(isBooleanLike)
    .withMessage("dashboardAccess must be true or false."),
  body("canRegisterServices")
    .exists({ checkNull: true })
    .withMessage("canRegisterServices is required.")
    .bail()
    .custom(isBooleanLike)
    .withMessage("canRegisterServices must be true or false."),
  body("canReceiveBookings")
    .exists({ checkNull: true })
    .withMessage("canReceiveBookings is required.")
    .bail()
    .custom(isBooleanLike)
    .withMessage("canReceiveBookings must be true or false."),
  body("canAccessPayouts")
    .exists({ checkNull: true })
    .withMessage("canAccessPayouts is required.")
    .bail()
    .custom(isBooleanLike)
    .withMessage("canAccessPayouts must be true or false."),
];

const validateApproveProvider = [
  ...validateProviderIdParam,
  body("grantDashboardAccess")
    .optional({ nullable: true })
    .custom(isBooleanLike)
    .withMessage("grantDashboardAccess must be true or false."),
  body("grantServiceRegistration")
    .optional({ nullable: true })
    .custom(isBooleanLike)
    .withMessage("grantServiceRegistration must be true or false."),
  body("grantBookingAccess")
    .optional({ nullable: true })
    .custom(isBooleanLike)
    .withMessage("grantBookingAccess must be true or false."),
  body("grantPayoutAccess")
    .optional({ nullable: true })
    .custom(isBooleanLike)
    .withMessage("grantPayoutAccess must be true or false."),
];

const validateCategoryPayload = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Category name is required.")
    .isLength({ min: 2 })
    .withMessage("Category name must be at least 2 characters long."),
  body("description")
    .optional({ nullable: true })
    .trim(),
];

const expectsJson = (req) => {
  return (
    req.originalUrl.includes("/api/") ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes("application/json"))
  );
};

const handleAdminValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  if (expectsJson(req)) {
    return res.status(400).json({
      success: false,
      error: errors.array().map((err) => err.msg).join(", "),
      errors: errors.array(),
    });
  }

  req.flash("error", errors.array().map((err) => err.msg).join(", "));
  return res.redirect(req.get("Referrer") || "/admin/dashboard");
};

module.exports = {
  validateProviderIdParam,
  validateObjectIdParam,
  validateRejectProvider,
  validateManageProviderPermissions,
  validateApproveProvider,
  validateCategoryPayload,
  handleAdminValidationErrors,
};
