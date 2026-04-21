const User = require("../../models/User");
const OTP = require("../../models/OTP");
const ServiceProvider = require("../../models/ServiceProvider");
const { sendSmsOTP, verifyOTPWithProvider, resendOTP } = require("../../utils/otp");
const {
  buildOtpRegistrationData,
  createVerifiedUserFromOtp,
} = require("./registerFlowHelpers");

const {
  isDevelopment,
  extractValue,
  cleanupUploadedFiles,
  wantsJson,
} = require("./helpers");
const { clearRegistrationSession } = require("./sessionHelpers");

const REGISTER_DATA_CORRUPTED_MESSAGE =
  "Registration data corrupted. Please register again.";
const REGISTER_MISSING_IMAGES_MESSAGE =
  "Document images missing. Please register again.";
const API_MISSING_PROVIDER_DATA_MESSAGE =
  "Required provider data missing. Please register again.";

const registerController = {
  showRegister: (req, res) => {
    res.render("pages/register", {
      title: "Register - KnockNFix",
    });
  },

  handleRegister: async (req, res) => {
    try {
      const name = extractValue(req.body.name);
      const phone = extractValue(req.body.phone);
      const role = extractValue(req.body.role);

      if (!name || name.length < 2) {
        req.flash(
          "error",
          "Name is required and must be at least 2 characters long"
        );
        return res.redirect("/register");
      }

      if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
        req.flash("error", "Valid 10-digit phone number is required");
        return res.redirect("/register");
      }

      if (!role || !["customer", "provider"].includes(role)) {
        req.flash("error", "Valid role (customer or provider) is required");
        return res.redirect("/register");
      }

      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        await cleanupUploadedFiles(req.files);
        req.flash("error", "Phone number already exists");
        return res.redirect("/register");
      }

      const userData = {
        name,
        phone,
        role,
        username: phone,
        status: "unverified",
      };

      if (role === "customer") {
        userData.addresses = [];
      } else if (role === "provider") {
        const email = extractValue(req.body.email);
        const street = extractValue(req.body.street);
        const city = extractValue(req.body.city);
        const state = extractValue(req.body.state);
        const pincode = extractValue(req.body.pincode);
        const aadharCard = extractValue(req.body.aadharCard);
        const panCard = extractValue(req.body.panCard).toUpperCase();

        if (!street || street.length < 5) {
          req.flash(
            "error",
            "Street address is required and must be at least 5 characters long"
          );
          return res.redirect("/register");
        }

        if (!city || city.length < 2) {
          req.flash(
            "error",
            "City is required and must be at least 2 characters long"
          );
          return res.redirect("/register");
        }

        if (!state || state.length < 2) {
          req.flash(
            "error",
            "State is required and must be at least 2 characters long"
          );
          return res.redirect("/register");
        }

        if (!pincode || !/^\d{6}$/.test(pincode)) {
          req.flash("error", "Valid 6-digit pin code is required");
          return res.redirect("/register");
        }

        if (!aadharCard || !/^\d{12}$/.test(aadharCard)) {
          req.flash("error", "Valid 12-digit Aadhar card number is required");
          return res.redirect("/register");
        }

        if (!panCard || !/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(panCard)) {
          req.flash(
            "error",
            "Valid PAN card number is required (Format: ABCDE1234F)"
          );
          return res.redirect("/register");
        }

        if (email) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            req.flash("error", "Valid email address is required");
            return res.redirect("/register");
          }

          const existingEmail = await User.findOne({ email });
          if (existingEmail) {
            await cleanupUploadedFiles(req.files);
            req.flash("error", "Email already exists");
            return res.redirect("/register");
          }
          userData.email = email;
        }

        const existingAadhar = await ServiceProvider.findOne({ aadharCard });
        if (existingAadhar) {
          req.flash("error", "Aadhar card number already registered");
          return res.redirect("/register");
        }

        const existingPan = await ServiceProvider.findOne({ panCard });
        if (existingPan) {
          req.flash("error", "PAN card number already registered");
          return res.redirect("/register");
        }

        userData.addresses = [
          {
            street,
            city,
            state,
            pincode,
            isDefault: true,
            label: "Business Address",
          },
        ];

        userData.providerData = {
          aadharCard,
          panCard,
        };

        if (req.files) {
          if (req.files.profileImage && req.files.profileImage[0]) {
            userData.profileImage = req.files.profileImage[0].path;
          }

          if (!req.files.aadharImage || !req.files.aadharImage[0]) {
            req.flash(
              "error",
              "Aadhar card image is required for service providers"
            );
            return res.redirect("/register");
          }

          if (!req.files.panImage || !req.files.panImage[0]) {
            req.flash(
              "error",
              "PAN card image is required for service providers"
            );
            return res.redirect("/register");
          }

          userData.providerData.aadharImage = req.files.aadharImage[0].path;
          userData.providerData.panImage = req.files.panImage[0].path;
        } else {
          req.flash(
            "error",
            "Document images are required for service providers"
          );
          return res.redirect("/register");
        }
      }

      if (
        role === "customer" &&
        req.files &&
        req.files.profileImage &&
        req.files.profileImage[0]
      ) {
        userData.profileImage = req.files.profileImage[0].path;
      }

      await OTP.deleteMany({ phone });

      const smsResult = await sendSmsOTP(phone);

      if (!smsResult.success) {
        if (smsResult.rateLimit) {
          req.flash("error", "Please wait before requesting another OTP");
          return res.redirect("/register");
        }

        if (process.env.NODE_ENV !== "development") {
          req.flash("error", `Failed to send SMS OTP: ${smsResult.error}`);
          return res.redirect("/register");
        }
      }

      const otpUserData = buildOtpRegistrationData(userData);
      const otpDoc = new OTP({
        phone,
        phoneOTP: smsResult.dev_mode ? smsResult.otp : "AUTOGEN",
        userData: otpUserData,
        sessionId: smsResult.sessionId,
      });

      await otpDoc.save();

      req.session.verificationPhone = phone;
      req.session.userRole = role;
      req.session.otpSessionId = smsResult.sessionId;

      res.redirect("/verify-otp");
    } catch (err) {
      await cleanupUploadedFiles(req.files);

      req.flash(
        "error",
        err.message || "Registration failed. Please try again."
      );
      res.redirect("/register");
    }
  },

  showVerifyOTP: (req, res) => {
    const phone = req.session.verificationPhone;
    const userRole = req.session.userRole;

    if (!phone) {
      req.flash("error", "Please register first");
      return res.redirect("/register");
    }

    res.render("pages/verify-otp", {
      phone,
      userRole,
      title: "Verify Registration - KnockNFix",
      pageType: "registration",
      formAction: "/verify-otp",
      backLink: "/register",
      backText: "Back to Registration",
      submitText: "Verify Account",
      icon: "fas fa-mobile-alt",
      pageTitle: "Verify Your Phone Number",
      description: "We've sent a 6-digit verification code to",
      infoText: "Code expires in",
      resendEndpoint: "/resend-otp",
      inputName: "phoneOTP",
    });
  },

  handleVerifyOTP: async (req, res) => {
    try {
      const { phoneOTP } = req.body;
      const phone = req.session.verificationPhone;
      const sessionId = req.session.otpSessionId;

      if (!phone) {
        req.flash(
          "error",
          "Verification session expired. Please register again."
        );
        return res.redirect("/register");
      }

      const otpDoc = await OTP.findOne({ phone });
      if (!otpDoc) {
        req.flash("error", "Verification code expired. Please register again.");
        return res.redirect("/register");
      }

      let otpValid = false;

      if (isDevelopment()) {
        otpValid = true;
      } else {
        if (
          process.env.TWOFACTOR_API_KEY &&
          sessionId &&
          !sessionId.includes("dev_session")
        ) {
          const verifyResult = await verifyOTPWithProvider(sessionId, phoneOTP);
          otpValid = verifyResult.success;

          if (!verifyResult.success) {
            req.flash(
              "error",
              `Phone verification failed: ${verifyResult.error}`
            );
            return res.redirect("/verify-otp");
          }
        } else {
          otpValid = phoneOTP === otpDoc.phoneOTP;

          if (!otpValid) {
            req.flash("error", "Phone verification code is invalid.");
            return res.redirect("/verify-otp");
          }
        }
      }

      const userData = otpDoc.userData;

      try {
        await createVerifiedUserFromOtp(userData, {
          allowMissingProviderImages: false,
          missingProviderDataMessage: REGISTER_DATA_CORRUPTED_MESSAGE,
          missingProviderImagesMessage: REGISTER_MISSING_IMAGES_MESSAGE,
        });
      } catch (registrationError) {
        if (
          registrationError.message === REGISTER_DATA_CORRUPTED_MESSAGE ||
          registrationError.message === REGISTER_MISSING_IMAGES_MESSAGE
        ) {
          req.flash("error", registrationError.message);
          return res.redirect("/register");
        }

        throw registrationError;
      }

      await OTP.deleteOne({ phone });
      clearRegistrationSession(req);

      const successMessage =
        userData.role === "customer"
          ? "🎉 Account created successfully! You can now log in."
          : "🎉 Provider account created successfully! Your account is pending admin approval. You will be notified once verified.";

      req.flash("success", successMessage);
      res.redirect("/login");
    } catch (err) {
      req.flash(
        "error",
        err.message || "Verification failed. Please try again."
      );
      res.redirect("/verify-otp");
    }
  },

  resendOTP: async (req, res) => {
    try {
      const phone = req.session.verificationPhone;

      if (!phone) {
        const errorMessage = "Session expired, please register again";

        if (wantsJson(req)) {
          return res.status(400).json({
            success: false,
            message: errorMessage,
          });
        }

        req.flash("error", errorMessage);
        return res.redirect("/register");
      }

      const otpDoc = await OTP.findOne({ phone });
      if (!otpDoc) {
        const errorMessage = "Verification data expired, please register again";

        if (wantsJson(req)) {
          return res.status(400).json({
            success: false,
            message: errorMessage,
          });
        }

        req.flash("error", errorMessage);
        return res.redirect("/register");
      }

      const resendResult = await resendOTP(phone);

      if (!resendResult.success) {
        if (resendResult.rateLimit) {
          if (wantsJson(req)) {
            return res.status(429).json({
              success: false,
              message: resendResult.error,
              remainingSeconds: resendResult.remainingSeconds,
              rateLimit: true,
            });
          }

          req.flash("error", resendResult.error);
          return res.redirect("/verify-otp");
        }

        const errorMessage =
          resendResult.error || "Failed to resend verification code";

        if (wantsJson(req)) {
          return res.status(500).json({
            success: false,
            message: errorMessage,
          });
        }

        req.flash("error", errorMessage);
        return res.redirect("/verify-otp");
      }

      otpDoc.phoneOTP = resendResult.dev_mode ? resendResult.otp : "AUTOGEN";
      otpDoc.sessionId = resendResult.sessionId;
      otpDoc.createdAt = Date.now();
      await otpDoc.save();

      req.session.otpSessionId = resendResult.sessionId;

      const successMessage = resendResult.fallback
        ? "Verification code sent successfully (backup method)"
        : "Verification code sent successfully";

      if (wantsJson(req)) {
        return res.json({
          success: true,
          smsSent: resendResult.success,
          message: successMessage,
          resent: true,
          fallback: resendResult.fallback || false,
        });
      }

      req.flash("success", successMessage);
      return res.redirect("/verify-otp");
    } catch (err) {
      const errorMessage = err.message || "Failed to resend verification code";

      if (wantsJson(req)) {
        return res.status(500).json({
          success: false,
          message: errorMessage,
        });
      }

      req.flash("error", errorMessage);
      return res.redirect("/verify-otp");
    }
  },

  handleRegisterAPI: async (req, res) => {
    try {
      const name = extractValue(req.body.name);
      const phone = extractValue(req.body.phone);
      const role = extractValue(req.body.role);

      if (!name || name.length < 2) {
        return res.status(400).json({
          success: false,
          error: "Name is required and must be at least 2 characters long",
        });
      }

      if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          error: "Valid 10-digit phone number is required",
        });
      }

      if (!role || !["customer", "provider"].includes(role)) {
        return res.status(400).json({
          success: false,
          error: "Valid role (customer or provider) is required",
        });
      }

      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          error: "Phone number already exists",
        });
      }

      if (role === "customer") {
        if (!name || !phone) {
          return res.status(400).json({
            success: false,
            error: "Name and phone number are required for customers",
          });
        }
      } else if (role === "provider") {
        const email = extractValue(req.body.email);
        const street = extractValue(req.body.street);
        const city = extractValue(req.body.city);
        const state = extractValue(req.body.state);
        const pincode = extractValue(req.body.pincode);
        const aadharCard = extractValue(req.body.aadharCard);
        const panCard = extractValue(req.body.panCard);

        if (
          !name ||
          !phone ||
          !street ||
          !city ||
          !state ||
          !pincode ||
          !aadharCard ||
          !panCard
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Name, phone, address, Aadhar and PAN are required for service providers",
          });
        }

        if (email && email.trim()) {
          const existingEmail = await User.findOne({ email: email.trim() });
          if (existingEmail) {
            return res.status(400).json({
              success: false,
              error: "Email already exists",
            });
          }
        }

        const existingAadhar = await ServiceProvider.findOne({ aadharCard });
        if (existingAadhar) {
          return res.status(400).json({
            success: false,
            error: "Aadhar card number already registered",
          });
        }

        const existingPan = await ServiceProvider.findOne({ panCard });
        if (existingPan) {
          return res.status(400).json({
            success: false,
            error: "PAN card number already registered",
          });
        }
      }

      const userData = {
        name,
        phone,
        role,
        status: "unverified",
      };

      if (role === "customer") {
        userData.username = phone;
        userData.addresses = [];
      } else if (role === "provider") {
        const email = extractValue(req.body.email);
        const street = extractValue(req.body.street);
        const city = extractValue(req.body.city);
        const state = extractValue(req.body.state);
        const pincode = extractValue(req.body.pincode);
        const aadharCard = extractValue(req.body.aadharCard);
        const panCard = extractValue(req.body.panCard);

        userData.username = phone;

        if (email && email.trim()) {
          userData.email = email;
        }

        userData.addresses = [
          {
            street,
            city,
            state,
            pincode,
            isDefault: true,
            label: "Business Address",
          },
        ];

        userData.providerData = {
          aadharCard,
          panCard,
        };
      }

      await OTP.deleteMany({ phone });

      const smsResult = await sendSmsOTP(phone);

      if (!smsResult.success && process.env.NODE_ENV !== "development") {
        return res.status(500).json({
          success: false,
          error: `Failed to send SMS OTP: ${smsResult.error}`,
        });
      }

      const otpUserData = buildOtpRegistrationData(userData);
      const otpDoc = new OTP({
        phone,
        phoneOTP: smsResult.dev_mode ? smsResult.otp : "AUTOGEN",
        userData: otpUserData,
        sessionId: smsResult.sessionId,
      });

      await otpDoc.save();

      req.session.verificationPhone = phone;
      req.session.userRole = role;
      req.session.otpSessionId = smsResult.sessionId;

      return res.json({
        success: true,
        message: "OTP sent successfully",
        phone,
        sessionId: smsResult.sessionId,
        devMode: smsResult.dev_mode,
        ...(smsResult.dev_mode && { otp: smsResult.otp }),
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message || "Registration failed",
      });
    }
  },

  handleVerifyOTPAPI: async (req, res) => {
    try {
      const { phoneOTP } = req.body;
      const phone = req.session.verificationPhone;
      const sessionId = req.session.otpSessionId;

      if (!phone) {
        return res.status(400).json({
          success: false,
          error: "Verification session expired. Please register again.",
        });
      }

      const otpDoc = await OTP.findOne({ phone });
      if (!otpDoc) {
        return res.status(400).json({
          success: false,
          error: "Verification code expired. Please register again.",
        });
      }

      let otpValid = false;

      if (isDevelopment()) {
        otpValid = true;
      } else {
        if (
          process.env.TWOFACTOR_API_KEY &&
          sessionId &&
          !sessionId.includes("dev_session")
        ) {
          const verifyResult = await verifyOTPWithProvider(sessionId, phoneOTP);
          otpValid = verifyResult.success;

          if (!verifyResult.success) {
            return res.status(400).json({
              success: false,
              error: `Phone verification failed: ${verifyResult.error}`,
            });
          }
        } else {
          otpValid = phoneOTP === otpDoc.phoneOTP;

          if (!otpValid) {
            return res.status(400).json({
              success: false,
              error: "Phone verification code is invalid.",
            });
          }
        }
      }

      const userData = otpDoc.userData;

      let registrationResult;
      try {
        registrationResult = await createVerifiedUserFromOtp(userData, {
          allowMissingProviderImages: true,
          missingProviderDataMessage: API_MISSING_PROVIDER_DATA_MESSAGE,
        });
      } catch (registrationError) {
        if (registrationError.message === API_MISSING_PROVIDER_DATA_MESSAGE) {
          return res.status(400).json({
            success: false,
            error: registrationError.message,
          });
        }

        throw registrationError;
      }

      const { registeredUser, userStatus } = registrationResult;

      await OTP.deleteOne({ phone });
      clearRegistrationSession(req);

      const successMessage =
        userData.role === "customer"
          ? "🎉 Account created successfully! You can now log in."
          : "🎉 Provider account created successfully! Your account is pending admin approval. You will be notified once verified.";

      const devSuffix = isDevelopment() ? " (Dev Mode)" : "";

      return res.json({
        success: true,
        message: successMessage + devSuffix,
        user: {
          id: registeredUser._id,
          name: registeredUser.name,
          phone: registeredUser.phone,
          role: registeredUser.role,
          isPhoneVerified: true,
          status: userStatus,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message || "Verification failed",
      });
    }
  },
};

module.exports = registerController;
