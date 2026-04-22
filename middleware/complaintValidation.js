// middleware/complaintValidation.js
// Body validation for /complaints routes.

const { body, validationResult } = require("express-validator");

const validateComplaintPayload = [
  body("subject")
    .trim()
    .notEmpty()
    .withMessage("Subject is required.")
    .isLength({ min: 5, max: 150 })
    .withMessage("Subject must be between 5 and 150 characters."),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required.")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters."),
  body("category")
    .optional({ nullable: true })
    .isIn(["service_quality", "payment", "provider_behaviour", "other"])
    .withMessage("Invalid complaint category."),
];

// Redirects back to /complaints with flash error on validation failure.
// NOTE: Must run AFTER multer (upload.array) so req.body is populated.
const handleComplaintValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash("error", errors.array().map((e) => e.msg).join(", "));
    return res.redirect("/complaints");
  }
  return next();
};

module.exports = {
  validateComplaintPayload,
  handleComplaintValidationErrors,
};
