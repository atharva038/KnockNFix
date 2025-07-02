const crypto = require("crypto");
const axios = require("axios");

// In-memory store for rate limiting (use Redis in production)
const otpRateLimit = new Map();

// Generate a random OTP
const generateOTP = (length = 6) => {
  return Math.floor(100000 + Math.random() * 900000)
    .toString()
    .substring(0, length);
};

// Rate limiting function
const checkRateLimit = (phoneNumber, limitMinutes = 1) => {
  const now = Date.now();
  const key = `otp_${phoneNumber}`;

  if (otpRateLimit.has(key)) {
    const lastSent = otpRateLimit.get(key);
    const timeDiff = now - lastSent;
    const limitMs = limitMinutes * 60 * 1000; // Convert minutes to milliseconds

    if (timeDiff < limitMs) {
      const remainingSeconds = Math.ceil((limitMs - timeDiff) / 1000);
      return {
        allowed: false,
        remainingSeconds,
        message: `Please wait ${remainingSeconds} seconds before requesting another OTP`,
      };
    }
  }

  // Update the rate limit
  otpRateLimit.set(key, now);

  // Clean up old entries (older than 10 minutes)
  for (const [k, v] of otpRateLimit.entries()) {
    if (now - v > 10 * 60 * 1000) {
      otpRateLimit.delete(k);
    }
  }

  return {allowed: true};
};

