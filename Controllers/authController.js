const bcrypt = require("bcryptjs");
const User = require("../models/User");
const OTP = require("../models/OTP");
const ServiceProvider = require("../models/ServiceProvider");
const cloudinary = require("cloudinary").v2;
const {sendSmsOTP, verifyOTPWithProvider, resendOTP} = require("../utils/otp");
const crypto = require("crypto");
const {notifyAdminNewProvider} = require("../utils/adminNotifications");

const authController = {
  // Render registration form
  showRegister: (req, res) => {
    res.render("pages/register", {
      title: "Register - KnockNFix",
    });
  },

  // Helper function to extract value (handle both arrays and strings)
  extractValue: (value) => {
    if (!value) return "";
    if (Array.isArray(value)) {
      const nonEmpty = value.filter((v) => v && v.toString().trim() !== "");
      return nonEmpty.length > 0 ? nonEmpty[0].toString().trim() : "";
    }
    return value.toString().trim();
  },

  handleRegister: async (req, res) => {
    try {
      const name = authController.extractValue(req.body.name);
      const phone = authController.extractValue(req.body.phone);
      const role = authController.extractValue(req.body.role);

      // Basic validation
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

      // Check if phone already exists
      const existingPhone = await User.findOne({phone});
      if (existingPhone) {
        if (req.files) {
          for (const fieldname in req.files) {
            const files = req.files[fieldname];
            for (const file of files) {
              try {
                await cloudinary.uploader.destroy(file.filename);
              } catch (cleanupError) {
                // Silent cleanup
              }
            }
          }
        }
        req.flash("error", "Phone number already exists");
        return res.redirect("/register");
      }

      let userData = {
        name,
        phone,
        role,
        username: phone,
        status: "unverified",
      };

      if (role === "customer") {
        userData.addresses = [];
      } else if (role === "provider") {
        const email = authController.extractValue(req.body.email);
        const street = authController.extractValue(req.body.street);
        const city = authController.extractValue(req.body.city);
        const state = authController.extractValue(req.body.state);
        const pincode = authController.extractValue(req.body.pincode);
        const aadharCard = authController.extractValue(req.body.aadharCard);
        const panCard = authController
          .extractValue(req.body.panCard)
          .toUpperCase();

        // Required fields validation for providers
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

        // Check if email already exists (only if email is provided)
        if (email) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            req.flash("error", "Valid email address is required");
            return res.redirect("/register");
          }

          const existingEmail = await User.findOne({email});
          if (existingEmail) {
            if (req.files) {
              for (const fieldname in req.files) {
                const files = req.files[fieldname];
                for (const file of files) {
                  try {
                    await cloudinary.uploader.destroy(file.filename);
                  } catch (cleanupError) {
                    // Silent cleanup
                  }
                }
              }
            }
            req.flash("error", "Email already exists");
            return res.redirect("/register");
          }
          userData.email = email;
        }

        // Check if Aadhar already exists
        const existingAadhar = await ServiceProvider.findOne({aadharCard});
        if (existingAadhar) {
          req.flash("error", "Aadhar card number already registered");
          return res.redirect("/register");
        }

        // Check if PAN already exists
        const existingPan = await ServiceProvider.findOne({panCard});
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

        // Handle file uploads for providers
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

      // Add profile image for customers too if uploaded
      if (
        role === "customer" &&
        req.files &&
        req.files.profileImage &&
        req.files.profileImage[0]
      ) {
        userData.profileImage = req.files.profileImage[0].path;
      }

      // Delete any existing OTP documents for this phone
      await OTP.deleteMany({phone});

      // Send SMS OTP
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

      // Store OTP session data
      const otpDoc = new OTP({
        phone,
        phoneOTP: smsResult.dev_mode ? smsResult.otp : "AUTOGEN",
        userData,
        sessionId: smsResult.sessionId,
      });

      await otpDoc.save();

      req.session.verificationPhone = phone;
      req.session.userRole = role;
      req.session.otpSessionId = smsResult.sessionId;

      res.redirect("/verify-otp");
    } catch (err) {
      // Clean up uploaded files on error
      if (req.files) {
        for (const fieldname in req.files) {
          const files = req.files[fieldname];
          for (const file of files) {
            try {
              await cloudinary.uploader.destroy(file.filename);
            } catch (cleanupError) {
              // Silent cleanup
            }
          }
        }
      }

      req.flash(
        "error",
        err.message || "Registration failed. Please try again."
      );
      res.redirect("/register");
    }
  },

  // Show OTP verification page
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
      const {phoneOTP} = req.body;
      const phone = req.session.verificationPhone;
      const sessionId = req.session.otpSessionId;

      if (!phone) {
        req.flash(
          "error",
          "Verification session expired. Please register again."
        );
        return res.redirect("/register");
      }

      const otpDoc = await OTP.findOne({phone});
      if (!otpDoc) {
        req.flash("error", "Verification code expired. Please register again.");
        return res.redirect("/register");
      }

      let otpValid = false;

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

      const userData = otpDoc.userData;

      const newUser = new User({
        name: userData.name,
        username: userData.username,
        phone: userData.phone,
        role: userData.role,
        profileImage: userData.profileImage,
        addresses: userData.addresses || [],
        isPhoneVerified: true,
      });

      if (userData.role === "provider" && userData.email) {
        newUser.email = userData.email;
      }

      const tempPassword = crypto.randomBytes(16).toString("hex");
      const registeredUser = await User.register(newUser, tempPassword);

      // 🔥 UPDATE: Different status based on role
      let userStatus = "active";
      if (userData.role === "provider") {
        userStatus = "pending_approval"; // Providers need admin approval
      }

      await User.findByIdAndUpdate(registeredUser._id, {
        status: userStatus,
        isPhoneVerified: true,
      });

      if (userData.role === "provider") {
        if (!userData.providerData) {
          req.flash(
            "error",
            "Registration data corrupted. Please register again."
          );
          return res.redirect("/register");
        }

        if (
          !userData.providerData.aadharImage ||
          !userData.providerData.panImage
        ) {
          req.flash("error", "Document images missing. Please register again.");
          return res.redirect("/register");
        }

        const newProvider = new ServiceProvider({
          user: registeredUser._id,
          servicesOffered: [],
          portfolio: [],
          aadharCard: userData.providerData.aadharCard,
          panCard: userData.providerData.panCard,
          aadharImage: userData.providerData.aadharImage,
          panImage: userData.providerData.panImage,
          // 🔥 NEW: Set to pending with no access
          verificationStatus: "pending",
          canRegisterServices: false,
          dashboardAccess: false,
          canReceiveBookings: false,
          canAccessPayouts: false,
          businessAddress: userData.addresses[0],
          documentVerification: {
            aadharVerified: false,
            panVerified: false,
            imagesVerified: false,
            allDocumentsVerified: false,
          },
          // Legacy fields for backward compatibility
          isVerified: false,
        });

        await newProvider.save();

        // 🔥 NEW: Notify admin about new provider registration
        await notifyAdminNewProvider(registeredUser._id);
      }

      await OTP.deleteOne({phone});

      delete req.session.verificationPhone;
      delete req.session.userRole;
      delete req.session.otpSessionId;

      // 🔥 UPDATE: Different success messages
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

  // Resend OTP
  resendOTP: async (req, res) => {
    try {
      const phone = req.session.verificationPhone;

      if (!phone) {
        const errorMessage = "Session expired, please register again";

        if (
          req.headers.accept &&
          req.headers.accept.includes("application/json")
        ) {
          return res.status(400).json({
            success: false,
            message: errorMessage,
          });
        } else {
          req.flash("error", errorMessage);
          return res.redirect("/register");
        }
      }

      const otpDoc = await OTP.findOne({phone});
      if (!otpDoc) {
        const errorMessage = "Verification data expired, please register again";

        if (
          req.headers.accept &&
          req.headers.accept.includes("application/json")
        ) {
          return res.status(400).json({
            success: false,
            message: errorMessage,
          });
        } else {
          req.flash("error", errorMessage);
          return res.redirect("/register");
        }
      }

      const resendResult = await resendOTP(phone);

      if (!resendResult.success) {
        if (resendResult.rateLimit) {
          if (
            req.headers.accept &&
            req.headers.accept.includes("application/json")
          ) {
            return res.status(429).json({
              success: false,
              message: resendResult.error,
              remainingSeconds: resendResult.remainingSeconds,
              rateLimit: true,
            });
          } else {
            req.flash("error", resendResult.error);
            return res.redirect("/verify-otp");
          }
        }

        const errorMessage =
          resendResult.error || "Failed to resend verification code";

        if (
          req.headers.accept &&
          req.headers.accept.includes("application/json")
        ) {
          return res.status(500).json({
            success: false,
            message: errorMessage,
          });
        } else {
          req.flash("error", errorMessage);
          return res.redirect("/verify-otp");
        }
      }

      otpDoc.phoneOTP = resendResult.dev_mode ? resendResult.otp : "AUTOGEN";
      otpDoc.sessionId = resendResult.sessionId;
      otpDoc.createdAt = Date.now();
      await otpDoc.save();

      req.session.otpSessionId = resendResult.sessionId;

      const successMessage = resendResult.fallback
        ? "Verification code sent successfully (backup method)"
        : "Verification code sent successfully";

      if (
        req.headers.accept &&
        req.headers.accept.includes("application/json")
      ) {
        res.json({
          success: true,
          smsSent: resendResult.success,
          message: successMessage,
          resent: true,
          fallback: resendResult.fallback || false,
        });
      } else {
        req.flash("success", successMessage);
        res.redirect("/verify-otp");
      }
    } catch (err) {
      const errorMessage = err.message || "Failed to resend verification code";

      if (
        req.headers.accept &&
        req.headers.accept.includes("application/json")
      ) {
        res.status(500).json({
          success: false,
          message: errorMessage,
        });
      } else {
        req.flash("error", errorMessage);
        res.redirect("/verify-otp");
      }
    }
  },

  // Show login page
  showLogin: (req, res) => {
    res.render("pages/login", {
      title: "Login - KnockNFix",
    });
  },

  // 🔥 UPDATED: Handle login with approval status checks
  handleLogin: async (req, res, next) => {
    try {
      const {phone} = req.body;

      const user = await User.findOne({phone});
      if (!user) {
        req.flash("error", "📱 Phone number not registered");
        return res.redirect("/login");
      }

      // 🔥 NEW: Check user status before allowing login
      if (user.status === "pending_approval") {
        req.flash(
          "error",
          "⏳ Your account is pending admin approval. Please wait for verification."
        );
        return res.redirect("/login");
      }

      if (user.status === "rejected") {
        const reason =
          user.approvalStatus?.rejectionReason ||
          "Please contact support for details.";
        req.flash(
          "error",
          `❌ Your account has been rejected. Reason: ${reason}`
        );
        return res.redirect("/login");
      }

      if (user.status === "suspended") {
        req.flash(
          "error",
          "🚫 Your account has been suspended. Please contact support."
        );
        return res.redirect("/login");
      }

      if (user.status !== "active") {
        req.flash("error", "Account is not active. Please contact support.");
        return res.redirect("/login");
      }

      // ... rest of existing login code ...
      const smsResult = await sendSmsOTP(phone);

      if (!smsResult.success) {
        if (smsResult.rateLimit) {
          req.flash("error", "Please wait before requesting another OTP");
          return res.redirect("/login");
        }

        if (process.env.NODE_ENV !== "development") {
          req.flash("error", "Unable to send OTP. Please try again.");
          return res.redirect("/login");
        }
      }

      req.session.verificationPhone = phone;
      req.session.loginOTP = smsResult.dev_mode ? smsResult.otp : null;
      req.session.loginSessionId = smsResult.sessionId;
      req.session.loginUserId = user._id;

      const loginUserData = {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        username: user.username,
        email: user.email || null,
        profileImage: user.profileImage || null,
        addresses: user.addresses || [],
        status: user.status,
        isLoginAttempt: true,
        timestamp: new Date(),
        sessionType: "login",
      };

      await OTP.deleteMany({phone});
      const otpDoc = new OTP({
        phone,
        phoneOTP: smsResult.dev_mode ? smsResult.otp : "AUTOGEN",
        userData: loginUserData,
        sessionId: smsResult.sessionId,
      });

      await otpDoc.save();

      req.flash("success", "📱 OTP sent to your phone number");
      res.redirect("/verify-login-otp");
    } catch (err) {
      req.flash("error", "Login failed. Please try again.");
      res.redirect("/login");
    }
  },

  // Show verify login OTP page
  showVerifyLoginOTP: (req, res) => {
    try {
      const phone = req.session.verificationPhone;

      if (!phone) {
        req.flash(
          "error",
          "No login session found. Please try logging in again."
        );
        return res.redirect("/login");
      }

      res.render("pages/verify-otp", {
        phone,
        title: "Verify Login - KnockNFix",
        pageType: "login",
        formAction: "/verify-login-otp",
        backLink: "/login",
        backText: "Back to Login",
        submitText: "Sign In",
        icon: "fas fa-sign-in-alt",
        pageTitle: "Verify Login Code",
        description: "We've sent a 6-digit login code to",
        infoText: "Login code expires in",
        resendEndpoint: "/resend-login-otp",
        inputName: "phoneOTP",
      });
    } catch (err) {
      req.flash("error", "An error occurred. Please try again.");
      res.redirect("/login");
    }
  },

  handleVerifyLoginOTP: async (req, res, next) => {
    try {
      const {phoneOTP} = req.body;
      const phone = req.session.verificationPhone;
      const sessionId = req.session.loginSessionId;

      if (!phone) {
        req.flash(
          "error",
          "Login session expired. Please try logging in again."
        );
        return res.redirect("/login");
      }

      if (!phoneOTP || phoneOTP.trim() === "") {
        req.flash("error", "Please enter the 6-digit OTP");
        return res.redirect("/verify-login-otp");
      }

      const cleanOTP = phoneOTP.trim();

      if (!/^\d{6}$/.test(cleanOTP)) {
        req.flash("error", "Please enter a valid 6-digit OTP");
        return res.redirect("/verify-login-otp");
      }

      const otpDoc = await OTP.findOne({phone});

      if (!otpDoc) {
        req.flash("error", "Login code expired. Please request a new one.");
        return res.redirect("/login");
      }

      if (!otpDoc.userData || !otpDoc.userData.isLoginAttempt) {
        req.flash(
          "error",
          "Invalid login session. Please try logging in again."
        );
        return res.redirect("/login");
      }

      let otpValid = false;

      if (
        process.env.TWOFACTOR_API_KEY &&
        sessionId &&
        !sessionId.includes("dev_session")
      ) {
        const verifyResult = await verifyOTPWithProvider(sessionId, cleanOTP);
        otpValid = verifyResult.success;

        if (!verifyResult.success) {
          req.flash(
            "error",
            `Login verification failed: ${verifyResult.error}`
          );
          return res.redirect("/verify-login-otp");
        }
      } else {
        otpValid = cleanOTP === otpDoc.phoneOTP;

        if (!otpValid) {
          req.flash("error", "Invalid login code. Please try again.");
          return res.redirect("/verify-login-otp");
        }
      }

      const userId = otpDoc.userData._id;
      const user = await User.findById(userId);

      if (!user) {
        req.flash("error", "User not found. Please register first.");
        return res.redirect("/register");
      }

      // 🔥 ADDITIONAL CHECK: Verify user status again during login verification
      if (user.status === "pending_approval") {
        req.flash("error", "⏳ Your account is still pending admin approval.");
        return res.redirect("/login");
      }

      if (user.status === "rejected") {
        const reason =
          user.approvalStatus?.rejectionReason || "Please contact support.";
        req.flash(
          "error",
          `❌ Your account has been rejected. Reason: ${reason}`
        );
        return res.redirect("/login");
      }

      if (user.status !== "active") {
        req.flash("error", "Account is not active. Please contact support.");
        return res.redirect("/login");
      }

      req.login(user, async (err) => {
        if (err) {
          req.flash("error", "Login failed. Please try again.");
          return res.redirect("/login");
        }

        req.session.userId = user._id;

        await User.findByIdAndUpdate(user._id, {
          lastLogin: new Date(),
        });

        await OTP.deleteOne({phone});
        delete req.session.verificationPhone;
        delete req.session.loginOTP;
        delete req.session.loginSessionId;
        delete req.session.loginUserId;

        req.flash("success", `Welcome back, ${user.name}!`);

        // 🔥 NEW: Redirect based on user role and status
        if (user.role === "provider") {
          // Check if provider has dashboard access
          const serviceProvider = await ServiceProvider.findOne({
            user: user._id,
          });
          if (serviceProvider && serviceProvider.dashboardAccess) {
            return res.redirect("/provider/dashboard");
          } else {
            return res.redirect("/provider/pending-approval");
          }
        } else if (user.role === "admin") {
          return res.redirect("/admin/dashboard");
        } else {
          return res.redirect("/");
        }
      });
    } catch (err) {
      req.flash("error", "Login verification failed. Please try again.");
      res.redirect("/login");
    }
  },

  // Resend login OTP
  resendLoginOTP: async (req, res) => {
    try {
      const phone = req.session.verificationPhone;
      const userId = req.session.loginUserId;

      if (!phone || !userId) {
        const errorMessage = "Session expired, please try logging in again";

        if (
          req.headers.accept &&
          req.headers.accept.includes("application/json")
        ) {
          return res.status(400).json({
            success: false,
            message: errorMessage,
          });
        } else {
          req.flash("error", errorMessage);
          return res.redirect("/login");
        }
      }

      const user = await User.findById(userId);
      if (!user) {
        const errorMessage = "User not found, please try logging in again";

        if (
          req.headers.accept &&
          req.headers.accept.includes("application/json")
        ) {
          return res.status(400).json({
            success: false,
            message: errorMessage,
          });
        } else {
          req.flash("error", errorMessage);
          return res.redirect("/login");
        }
      }

      const resendResult = await resendOTP(phone);

      if (!resendResult.success) {
        if (resendResult.rateLimit) {
          if (
            req.headers.accept &&
            req.headers.accept.includes("application/json")
          ) {
            return res.status(429).json({
              success: false,
              message: resendResult.error,
              remainingSeconds: resendResult.remainingSeconds,
              rateLimit: true,
            });
          } else {
            req.flash("error", resendResult.error);
            return res.redirect("/verify-login-otp");
          }
        }

        const errorMessage = resendResult.error || "Failed to resend login OTP";

        if (
          req.headers.accept &&
          req.headers.accept.includes("application/json")
        ) {
          return res.status(500).json({
            success: false,
            message: errorMessage,
          });
        } else {
          req.flash("error", errorMessage);
          return res.redirect("/verify-login-otp");
        }
      }

      const loginUserData = {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        username: user.username,
        email: user.email || null,
        profileImage: user.profileImage || null,
        addresses: user.addresses || [],
        status: user.status,
        isLoginAttempt: true,
        timestamp: new Date(),
        sessionType: "login_resend",
      };

      let otpDoc = await OTP.findOne({phone});
      if (otpDoc) {
        otpDoc.phoneOTP = resendResult.dev_mode ? resendResult.otp : "AUTOGEN";
        otpDoc.sessionId = resendResult.sessionId;
        otpDoc.userData = loginUserData;
        otpDoc.createdAt = Date.now();
        await otpDoc.save();
      } else {
        otpDoc = new OTP({
          phone,
          phoneOTP: resendResult.dev_mode ? resendResult.otp : "AUTOGEN",
          userData: loginUserData,
          sessionId: resendResult.sessionId,
        });
        await otpDoc.save();
      }

      req.session.loginOTP = resendResult.dev_mode ? resendResult.otp : null;
      req.session.loginSessionId = resendResult.sessionId;

      const successMessage = "Login OTP sent successfully";

      if (
        req.headers.accept &&
        req.headers.accept.includes("application/json")
      ) {
        res.json({
          success: true,
          message: successMessage,
          resent: true,
          fallback: resendResult.fallback || false,
        });
      } else {
        req.flash("success", successMessage);
        res.redirect("/verify-login-otp");
      }
    } catch (err) {
      const errorMessage = err.message || "Failed to resend login OTP";

      if (
        req.headers.accept &&
        req.headers.accept.includes("application/json")
      ) {
        res.status(500).json({
          success: false,
          message: errorMessage,
        });
      } else {
        req.flash("error", errorMessage);
        res.redirect("/verify-login-otp");
      }
    }
  },

  // Handle logout
  handleLogout: async (req, res, next) => {
    try {
      req.logout((err) => {
        if (err) {
          return next(err);
        }

        req.session.destroy((err) => {
          if (err) {
            // Silent error handling
          }
        });

        req.flash("success", "👋 User logged out successfully");
        res.redirect("/login");
      });
    } catch (err) {
      return next(err);
    }
  },

  // Helper function: Check OTP session status
  checkOTPSession: (req, res) => {
    const phone = req.session.verificationPhone || req.session.loginPhone;
    const sessionId = req.session.otpSessionId || req.session.loginSessionId;

    if (!phone || !sessionId) {
      return res.json({
        success: false,
        message: "No active OTP session",
      });
    }

    res.json({
      success: true,
      phone: phone.replace(/(\d{2})(\d{4})(\d{4})/, "$1****$3"),
      sessionActive: true,
    });
  },

  // Helper function: Clear OTP session
  clearOTPSession: (req, res) => {
    try {
      delete req.session.verificationPhone;
      delete req.session.userRole;
      delete req.session.otpSessionId;
      delete req.session.loginPhone;
      delete req.session.loginOTP;
      delete req.session.loginSessionId;
      delete req.session.loginUserId;

      res.json({
        success: true,
        message: "OTP session cleared successfully",
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to clear OTP session",
      });
    }
  },

  // Get remaining OTP time
  getOTPStatus: async (req, res) => {
    try {
      const phone = req.session.verificationPhone || req.session.loginPhone;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: "No active OTP session",
        });
      }

      const isRegistration = !!req.session.verificationPhone;
      let otpDoc = null;

      if (isRegistration) {
        otpDoc = await OTP.findOne({phone});
      }

      const currentTime = Date.now();
      const otpExpiryTime = 5 * 60 * 1000; // 5 minutes

      let timeRemaining = 0;
      if (otpDoc) {
        const otpAge = currentTime - new Date(otpDoc.createdAt).getTime();
        timeRemaining = Math.max(0, otpExpiryTime - otpAge);
      }

      res.json({
        success: true,
        phone: phone.replace(/(\d{2})(\d{4})(\d{4})/, "$1****$3"),
        timeRemaining: Math.floor(timeRemaining / 1000),
        expired: timeRemaining <= 0,
        type: isRegistration ? "registration" : "login",
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to get OTP status",
      });
    }
  },

  // API METHODS

  // 🔥 UPDATED: API Login with approval checks
  handleLoginAPI: async (req, res) => {
    try {
      const phone = authController.extractValue(req.body.phone);

      if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          error: "Valid 10-digit phone number is required",
        });
      }

      const user = await User.findOne({phone});
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "📱 Phone number not registered",
        });
      }

      // 🔥 NEW: Check user status for API login
      if (user.status === "pending_approval") {
        return res.status(403).json({
          success: false,
          error:
            "⏳ Your account is pending admin approval. Please wait for verification.",
          status: "pending_approval",
        });
      }

      if (user.status === "rejected") {
        const reason =
          user.approvalStatus?.rejectionReason ||
          "Please contact support for details.";
        return res.status(403).json({
          success: false,
          error: `❌ Your account has been rejected. Reason: ${reason}`,
          status: "rejected",
        });
      }

      if (user.status === "suspended") {
        return res.status(403).json({
          success: false,
          error: "🚫 Your account has been suspended. Please contact support.",
          status: "suspended",
        });
      }

      if (user.status !== "active") {
        return res.status(403).json({
          success: false,
          error: "Account is not active. Please contact support.",
          status: user.status,
        });
      }

      // ... rest of existing API login code ...
      const smsResult = await sendSmsOTP(phone);

      if (!smsResult.success) {
        if (smsResult.rateLimit) {
          return res.status(429).json({
            success: false,
            error: "Please wait before requesting another OTP",
            rateLimit: true,
          });
        }

        if (process.env.NODE_ENV !== "development") {
          return res.status(500).json({
            success: false,
            error: "Unable to send OTP. Please try again.",
          });
        }
      }

      req.session.loginPhone = phone;
      req.session.loginOTP = smsResult.dev_mode ? smsResult.otp : null;
      req.session.loginSessionId = smsResult.sessionId;
      req.session.loginUserId = user._id;

      return res.json({
        success: true,
        message: "📱 OTP sent to your phone number",
        phone: phone,
        sessionId: smsResult.sessionId,
        devMode: smsResult.dev_mode,
        ...(smsResult.dev_mode && {otp: smsResult.otp}),
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Login failed. Please try again.",
      });
    }
  },

  // 🔥 FIXED: API version of handleVerifyLoginOTP with status checks
  handleVerifyLoginOTPAPI: async (req, res) => {
    try {
      const {phoneOTP} = req.body;
      const phone = req.session.loginPhone;
      const storedOTP = req.session.loginOTP;
      const sessionId = req.session.loginSessionId;
      const userId = req.session.loginUserId;

      if (!phone || !userId) {
        return res.status(400).json({
          success: false,
          error: "Session expired. Please try logging in again.",
        });
      }

      let otpValid = false;

      if (
        process.env.TWOFACTOR_API_KEY &&
        sessionId &&
        !sessionId.includes("dev_login")
      ) {
        const verifyResult = await verifyOTPWithProvider(sessionId, phoneOTP);
        otpValid = verifyResult.success;

        if (!verifyResult.success) {
          return res.status(400).json({
            success: false,
            error: `❌ Invalid OTP: ${verifyResult.error}`,
          });
        }
      } else {
        otpValid = phoneOTP === storedOTP;

        if (!otpValid) {
          return res.status(400).json({
            success: false,
            error: "❌ Invalid OTP. Please try again.",
          });
        }
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found.",
        });
      }

      // 🔥 FIX: Check user status again during API login verification
      if (user.status === "pending_approval") {
        return res.status(403).json({
          success: false,
          error: "⏳ Your account is still pending admin approval.",
          status: "pending_approval",
        });
      }

      if (user.status === "rejected") {
        const reason =
          user.approvalStatus?.rejectionReason || "Please contact support.";
        return res.status(403).json({
          success: false,
          error: `❌ Your account has been rejected. Reason: ${reason}`,
          status: "rejected",
        });
      }

      if (user.status !== "active") {
        return res.status(403).json({
          success: false,
          error: "Account is not active. Please contact support.",
          status: user.status,
        });
      }

      await User.findByIdAndUpdate(user._id, {lastLogin: new Date()});

      delete req.session.loginPhone;
      delete req.session.loginOTP;
      delete req.session.loginSessionId;
      delete req.session.loginUserId;

      req.session.userId = user._id;

      // 🔥 FIX: Smart redirection based on role and permissions
      let redirectUrl = "/";
      if (user.role === "provider") {
        // Check if provider has dashboard access
        const serviceProvider = await ServiceProvider.findOne({user: user._id});
        if (serviceProvider && serviceProvider.dashboardAccess) {
          redirectUrl = "/provider/dashboard";
        } else {
          redirectUrl = "/provider/pending-approval";
        }
      } else if (user.role === "admin") {
        redirectUrl = "/admin/dashboard";
      } else if (user.role === "customer") {
        redirectUrl = "/customer/dashboard";
      }

      return res.json({
        success: true,
        message: `🎉 Welcome back ${user.name}! You are logged in`,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          status: user.status, // 🔥 ADD STATUS
        },
        redirectUrl: redirectUrl,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Login failed. Please try again.",
      });
    }
  },

  handleRegisterAPI: async (req, res) => {
    try {
      const name = authController.extractValue(req.body.name);
      const phone = authController.extractValue(req.body.phone);
      const role = authController.extractValue(req.body.role);

      // Basic validation
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

      const existingPhone = await User.findOne({phone});
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          error: "Phone number already exists",
        });
      }

      // Role-based validation
      if (role === "customer") {
        if (!name || !phone) {
          return res.status(400).json({
            success: false,
            error: "Name and phone number are required for customers",
          });
        }
      } else if (role === "provider") {
        const email = authController.extractValue(req.body.email);
        const street = authController.extractValue(req.body.street);
        const city = authController.extractValue(req.body.city);
        const state = authController.extractValue(req.body.state);
        const pincode = authController.extractValue(req.body.pincode);
        const aadharCard = authController.extractValue(req.body.aadharCard);
        const panCard = authController.extractValue(req.body.panCard);

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
          const existingEmail = await User.findOne({email: email.trim()});
          if (existingEmail) {
            return res.status(400).json({
              success: false,
              error: "Email already exists",
            });
          }
        }

        const existingAadhar = await ServiceProvider.findOne({aadharCard});
        if (existingAadhar) {
          return res.status(400).json({
            success: false,
            error: "Aadhar card number already registered",
          });
        }

        const existingPan = await ServiceProvider.findOne({panCard});
        if (existingPan) {
          return res.status(400).json({
            success: false,
            error: "PAN card number already registered",
          });
        }
      }

      let userData = {
        name,
        phone,
        role,
        status: "unverified",
      };

      if (role === "customer") {
        userData.username = phone;
        userData.addresses = [];
      } else if (role === "provider") {
        const email = authController.extractValue(req.body.email);
        const street = authController.extractValue(req.body.street);
        const city = authController.extractValue(req.body.city);
        const state = authController.extractValue(req.body.state);
        const pincode = authController.extractValue(req.body.pincode);
        const aadharCard = authController.extractValue(req.body.aadharCard);
        const panCard = authController.extractValue(req.body.panCard);

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

      await OTP.deleteMany({phone});

      const smsResult = await sendSmsOTP(phone);

      if (!smsResult.success && process.env.NODE_ENV !== "development") {
        return res.status(500).json({
          success: false,
          error: `Failed to send SMS OTP: ${smsResult.error}`,
        });
      }

      const otpDoc = new OTP({
        phone,
        phoneOTP: smsResult.dev_mode ? smsResult.otp : "AUTOGEN",
        userData,
        sessionId: smsResult.sessionId,
      });

      await otpDoc.save();

      req.session.verificationPhone = phone;
      req.session.userRole = role;
      req.session.otpSessionId = smsResult.sessionId;

      return res.json({
        success: true,
        message: "OTP sent successfully",
        phone: phone,
        sessionId: smsResult.sessionId,
        devMode: smsResult.dev_mode,
        ...(smsResult.dev_mode && {otp: smsResult.otp}),
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message || "Registration failed",
      });
    }
  },

  // 🔥 FIXED: API version of handleVerifyOTP with admin approval workflow
  handleVerifyOTPAPI: async (req, res) => {
    try {
      const {phoneOTP} = req.body;
      const phone = req.session.verificationPhone;
      const sessionId = req.session.otpSessionId;

      if (!phone) {
        return res.status(400).json({
          success: false,
          error: "Verification session expired. Please register again.",
        });
      }

      const otpDoc = await OTP.findOne({phone});
      if (!otpDoc) {
        return res.status(400).json({
          success: false,
          error: "Verification code expired. Please register again.",
        });
      }

      let otpValid = false;

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

      const userData = otpDoc.userData;

      const newUser = new User({
        name: userData.name,
        username: userData.username,
        phone: userData.phone,
        role: userData.role,
        addresses: userData.addresses || [],
        isPhoneVerified: true,
      });

      if (userData.role === "provider" && userData.email) {
        newUser.email = userData.email;
      }

      const tempPassword = crypto.randomBytes(16).toString("hex");
      const registeredUser = await User.register(newUser, tempPassword);

      // 🔥 FIX: Different status based on role (same as web version)
      let userStatus = "active";
      if (userData.role === "provider") {
        userStatus = "pending_approval"; // Providers need admin approval
      }

      await User.findByIdAndUpdate(registeredUser._id, {
        status: userStatus,
        isPhoneVerified: true,
      });

      if (userData.role === "provider") {
        if (
          !userData.providerData ||
          !userData.providerData.aadharCard ||
          !userData.providerData.panCard
        ) {
          return res.status(400).json({
            success: false,
            error: "Required provider data missing. Please register again.",
          });
        }

        const newProvider = new ServiceProvider({
          user: registeredUser._id,
          servicesOffered: [],
          portfolio: [],
          aadharCard: userData.providerData.aadharCard,
          panCard: userData.providerData.panCard,
          aadharImage: userData.providerData.aadharImage || null,
          panImage: userData.providerData.panImage || null,
          // 🔥 FIX: Set to pending with no access (same as web version)
          verificationStatus: "pending",
          canRegisterServices: false,
          dashboardAccess: false,
          canReceiveBookings: false,
          canAccessPayouts: false,
          businessAddress: userData.addresses[0],
          documentVerification: {
            aadharVerified: false,
            panVerified: false,
            imagesVerified: false,
            allDocumentsVerified: false,
          },
          // Legacy fields for backward compatibility
          isVerified: false,
        });

        await newProvider.save();

        // 🔥 FIX: Notify admin about new provider registration
        await notifyAdminNewProvider(registeredUser._id);
      }

      await OTP.deleteOne({phone});
      delete req.session.verificationPhone;
      delete req.session.userRole;
      delete req.session.otpSessionId;

      // 🔥 FIX: Different success messages (same as web version)
      const successMessage =
        userData.role === "customer"
          ? "🎉 Account created successfully! You can now log in."
          : "🎉 Provider account created successfully! Your account is pending admin approval. You will be notified once verified.";

      return res.json({
        success: true,
        message: successMessage,
        user: {
          id: registeredUser._id,
          name: registeredUser.name,
          phone: registeredUser.phone,
          role: registeredUser.role,
          isPhoneVerified: true,
          status: userStatus, // 🔥 ADD STATUS
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

module.exports = authController;
