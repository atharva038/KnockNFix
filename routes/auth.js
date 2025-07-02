const express = require("express");
const router = express.Router();
const {body, validationResult} = require("express-validator");
const passport = require("passport");
const {upload} = require("../config/cloudinary");
const cloudinary = require("cloudinary").v2;
const authController = require("../Controllers/authController");

// Multiple file upload configuration
const uploadFields = upload.fields([
  {name: "profileImage", maxCount: 1},
  {name: "aadharImage", maxCount: 1},
  {name: "panImage", maxCount: 1},
]);

// Conditional registration validation based on role
const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required.")
    .isLength({min: 2})
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

  // Conditional validation for providers only
  body("email")
    .if(body("role").equals("provider"))
    .optional({nullable: true, checkFalsy: true})
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),

  body("street")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("Street address is required for service providers.")
    .isLength({min: 5})
    .withMessage("Street address must be at least 5 characters long"),

  body("city")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("City is required for service providers.")
    .isLength({min: 2})
    .withMessage("City must be at least 2 characters long"),

  body("state")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("State is required for service providers.")
    .isLength({min: 2})
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

// Simplified validation for API routes
const apiRegisterValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required.")
    .isLength({min: 2})
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

  // Provider-specific validation
  body("email")
    .if(body("role").equals("provider"))
    .optional({nullable: true, checkFalsy: true})
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),

  body("street")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("Street address is required for service providers.")
    .isLength({min: 5})
    .withMessage("Street address must be at least 5 characters long"),

  body("city")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("City is required for service providers.")
    .isLength({min: 2})
    .withMessage("City must be at least 2 characters long"),

  body("state")
    .if(body("role").equals("provider"))
    .trim()
    .notEmpty()
    .withMessage("State is required for service providers.")
    .isLength({min: 2})
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

// Login validation - Mobile OTP only
const loginValidation = [
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required.")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please enter a valid 10-digit Indian mobile number"),
];

// OTP verification validation
const otpVerificationValidation = [
  body("phoneOTP")
    .trim()
    .notEmpty()
    .withMessage("OTP is required.")
    .matches(/^[0-9]{6}$/)
    .withMessage("Please enter a valid 6-digit OTP"),
];

// Change this:
const loginOtpVerificationValidation = [
  body("phoneOTP") // ✅ Changed from "otp" to "phoneOTP"
    .trim()
    .notEmpty()
    .withMessage("OTP is required.")
    .matches(/^[0-9]{6}$/)
    .withMessage("Please enter a valid 6-digit OTP"),
];

// Custom file validation middleware for providers
const validateProviderFiles = (req, res, next) => {
  if (req.body.role === "provider") {
    // Check if required document images are uploaded
    if (!req.files || !req.files.aadharImage || !req.files.panImage) {
      // Clean up any uploaded files
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
          missingFiles: missingFiles,
        });
      } else {
        req.flash(
          "error",
          `Missing required files: ${missingFiles.join(", ")}`
        );
        return res.redirect(req.originalUrl.split("?")[0]);
      }
    }
  }
  next();
};

// Validation error handler middleware for web routes
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Clean up uploaded files if validation fails
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

    const errorMessages = errors.array().map((err) => err.msg);
    req.flash("error", errorMessages.join(", "));
    return res.redirect(req.originalUrl.split("?")[0]);
  }
  next();
};

// Validation error handler middleware for API routes
const handleAPIValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Clean up uploaded files if validation fails
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

    const errorMessages = errors.array().map((err) => err.msg);
    return res.status(400).json({
      success: false,
      error: errorMessages.join(", "),
      errors: errors.array(),
    });
  }
  next();
};

// =============================================================================
// WEB ROUTES (with flash messages and redirects)
// =============================================================================

// Registration routes
router.get("/register", authController.showRegister);
router.post(
  "/register",
  uploadFields, // Changed from upload.single
  registerValidation,
  handleValidationErrors,
  validateProviderFiles, // Added file validation
  authController.handleRegister
);

// OTP verification routes
router.get("/verify-otp", authController.showVerifyOTP);
router.post(
  "/verify-otp",
  otpVerificationValidation,
  handleValidationErrors,
  authController.handleVerifyOTP
);

// Login routes - Mobile OTP based
router.get("/login", authController.showLogin);
router.post(
  "/login",
  loginValidation,
  handleValidationErrors,
  authController.handleLogin
);

// Login OTP verification routes
router.get("/verify-login-otp", authController.showVerifyLoginOTP);
router.post(
  "/verify-login-otp",
  loginOtpVerificationValidation,
  handleValidationErrors,
  authController.handleVerifyLoginOTP
);

// Logout route
router.get("/logout", authController.handleLogout);