// Send OTP using the approved KnockNFixOTP template
const sendSmsOTP = async (phoneNumber, skipRateLimit = false) => {
  try {
    // Check rate limiting (unless skipped for resend)
    if (!skipRateLimit) {
      const rateLimitCheck = checkRateLimit(phoneNumber);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: rateLimitCheck.message,
          rateLimit: true,
        };
      }
    }

    // Check if 2Factor API key is configured
    if (!process.env.TWOFACTOR_API_KEY) {
      // Development mode fallback - generate dummy OTP for testing
      if (process.env.NODE_ENV === "development") {
        const dummyOTP = generateOTP();
        console.log(`📱 [DEV MODE] SMS OTP for ${phoneNumber}: ${dummyOTP}`);
        console.log(
          "💡 Use this OTP for testing (2Factor API key not configured)"
        );
        return {
          success: true,
          dev_mode: true,
          sessionId: `dev_session_${Date.now()}`,
          otp: dummyOTP, // For development testing
        };
      }
      throw new Error("2Factor API key not configured");
    }

    // Format phone number for 2Factor.in
    let formattedPhone = phoneNumber.toString().trim();

    // Remove any non-digit characters
    formattedPhone = formattedPhone.replace(/\D/g, "");

    // Remove country code if present
    if (formattedPhone.startsWith("91") && formattedPhone.length === 12) {
      formattedPhone = formattedPhone.substring(2);
    }

    // Validate Indian phone number format (exactly 10 digits starting with 6-9)
    if (!/^[6-9]\d{9}$/.test(formattedPhone)) {
      throw new Error(
        `Invalid Indian phone number format: ${formattedPhone}. Must be exactly 10 digits starting with 6-9.`
      );
    }

    console.log(
      `📱 Sending SMS OTP to: ${formattedPhone} using KnockNFixOTP template`
    );

    // Use the approved template: KnockNFixOTP
    const apiUrl = `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/SMS/${formattedPhone}/AUTOGEN/KnockNFixOTP`;

    console.log(
      `🔗 API URL: https://2factor.in/API/V1/[API_KEY]/SMS/${formattedPhone}/AUTOGEN/KnockNFixOTP`
    );
    console.log(
      `📱 Phone validation: Input=${phoneNumber}, Formatted=${formattedPhone}, Length=${formattedPhone.length}`
    );

    // Make API request with GET method
    const response = await axios.get(apiUrl, {
      timeout: 15000, // 15 second timeout
      headers: {
        "User-Agent": "KnockNFix/1.0",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    console.log("✅ 2Factor.in SMS API response:", response.data);

    // Check response status
    if (response.data && response.data.Status === "Success") {
      console.log(
        `✅ SMS OTP sent successfully to ${formattedPhone} using KnockNFixOTP template`
      );
      return {
        success: true,
        sessionId: response.data.Details, // Session ID for verification
        provider: "2Factor.in",
        method: "AUTOGEN SMS with KnockNFixOTP template",
        phone: formattedPhone,
        template: "KnockNFixOTP",
      };
    } else {
      console.warn(
        `⚠️ 2Factor.in API returned non-success status:`,
        response.data
      );
      throw new Error(
        response.data?.Details ||
          "SMS sending failed - invalid response from 2Factor.in"
      );
    }
  } catch (error) {
    console.error("❌ SMS sending error:", error);

    // Handle different types of errors
    if (error.response) {
      // API responded with error status
      const errorData = error.response.data;
      console.error("SMS API Error Response:", errorData);

      let errorMessage = "SMS service error";
      if (errorData?.Details) {
        errorMessage = errorData.Details;

        // Provide specific error messages for common issues
        if (errorData.Details.includes("Length Mismatch")) {
          errorMessage =
            "Invalid phone number format. Please check your phone number.";
        } else if (errorData.Details.includes("Invalid Phone Number")) {
          errorMessage =
            "Invalid phone number. Please enter a valid 10-digit Indian mobile number.";
        } else if (errorData.Details.includes("Invalid Template")) {
          errorMessage =
            "SMS template error. Please contact support if this persists.";
        } else if (errorData.Details.includes("Template not found")) {
          errorMessage = "SMS template not found. Please contact support.";
        } else if (errorData.Details.includes("Invalid")) {
          errorMessage =
            "Invalid request. Please check your phone number format.";
        }
      } else if (error.response.status === 401) {
        errorMessage = "Invalid 2Factor API key";
      } else if (error.response.status === 429) {
        errorMessage = "Rate limit exceeded - too many requests";
      } else if (error.response.status === 400) {
        errorMessage = "Invalid phone number format or API request";
      }

      return {
        success: false,
        error: errorMessage,
        statusCode: error.response.status,
      };
    } else if (error.request) {
      // Network error - no response received
      console.error("Network Error - No response from 2Factor.in API");
      return {
        success: false,
        error:
          "Network error - unable to reach SMS service. Please check your internet connection.",
      };
    } else {
      // Other error (validation, etc.)
      return {
        success: false,
        error: error.message || "Unknown error occurred while sending SMS",
      };
    }
  }
};

// Fallback: Simple SMS function with manual OTP (if template fails)
const sendSimpleSmsOTP = async (phoneNumber) => {
  try {
    const otp = generateOTP();

    // For development, just return the OTP
    if (
      process.env.NODE_ENV === "development" ||
      !process.env.TWOFACTOR_API_KEY
    ) {
      console.log(`📱 [DEV MODE] Simple SMS OTP for ${phoneNumber}: ${otp}`);
      return {
        success: true,
        otp: otp,
        dev_mode: true,
        sessionId: `dev_simple_${Date.now()}`,
      };
    }

    // Format phone number
    let formattedPhone = phoneNumber.toString().trim().replace(/\D/g, "");
    if (formattedPhone.startsWith("91") && formattedPhone.length === 12) {
      formattedPhone = formattedPhone.substring(2);
    }

    if (!/^[6-9]\d{9}$/.test(formattedPhone)) {
      throw new Error("Invalid phone number format");
    }

    // Send OTP with basic SMS API (without template)
    const apiUrl = `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/SMS/${formattedPhone}/${otp}`;

    console.log(`📱 Sending simple SMS OTP: ${otp} to ${formattedPhone}`);

    const response = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": "KnockNFix/1.0",
        Accept: "application/json",
      },
    });

    console.log("✅ 2Factor.in simple response:", response.data);

    if (response.data && response.data.Status === "Success") {
      return {
        success: true,
        otp: otp,
        sessionId: response.data.Details,
        method: "Simple SMS",
      };
    } else {
      throw new Error(response.data?.Details || "Simple SMS sending failed");
    }
  } catch (error) {
    console.error("❌ Simple SMS error:", error);
    return {
      success: false,
      error: error.message || "Simple SMS sending failed",
    };
  }
};

