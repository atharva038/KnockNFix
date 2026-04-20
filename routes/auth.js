const express = require("express");
const router = express.Router();
const {upload} = require("../config/cloudinary");
const authController = require("../Controllers/authController");
const {
  registerValidation,
  apiRegisterValidation,
  loginValidation,
  otpVerificationValidation,
  loginOtpVerificationValidation,
  validateProviderFiles,
  handleValidationErrors,
  handleAPIValidationErrors,
} = require("../middleware/validation");

// Multiple file upload configuration
const uploadFields = upload.fields([
  {name: "profileImage", maxCount: 1},
  {name: "aadharImage", maxCount: 1},
  {name: "panImage", maxCount: 1},
]);

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
  otpVerificationValidation,
  handleAPIValidationErrors,
  authController.handleVerifyOTPAPI
);

// API Login routes
router.post(
  "/api/login",
  loginValidation,
  handleAPIValidationErrors,
  authController.handleLoginAPI
);

router.post(
  "/api/verify-login-otp",
  loginOtpVerificationValidation,
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
            phoneOTP: "string (required, 6-digit)",
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