// OTP utility routes (JSON responses)
router.post("/resend-otp", authController.resendOTP);
router.post("/resend-login-otp", authController.resendLoginOTP);

// =============================================================================
// API ROUTES (JSON responses for Thunder Client / Mobile Apps)
// =============================================================================

// API Registration routes
router.post(
  "/api/register",
  uploadFields, // Changed from upload.single
  apiRegisterValidation,
  handleAPIValidationErrors,
  validateProviderFiles, // Added file validation
  authController.handleRegisterAPI
);

router.post(
  "/api/verify-otp",
  body("phoneOTP")
    .trim()
    .notEmpty()
    .withMessage("OTP is required.")
    .matches(/^[0-9]{6}$/)
    .withMessage("Please enter a valid 6-digit OTP"),
  handleAPIValidationErrors,
  authController.handleVerifyOTPAPI
);

// API Login routes
router.post(
  "/api/login",
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required.")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please enter a valid 10-digit Indian mobile number"),
  handleAPIValidationErrors,
  authController.handleLoginAPI
);

router.post(
  "/api/verify-login-otp",
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required.")
    .matches(/^[0-9]{6}$/)
    .withMessage("Please enter a valid 6-digit OTP"),
  handleAPIValidationErrors,
  authController.handleVerifyLoginOTPAPI
);

// =============================================================================
// UTILITY API ROUTES (Session management and status)
// =============================================================================

// OTP Status and session management
router.get("/api/otp-status", authController.getOTPStatus);
router.get("/api/check-otp-session", authController.checkOTPSession);
router.post("/api/clear-otp-session", authController.clearOTPSession);

// Resend OTP routes (JSON responses)
router.post("/api/resend-otp", authController.resendOTP);
router.post("/api/resend-login-otp", authController.resendLoginOTP);

// =============================================================================
// HEALTH CHECK AND INFO ROUTES
// =============================================================================

// API Health check
router.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "KnockNFix Auth API is running",
    timestamp: new Date().toISOString(),
    endpoints: {
      registration: "/api/register",
      verification: "/api/verify-otp",
      login: "/api/login",
      loginVerification: "/api/verify-login-otp",
      utilities: {
        otpStatus: "/api/otp-status",
        resendOTP: "/api/resend-otp",
        resendLoginOTP: "/api/resend-login-otp",
        clearSession: "/api/clear-otp-session",
      },
    },
  });
});

// API Routes documentation
router.get("/api/docs", (req, res) => {
  res.json({
    success: true,
    documentation: {
      title: "KnockNFix Authentication API",
      version: "1.0.0",
      description:
        "OTP-based authentication system for customers and service providers",
      baseUrl: `${req.protocol}://${req.get("host")}`,
      endpoints: {
        "POST /api/register": {
          description: "Register a new customer or provider",
          contentType: "multipart/form-data",
          body: {
            name: "string (required)",
            phone: "string (required, 10-digit Indian mobile)",
            role: "string (required, 'customer' or 'provider')",
            // Provider-specific fields
            email: "string (optional, for providers)",
            street: "string (required for providers)",
            city: "string (required for providers)",
            state: "string (required for providers)",
            pincode: "string (required for providers, 6-digit)",
            aadharCard: "string (required for providers, 12-digit)",
            panCard: "string (required for providers, format: ABCDE1234F)",
            // Files
            profileImage: "file (optional)",
            aadharImage: "file (required for providers)",
            panImage: "file (required for providers)",
          },
          response: {
            success: true,
            message: "OTP sent successfully",
            phone: "string",
            sessionId: "string",
            devMode: "boolean",
            otp: "string (only in development mode)",
          },
        },
        "POST /api/verify-otp": {
          description: "Verify registration OTP",
          body: {
            phoneOTP: "string (required, 6-digit)",
          },
        },
        "POST /api/login": {
          description: "Login with phone number",
          body: {
            phone: "string (required, 10-digit Indian mobile)",
          },
        },
        "POST /api/verify-login-otp": {
          description: "Verify login OTP",
          body: {
            otp: "string (required, 6-digit)",
          },
        },
      },
      examples: {
        customerRegistration: {
          url: "/api/register",
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
          body: "name=John Doe&phone=9156906881&role=customer",
        },
        providerRegistration: {
          url: "/api/register",
          method: "POST",
          headers: {
            "Content-Type": "multipart/form-data",
          },
          body: "name=John Provider&phone=9156906881&role=provider&street=123 Main St&city=Mumbai&state=Maharashtra&pincode=400001&aadharCard=123456789012&panCard=ABCDE1234F&files=aadharImage,panImage",
        },
      },
    },
  });
});

module.exports = router;
