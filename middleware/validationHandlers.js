const { validationResult } = require("express-validator");
const cloudinary = require("cloudinary").v2;

const cleanupRequestFiles = (req) => {
  if (req.files) {
    Object.values(req.files).forEach((fileArray) => {
      fileArray.forEach((file) => {
        if (file.filename) {
          cloudinary.uploader.destroy(file.filename);
        }
      });
    });
  } else if (req.file) {
    cloudinary.uploader.destroy(req.file.filename);
  }
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    cleanupRequestFiles(req);

    const errorMessages = errors.array().map((err) => err.msg);
    req.flash("error", errorMessages.join(", "));
    return res.redirect(req.originalUrl.split("?")[0]);
  }

  return next();
};

const handleAPIValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    cleanupRequestFiles(req);

    const errorMessages = errors.array().map((err) => err.msg);
    return res.status(400).json({
      success: false,
      error: errorMessages.join(", "),
      errors: errors.array(),
    });
  }

  return next();
};

module.exports = {
  handleValidationErrors,
  handleAPIValidationErrors,
};