// Verify AUTOGEN OTP using 2Factor.in API
const verifyOTPWithProvider = async (sessionId, otp) => {
  try {
    if (!process.env.TWOFACTOR_API_KEY) {
      // Development mode - accept any 6-digit OTP
      if (process.env.NODE_ENV === "development") {
        if (/^\d{6}$/.test(otp)) {
          console.log(
            `✅ [DEV MODE] OTP ${otp} accepted for session ${sessionId}`
          );
          return {success: true, dev_mode: true};
        } else {
          return {
            success: false,
            error: "Invalid OTP format - must be 6 digits",
          };
        }
      }
      return {success: false, error: "2Factor API key not configured"};
    }

    if (!sessionId) {
      return {success: false, error: "Session ID is required for verification"};
    }

    console.log(
      `🔍 Verifying OTP with 2Factor.in. Session ID: ${sessionId}, OTP: ${otp}`
    );

    const apiUrl = `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${otp}`;

    const response = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": "KnockNFix/1.0",
        Accept: "application/json",
      },
    });

    console.log("✅ 2Factor.in verify response:", response.data);

    if (response.data && response.data.Status === "Success") {
      console.log("✅ OTP verified successfully with 2Factor.in");
      return {success: true, verified_at: new Date().toISOString()};
    } else {
      console.warn("⚠️ OTP verification failed:", response.data);
      return {
        success: false,
        error: response.data?.Details || "OTP verification failed",
      };
    }
  } catch (error) {
    console.error("❌ OTP verification error:", error);
    return {
      success: false,
      error:
        error.response?.data?.Details ||
        error.message ||
        "OTP verification failed",
    };
  }
};

// Resend OTP function with rate limiting
const resendOTP = async (phoneNumber) => {
  try {
    console.log(`🔄 Resending OTP to ${phoneNumber}`);

    // Check if we can resend (with longer rate limit for resends)
    const rateLimitCheck = checkRateLimit(phoneNumber, 2); // 2 minutes for resend
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: `Please wait ${rateLimitCheck.remainingSeconds} seconds before requesting another OTP`,
        rateLimit: true,
        remainingSeconds: rateLimitCheck.remainingSeconds,
      };
    }

    // Try to send OTP with template first
    const result = await sendSmsOTP(phoneNumber, true); // Skip initial rate limit check

    if (result.success) {
      console.log(`✅ OTP resent successfully to ${phoneNumber}`);
      return {
        ...result,
        resent: true,
      };
    } else {
      // If template fails, try simple SMS as fallback
      console.log("⚠️ Template SMS failed, trying simple SMS fallback...");
      const fallbackResult = await sendSimpleSmsOTP(phoneNumber);

      if (fallbackResult.success) {
        return {
          ...fallbackResult,
          resent: true,
          fallback: true,
        };
      }

      return fallbackResult;
    }
  } catch (error) {
    console.error("❌ Resend OTP error:", error);
    return {
      success: false,
      error: error.message || "Failed to resend OTP",
    };
  }
};

// Debug function to test KnockNFixOTP template
const testKnockNFixTemplate = async (phoneNumber = "9156906881") => {
  console.log("\n=== KnockNFixOTP Template Test ===");
  console.log("Template Name: KnockNFixOTP");
  console.log("Template Status: APPROVED");
  console.log("Company: KnockNFix");
  console.log("Sender ID: KNKNFX");
  console.log(`Testing with phone: ${phoneNumber}`);

  // Test phone validation
  const validation = validatePhoneNumber(phoneNumber);
  console.log("Phone validation:", validation);

  if (!validation.isValid) {
    console.log("❌ Phone number is invalid, skipping SMS test");
    return;
  }

  // Test template SMS sending
  console.log("Testing KnockNFixOTP template SMS...");
  const smsResult = await sendSmsOTP(phoneNumber);
  console.log("Template SMS Result:", smsResult);

  if (smsResult.success && smsResult.dev_mode && smsResult.otp) {
    console.log(`💡 Use this OTP for testing: ${smsResult.otp}`);

    // Test OTP verification in dev mode
    const verifyResult = await verifyOTPWithProvider(
      smsResult.sessionId,
      smsResult.otp
    );
    console.log("Verification Result:", verifyResult);
  }

  console.log("====================================\n");
};

