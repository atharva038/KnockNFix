const OTP = require("../../models/OTP");

const sessionController = {
  handleLogout: async (req, res, next) => {
    try {
      req.logout((err) => {
        if (err) {
          return next(err);
        }

        req.session.destroy((sessionError) => {
          if (sessionError) {
            // Silent error handling
          }
          res.redirect("/login?logout=success");
        });
      });
    } catch (err) {
      return next(err);
    }
  },

  checkOTPSession: (req, res) => {
    const phone = req.session.verificationPhone || req.session.loginPhone;
    const sessionId = req.session.otpSessionId || req.session.loginSessionId;

    if (!phone || !sessionId) {
      return res.json({
        success: false,
        message: "No active OTP session",
      });
    }

    return res.json({
      success: true,
      phone: phone.replace(/(\d{2})(\d{4})(\d{4})/, "$1****$3"),
      sessionActive: true,
    });
  },

  clearOTPSession: (req, res) => {
    try {
      delete req.session.verificationPhone;
      delete req.session.userRole;
      delete req.session.otpSessionId;
      delete req.session.loginPhone;
      delete req.session.loginOTP;
      delete req.session.loginSessionId;
      delete req.session.loginUserId;

      return res.json({
        success: true,
        message: "OTP session cleared successfully",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to clear OTP session",
      });
    }
  },

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
        otpDoc = await OTP.findOne({ phone });
      }

      const currentTime = Date.now();
      const otpExpiryTime = 5 * 60 * 1000;

      let timeRemaining = 0;
      if (otpDoc) {
        const otpAge = currentTime - new Date(otpDoc.createdAt).getTime();
        timeRemaining = Math.max(0, otpExpiryTime - otpAge);
      }

      return res.json({
        success: true,
        phone: phone.replace(/(\d{2})(\d{4})(\d{4})/, "$1****$3"),
        timeRemaining: Math.floor(timeRemaining / 1000),
        expired: timeRemaining <= 0,
        type: isRegistration ? "registration" : "login",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to get OTP status",
      });
    }
  },
};

module.exports = sessionController;
