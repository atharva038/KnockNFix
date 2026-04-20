const { body } = require("express-validator");
const cloudinary = require("cloudinary").v2;

const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required.")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters long"),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required.")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please enter a valid 10-digit Indian mobile number"),

  body("role")
    .trim()
    .notEmpty()
    .withMessage("Role is required.")
    .isIn(["customer", "provider"])
    .withMessage("Role must be either customer or provider."),

  body("email")
    .if(body("role").equals("provider"))
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),

  body("street")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("Street address is required for service providers.")
    .isLength({ min: 5 })
    .withMessage("Street address must be at least 5 characters long"),

  body("city")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("City is required for service providers.")
    .isLength({ min: 2 })
    .withMessage("City must be at least 2 characters long"),

  body("state")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("State is required for service providers.")
    .isLength({ min: 2 })
    .withMessage("State must be at least 2 characters long"),

  body("pincode")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("Pin code is required for service providers.")
    .matches(/^[0-9]{6}$/)
    .withMessage("Please enter a valid 6-digit pin code"),

  body("aadharCard")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("Aadhar card number is required for service providers.")
    .matches(/^[0-9]{12}$/)
    .withMessage("Please enter a valid 12-digit Aadhar card number"),

  body("panCard")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("PAN card number is required for service providers.")
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage("Please enter a valid PAN card number (e.g., ABCDE1234F)"),
];

const apiRegisterValidation = [...registerValidation];

const loginValidation = [
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required.")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please enter a valid 10-digit Indian mobile number"),
];

const otpVerificationValidation = [
  body("phoneOTP")
    .trim()
    .notEmpty()
    .withMessage("OTP is required.")
    .matches(/^[0-9]{6}$/)
    .withMessage("Please enter a valid 6-digit OTP"),
];

const loginOtpVerificationValidation = [
  body("phoneOTP")
    .trim()
    .notEmpty()
    .withMessage("OTP is required.")
    .matches(/^[0-9]{6}$/)
    .withMessage("Please enter a valid 6-digit OTP"),
];

const validateProviderFiles = (req, res, next) => {
  if (req.body.role === "provider") {
    if (!req.files || !req.files.aadharImage || !req.files.panImage) {
      if (req.files) {
        Object.values(req.files).forEach((fileArray) => {
          fileArray.forEach((file) => {
            if (file.filename) {
              cloudinary.uploader.destroy(file.filename);
            }
          });
        });
      }

      const missingFiles = [];
      if (!req.files?.aadharImage) missingFiles.push("Aadhar document image");
      if (!req.files?.panImage) missingFiles.push("PAN document image");

      if (req.originalUrl.includes("/api/")) {
        return res.status(400).json({
          success: false,
          error: `Missing required files: ${missingFiles.join(", ")}`,
          missingFiles,
        });
      }

      req.flash("error", `Missing required files: ${missingFiles.join(", ")}`);
      return res.redirect(req.originalUrl.split("?")[0]);
    }
  }

  return next();
};

module.exports = {
  registerValidation,
  apiRegisterValidation,
  loginValidation,
  otpVerificationValidation,
  loginOtpVerificationValidation,
  validateProviderFiles,
};
