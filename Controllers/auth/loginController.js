const User = require("../../models/User");
const OTP = require("../../models/OTP");
const ServiceProvider = require("../../models/ServiceProvider");
const { sendSmsOTP, verifyOTPWithProvider, resendOTP } = require("../../utils/otp");

const { isDevelopment, extractValue, wantsJson } = require("./helpers");
const {
  buildLoginUserData,
  getWebLoginStatusIssue,
  getWebVerifyStatusIssue,
  getApiLoginStatusIssue,
  getApiVerifyStatusIssue,
  normalizeSixDigitOtp,
  resolvePostLoginRedirect,
} = require("./loginFlowHelpers");
const { clearLoginSession, clearAllOtpSession } = require("./sessionHelpers");

const loginController = {
  showLogin: (req, res) => {
    if (req.query.logout === "success") {
      req.flash("success", "👋 User logged out successfully");
    }

    res.render("pages/login", {
      title: "Login - KnockNFix",
    });
  },

  handleLogin: async (req, res, next) => {
    try {
      const { phone } = req.body;

      const user = await User.findOne({ phone });
      if (!user) {
        req.flash("error", "📱 Phone number not registered");
        return res.redirect("/login");
      }

      const statusIssue = getWebLoginStatusIssue(user);
      if (statusIssue) {
        req.flash("error", statusIssue.message);
        return res.redirect("/login");
      }

      if (isDevelopment()) {
        req.login(user, async (err) => {
          if (err) {
            req.flash("error", "Login failed. Please try again.");
            return res.redirect("/login");
          }

          await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
          req.session.userId = user._id;

          clearAllOtpSession(req);

          req.flash(
            "success",
            `🎉 Welcome back, ${user.name}! (Dev Mode - OTP Skipped)`
          );

          return res.redirect("/");
        });
        return;
      }

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

      const loginUserData = buildLoginUserData(user, "login");

      await OTP.deleteMany({ phone });
      const otpDoc = new OTP({
        phone,
        phoneOTP: smsResult.dev_mode ? smsResult.otp : "AUTOGEN",
        userData: loginUserData,
        sessionId: smsResult.sessionId,
      });

      await otpDoc.save();

      req.flash("success", "📱 OTP sent to your phone number");
      return res.redirect("/verify-login-otp");
    } catch (err) {
      req.flash("error", "Login failed. Please try again.");
      return res.redirect("/login");
    }
  },

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

      return res.render("pages/verify-otp", {
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
      return res.redirect("/login");
    }
  },

  handleVerifyLoginOTP: async (req, res, next) => {
    try {
      const { phoneOTP } = req.body;
      const phone = req.session.verificationPhone;
      const sessionId = req.session.loginSessionId;

      if (!phone) {
        req.flash(
          "error",
          "Login session expired. Please try logging in again."
        );
        return res.redirect("/login");
      }

      const otpCheck = normalizeSixDigitOtp(phoneOTP);
      if (!otpCheck.ok) {
        req.flash("error", otpCheck.error);
        return res.redirect("/verify-login-otp");
      }

      const cleanOTP = otpCheck.value;

      const otpDoc = await OTP.findOne({ phone });

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

      if (isDevelopment()) {
        otpValid = true;
      } else {
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
      }

      const userId = otpDoc.userData._id;
      const user = await User.findById(userId);

      if (!user) {
        req.flash("error", "User not found. Please register first.");
        return res.redirect("/register");
      }

      const verifyStatusIssue = getWebVerifyStatusIssue(user);
      if (verifyStatusIssue) {
        req.flash("error", verifyStatusIssue.message);
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

        await OTP.deleteOne({ phone });
        clearAllOtpSession(req);

        const devSuffix = isDevelopment() ? " (Dev Mode)" : "";
        req.flash("success", `Welcome back, ${user.name}!${devSuffix}`);

        let serviceProvider = null;
        if (user.role === "provider") {
          serviceProvider = await ServiceProvider.findOne({
            user: user._id,
          });
        }

        return res.redirect(resolvePostLoginRedirect(user, serviceProvider));
      });
    } catch (err) {
      req.flash("error", "Login verification failed. Please try again.");
      return res.redirect("/login");
    }
  },

  resendLoginOTP: async (req, res) => {
    try {
      const phone = req.session.verificationPhone;
      const userId = req.session.loginUserId;

      if (!phone || !userId) {
        const errorMessage = "Session expired, please try logging in again";

        if (wantsJson(req)) {
          return res.status(400).json({
            success: false,
            message: errorMessage,
          });
        }

        req.flash("error", errorMessage);
        return res.redirect("/login");
      }

      const user = await User.findById(userId);
      if (!user) {
        const errorMessage = "User not found, please try logging in again";

        if (wantsJson(req)) {
          return res.status(400).json({
            success: false,
            message: errorMessage,
          });
        }

        req.flash("error", errorMessage);
        return res.redirect("/login");
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
          return res.redirect("/verify-login-otp");
        }

        const errorMessage = resendResult.error || "Failed to resend login OTP";

        if (wantsJson(req)) {
          return res.status(500).json({
            success: false,
            message: errorMessage,
          });
        }

        req.flash("error", errorMessage);
        return res.redirect("/verify-login-otp");
      }

      const loginUserData = buildLoginUserData(user, "login_resend");

      let otpDoc = await OTP.findOne({ phone });
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

      if (wantsJson(req)) {
        return res.json({
          success: true,
          message: successMessage,
          resent: true,
          fallback: resendResult.fallback || false,
        });
      }

      req.flash("success", successMessage);
      return res.redirect("/verify-login-otp");
    } catch (err) {
      const errorMessage = err.message || "Failed to resend login OTP";

      if (wantsJson(req)) {
        return res.status(500).json({
          success: false,
          message: errorMessage,
        });
      }

      req.flash("error", errorMessage);
      return res.redirect("/verify-login-otp");
    }
  },

  handleLoginAPI: async (req, res) => {
    try {
      const phone = extractValue(req.body.phone);

      if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          error: "Valid 10-digit phone number is required",
        });
      }

      const user = await User.findOne({ phone });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "📱 Phone number not registered",
        });
      }

      const apiStatusIssue = getApiLoginStatusIssue(user);
      if (apiStatusIssue) {
        return res.status(apiStatusIssue.statusCode).json(apiStatusIssue.body);
      }

      if (isDevelopment()) {
        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

        req.session.userId = user._id;

        clearLoginSession(req);

        let serviceProvider = null;
        if (user.role === "provider") {
          serviceProvider = await ServiceProvider.findOne({
            user: user._id,
          });
        }

        const redirectUrl = resolvePostLoginRedirect(user, serviceProvider, {
          customerPath: "/customer/dashboard",
        });

        return res.json({
          success: true,
          message: `🎉 Welcome back ${user.name}! (Dev Mode - OTP Skipped)`,
          user: {
            id: user._id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            status: user.status,
          },
          redirectUrl,
          devMode: true,
          otpSkipped: true,
        });
      }

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
        phone,
        sessionId: smsResult.sessionId,
        devMode: smsResult.dev_mode,
        ...(smsResult.dev_mode && { otp: smsResult.otp }),
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Login failed. Please try again.",
      });
    }
  },

  handleVerifyLoginOTPAPI: async (req, res) => {
    try {
      const { phoneOTP } = req.body;
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

      if (isDevelopment()) {
        otpValid = true;
      } else {
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
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found.",
        });
      }

      const apiVerifyStatusIssue = getApiVerifyStatusIssue(user);
      if (apiVerifyStatusIssue) {
        return res
          .status(apiVerifyStatusIssue.statusCode)
          .json(apiVerifyStatusIssue.body);
      }

      await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

      clearLoginSession(req);

      req.session.userId = user._id;

      let serviceProvider = null;
      if (user.role === "provider") {
        serviceProvider = await ServiceProvider.findOne({ user: user._id });
      }

      const redirectUrl = resolvePostLoginRedirect(user, serviceProvider, {
        customerPath: "/customer/dashboard",
      });

      const devSuffix = isDevelopment() ? " (Dev Mode)" : "";

      return res.json({
        success: true,
        message: `🎉 Welcome back ${user.name}! You are logged in${devSuffix}`,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          status: user.status,
        },
        redirectUrl,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Login failed. Please try again.",
      });
    }
  },
};

module.exports = loginController;