// Debug function to test phone number formatting
const validatePhoneNumber = (phoneNumber) => {
  console.log("\n=== Phone Number Validation Debug ===");
  console.log("Input:", phoneNumber);

  let formatted = phoneNumber.toString().trim().replace(/\D/g, "");
  console.log("After removing non-digits:", formatted);

  if (formatted.startsWith("91") && formatted.length === 12) {
    formatted = formatted.substring(2);
    console.log("After removing 91 prefix:", formatted);
  }

  const isValid = /^[6-9]\d{9}$/.test(formatted);
  console.log("Final formatted:", formatted);
  console.log("Length:", formatted.length);
  console.log("Is valid:", isValid);
  console.log("=========================================\n");

  return {formatted, isValid};
};

// Debug function to test 2Factor.in configuration
const test2FactorConfig = () => {
  console.log("\n=== 2Factor.in Configuration Debug ===");
  console.log("API Key configured:", !!process.env.TWOFACTOR_API_KEY);
  console.log(
    "API Key length:",
    process.env.TWOFACTOR_API_KEY ? process.env.TWOFACTOR_API_KEY.length : 0
  );
  console.log(
    "API Key preview:",
    process.env.TWOFACTOR_API_KEY
      ? process.env.TWOFACTOR_API_KEY.substring(0, 8) + "..."
      : "NOT SET"
  );
  console.log("Environment:", process.env.NODE_ENV);
  console.log("Template: KnockNFixOTP (APPROVED)");
  console.log("Sender ID: KNKNFX");
  console.log("AUTOGEN Mode: Enabled");
  console.log("============================================\n");
};

// Comprehensive OTP testing function
const testOTPSystem = async (phoneNumber = "9156906881") => {
  console.log("\n=== OTP System Test ===");

  // Test 2Factor config
  test2FactorConfig();

  // Test template specifically
  await testKnockNFixTemplate(phoneNumber);

  console.log("======================\n");
};

// Error code mapping for better error messages
const SMS_ERROR_CODES = {
  100: "Invalid phone number format",
  101: "OTP already sent to this number recently",
  102: "OTP has expired",
  103: "Maximum retry limit exceeded for this number",
  104: "Phone number is blacklisted",
  105: "Insufficient account balance",
  106: "Invalid API key",
  107: "SMS service temporarily unavailable",
  108: "Template not found or not approved",
  109: "Invalid template name",
  400: "Bad request - check phone number format",
  401: "Unauthorized - invalid API key",
  429: "Too many requests - rate limit exceeded",
  500: "Internal server error",
};

const getErrorMessage = (code) => {
  return SMS_ERROR_CODES[code] || "SMS service error - please try again";
};

// Get OTP expiry time (5 minutes as per template)
const getOTPExpiryTime = () => {
  return 5 * 60 * 1000; // 5 minutes in milliseconds
};

// Check if OTP has expired
const isOTPExpired = (timestamp) => {
  const now = Date.now();
  const expiryTime = getOTPExpiryTime();
  return now - timestamp > expiryTime;
};

module.exports = {
  generateOTP, // Manual OTP generation
  sendSmsOTP, // Primary function - uses KnockNFixOTP template
  sendSimpleSmsOTP, // Fallback - simple SMS without template
  verifyOTPWithProvider, // OTP verification with 2Factor.in
  resendOTP, // Resend OTP with rate limiting
  test2FactorConfig, // Debug function
  testKnockNFixTemplate, // Test approved template
  getErrorMessage, // Error message helper
  checkRateLimit, // Rate limiting function
  validatePhoneNumber, // Phone validation debug function
  testOTPSystem, // Comprehensive test function
  getOTPExpiryTime, // Get expiry time
  isOTPExpired, // Check if OTP expired
};
