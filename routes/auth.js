const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const OTP = require("../models/OTP"); // Import OTP model
const router = express.Router();
const { body, validationResult } = require("express-validator");
const passportLocalMongoose = require("passport-local-mongoose");
const passport = require("passport");
const ServiceProvider = require("../models/ServiceProvider");
const { upload } = require('../config/cloudinary');
const cloudinary = require('cloudinary').v2;
const { generateOTP, sendEmailOTP, sendSmsOTP } = require('../utils/otp');
const crypto = require('crypto'); // Add this line to import the crypto module
const { sendResetEmail } = require("./utils/email"); // Make sure this is also imported

// Debug routes for testing (remove in production)
router.get('/debug-twilio', (req, res) => {
  const config = {
    environment: process.env.NODE_ENV,
    twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    accountSid: process.env.TWILIO_ACCOUNT_SID ? process.env.TWILIO_ACCOUNT_SID.substring(0, 8) + '...' : 'Not set',
    hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || 'Not set',
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
  };

  res.json(config);
});

// Test SMS route (remove in production)
router.get('/test-sms/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;
    const testOTP = generateOTP();

    console.log(`🧪 Testing SMS to: ${phone}`);
    const result = await sendSmsOTP(phone, testOTP);

    res.json({
      success: result.success,
      message: result.success ? 'SMS sent successfully!' : 'SMS failed',
      error: result.error || null,
      phone: phone,
      otp: process.env.NODE_ENV === 'development' ? testOTP : 'Hidden in production'
    });
  } catch (error) {
    res.json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

// Render registration form
router.get("/register", (req, res) => {
  res.render("pages/register");
});

router.post(
  "/register",
  upload.single('image'), // Handle file upload
  [
    body("name")
      .trim()
      .notEmpty().withMessage("Name is required.")
      .isLength({ min: 2 }).withMessage("Name must be at least 2 characters long"),

    body("phone")
      .trim()
      .notEmpty().withMessage("Phone number is required.")
      .matches(/^[0-9]{10}$/).withMessage("Please enter a valid 10-digit phone number"),

    body("role")
      .trim()
      .notEmpty().withMessage("Role is required.")
      .isIn(["customer", "provider"]).withMessage("Role must be either customer or provider."),

    // Conditional validation for provider fields
    body("username")
      .if(body("role").equals("provider"))
      .trim()
      .notEmpty().withMessage("Email is required for providers.")
      .isEmail().withMessage("Please provide a valid email address.")
      .normalizeEmail(),

    body("password")
      .if(body("role").equals("provider"))
      .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),

    body("addresses")
      .if(body("role").equals("provider"))
      .trim()
      .notEmpty().withMessage("Address is required for providers.")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Clean up uploaded file if validation fails
        if (req.file) {
          await cloudinary.uploader.destroy(req.file.filename);
        }
        const errorMessages = errors.array().map((err) => err.msg);
        req.flash("error", errorMessages.join(", "));
        return res.redirect("/register");
      }

      const { name, username, password, addresses, phone, role } = req.body;

      // Check if phone already exists for both customers and providers
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        if (req.file) {
          await cloudinary.uploader.destroy(req.file.filename);
        }
        req.flash("error", "Phone number already exists");
        return res.redirect("/register");
      }

      // For providers, also check email uniqueness
      if (role === "provider") {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          if (req.file) {
            await cloudinary.uploader.destroy(req.file.filename);
          }
          req.flash("error", "Email already exists");
          return res.redirect("/register");
        }
      }

      // Generate OTPs for both customers and providers
      const phoneOTP = generateOTP();
      let emailOTP = null;
      let email = null;

      // For providers, generate email OTP
      if (role === "provider") {
        emailOTP = generateOTP();
        email = username;
        console.log(`Email OTP for ${username}: ${emailOTP}`); // For testing/debugging
      } else {
        // For customers, use phone as email field in OTP document
        email = phone + "@customer.temp"; // Temporary email for customers
      }

      console.log(`Phone OTP for ${phone}: ${phoneOTP}`); // For testing/debugging

      // Prepare user data for both roles
      const userData = {
        name: name.trim(),
        username: role === "provider" ? username.trim() : phone.trim(), // Use phone as username for customers
        password: role === "provider" ? password : crypto.randomBytes(8).toString('hex'), // Generate temp password for customers
        addresses: role === "provider" ? [addresses.trim()] : [], // Empty addresses for customers
        phone: phone.trim(),
        role: role.trim(),
        profileImage: req.file ? req.file.path : undefined
      };

      // Delete any existing OTP documents for this email or phone
      await OTP.deleteMany({
        $or: [{ email }, { phone }]
      });

      // Store OTPs
      const otpDoc = new OTP({
        email,
        phone,
        emailOTP: emailOTP || null, // null for customers
        phoneOTP,
        userData
      });

      await otpDoc.save();

      // Send Email OTP for providers
      if (role === "provider") {
        try {
          const emailResult = await sendEmailOTP(username, emailOTP);
          if (!emailResult.success) {
            console.warn(`Email OTP sending failed: ${emailResult.error}`);
            // In production, you might want to throw an error here
            if (process.env.NODE_ENV === 'production') {
              throw new Error(`Failed to send email OTP: ${emailResult.error}`);
            }
          } else {
            console.log('✅ Email OTP sent successfully');
          }
        } catch (error) {
          console.error('Email OTP error:', error.message);
          if (process.env.NODE_ENV === 'production') {
            throw new Error(`Failed to send email OTP: ${error.message}`);
          }
        }
      }

      // Send SMS OTP for both customers and providers
      let smsSuccess = false;

      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        try {
          const smsResult = await sendSmsOTP(phone, phoneOTP);
          smsSuccess = smsResult.success;

          if (smsResult.success) {
            console.log('✅ SMS OTP sent successfully');
          } else {
            console.warn(`❌ SMS OTP sending failed: ${smsResult.error}`);
          }
        } catch (error) {
          console.error('❌ SMS sending error:', error.message);
        }
      } else {
        console.warn('⚠️ Twilio credentials not configured');
      }

      // Handle SMS failure based on environment and role
      if (!smsSuccess) {
        if (process.env.NODE_ENV === 'development') {
          // In development mode, allow registration to continue even if SMS fails
          console.log(`🚧 [DEV MODE] SMS failed, but continuing registration`);
          console.log(`📱 Phone OTP for testing: ${phoneOTP}`);
          console.log(`💡 Use this OTP to complete verification`);
          // Don't throw error, allow registration to continue
        } else {
          // In production, SMS is required for customers
          if (role === "customer") {
            throw new Error("Unable to send SMS OTP. Please check your phone number and try again.");
          }
          // For providers in production, continue without SMS if they have email
        }
      }

      // Store reference in session for verification page
      req.session.verificationEmail = email;
      req.session.userRole = role; // Store role for verification page

      // Redirect to verification page
      res.redirect("/verify-otp");

    } catch (err) {
      console.error("Error during registration process:", err);
      if (req.file) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      req.flash("error", err.message || "Registration failed. Please try again.");
      res.redirect("/register");
    }
  }
);

// Modify login to handle phone number login for customers
router.post("/login", (req, res, next) => {
  // Check if the username looks like a phone number (10 digits)
  const isPhoneLogin = /^[0-9]{10}$/.test(req.body.username);

  if (isPhoneLogin) {
    // For phone number login, find user by phone
    User.findOne({ phone: req.body.username })
      .then(async (user) => {
        if (!user) {
          req.flash("error", "Phone number not registered");
          return res.redirect("/login");
        }

        // For customers with phone login, implement OTP-based login
        if (user.role === 'customer') {
          // Generate OTP for customer login
          const phoneOTP = generateOTP();
          console.log(`Login OTP for ${user.phone}: ${phoneOTP}`);

          // Store OTP temporarily
          req.session.loginPhone = user.phone;
          req.session.loginOTP = phoneOTP;

          // Send SMS OTP
          let otpSent = false;

          if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            try {
              const smsResult = await sendSmsOTP(user.phone, phoneOTP);
              if (smsResult.success) {
                otpSent = true;
                req.flash("success", "OTP sent to your phone number");
                return res.redirect("/verify-login-otp");
              } else {
                console.warn(`Login SMS OTP failed: ${smsResult.error}`);
              }
            } catch (error) {
              console.error('Login SMS error:', error.message);
            }
          }

          // Handle SMS failure for login
          if (!otpSent) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`🚧 [DEV LOGIN] Phone OTP for ${user.phone}: ${phoneOTP}`);
              req.flash("success", "OTP generated (check console for development)");
              return res.redirect("/verify-login-otp");
            } else {
              req.flash("error", "Unable to send OTP. Please try again or contact support.");
              return res.redirect("/login");
            }
          }
        }

        // For providers, continue with normal authentication
        req.body.username = user.username;
        next();
      })
      .catch((err) => {
        return next(err);
      });
  } else {
    // Normal email login
    next();
  }
}, passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: true
}), async (req, res) => {
  try {
    // Set user ID in session
    req.session.userId = req.user._id;

    // Handle remember me functionality
    if (req.body.rememberMe) {
      const rememberToken = crypto.randomBytes(32).toString('hex');

      req.user.rememberToken = rememberToken;
      req.user.rememberTokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await req.user.save();

      const encodedUsername = encodeURIComponent(req.body.username);

      res.cookie('username', encodedUsername, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      res.cookie('rememberToken', rememberToken, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      res.cookie('rememberMe', 'true', {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    } else {
      res.clearCookie('username');
      res.clearCookie('rememberToken');
      res.clearCookie('rememberMe');
    }

    req.flash("success", "Welcome back to KnockNFix! You are logged in");
    let redirectUrl = res.locals.redirectUrl || "/";
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("Error during login:", err);
    return next(err);
  }
});

// Add route for customer OTP login verification
router.get("/verify-login-otp", (req, res) => {
  const phone = req.session.loginPhone;
  if (!phone) {
    req.flash("error", "Please try logging in again");
    return res.redirect("/login");
  }
  res.render("pages/verify-login-otp", { phone });
});

router.post("/verify-login-otp", async (req, res) => {
  try {
    const { otp } = req.body;
    const phone = req.session.loginPhone;
    const storedOTP = req.session.loginOTP;

    if (!phone || !storedOTP) {
      req.flash("error", "Session expired. Please try logging in again.");
      return res.redirect("/login");
    }

    if (otp !== storedOTP) {
      req.flash("error", "Invalid OTP. Please try again.");
      return res.redirect("/verify-login-otp");
    }

    // Find user and log them in
    const user = await User.findOne({ phone });
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/login");
    }

    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }

      // Clear session data
      delete req.session.loginPhone;
      delete req.session.loginOTP;
      req.session.userId = user._id;

      req.flash("success", "Welcome back! You are logged in");
      let redirectUrl = res.locals.redirectUrl || "/";
      return res.redirect(redirectUrl);
    });

  } catch (err) {
    console.error("Error during OTP verification:", err);
    req.flash("error", "Login failed. Please try again.");
    res.redirect("/login");
  }
});

// OTP Verification page
router.get("/verify-otp", (req, res) => {
  const email = req.session.verificationEmail;
  const userRole = req.session.userRole;

  if (!email) {
    req.flash("error", "Please register first");
    return res.redirect("/register");
  }

  res.render("pages/verify-otp", { email, userRole });
});

// Handle OTP verification
router.post("/verify-otp", async (req, res) => {
  try {
    const { emailOTP, phoneOTP } = req.body;
    const email = req.session.verificationEmail;
    const userRole = req.session.userRole;

    if (!email) {
      req.flash("error", "Verification session expired. Please register again.");
      return res.redirect("/register");
    }

    // Find the OTP document
    const otpDoc = await OTP.findOne({ email });

    if (!otpDoc) {
      req.flash("error", "Verification code expired. Please register again.");
      return res.redirect("/register");
    }

    // Validate OTPs based on user role
    if (userRole === "provider") {
      // For providers, validate both email and phone OTP
      const isEmailOTPValid = emailOTP === otpDoc.emailOTP;
      const isPhoneOTPValid = phoneOTP === otpDoc.phoneOTP;

      if (!isEmailOTPValid || !isPhoneOTPValid) {
        if (!isEmailOTPValid && !isPhoneOTPValid) {
          req.flash("error", "Both verification codes are invalid.");
        } else if (!isEmailOTPValid) {
          req.flash("error", "Email verification code is invalid.");
        } else {
          req.flash("error", "Phone verification code is invalid.");
        }
        return res.redirect("/verify-otp");
      }
    } else {
      // For customers, only validate phone OTP
      const isPhoneOTPValid = phoneOTP === otpDoc.phoneOTP;

      if (!isPhoneOTPValid) {
        req.flash("error", "Phone verification code is invalid.");
        return res.redirect("/verify-otp");
      }
    }

    // OTPs valid, proceed with user creation
    const userData = otpDoc.userData;

    // Create the new user
    const newUser = new User({
      name: userData.name,
      username: userData.username,
      addresses: userData.addresses,
      phone: userData.phone,
      role: userData.role,
      profileImage: userData.profileImage
    });

    // Register the user using passport-local-mongoose
    const registeredUser = await User.register(newUser, userData.password);

    // Create service provider if role is provider
    if (userData.role === "provider") {
      const newProvider = new ServiceProvider({
        user: registeredUser._id,
        servicesOffered: [],
        portfolio: []
      });
      await newProvider.save();
    }

    // Clean up the OTP document
    await OTP.deleteOne({ email });

    // Clear verification session
    delete req.session.verificationEmail;
    delete req.session.userRole;

    req.flash("success", "Account verified and created successfully! You can now log in.");
    res.redirect("/login");

  } catch (err) {
    console.error("Error during verification:", err);
    req.flash("error", err.message || "Verification failed. Please try again.");
    res.redirect("/verify-otp");
  }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const email = req.session.verificationEmail;
    const userRole = req.session.userRole;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Session expired, please register again"
      });
    }

    const otpDoc = await OTP.findOne({ email });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "Verification data expired, please register again"
      });
    }

    // Generate new OTPs
    const newPhoneOTP = generateOTP();
    let newEmailOTP = null;

    // Only generate email OTP for providers
    if (userRole === "provider" && !email.includes('@customer.temp')) {
      newEmailOTP = generateOTP();
      console.log(`New Email OTP for ${email}: ${newEmailOTP}`); // For testing
    }

    console.log(`New Phone OTP for ${otpDoc.phone}: ${newPhoneOTP}`); // For testing

    // Update OTPs
    otpDoc.emailOTP = newEmailOTP; // null for customers, OTP for providers
    otpDoc.phoneOTP = newPhoneOTP;
    otpDoc.createdAt = Date.now(); // Reset expiration timer
    await otpDoc.save();

    let emailSent = false;
    let smsSent = false;

    // Send email OTP for providers
    if (userRole === "provider" && !email.includes('@customer.temp') && newEmailOTP) {
      try {
        const emailResult = await sendEmailOTP(email, newEmailOTP);
        emailSent = emailResult.success;

        if (!emailResult.success) {
          console.warn(`Email OTP resend failed: ${emailResult.error}`);
        }
      } catch (error) {
        console.error('Email resend error:', error.message);
      }
    }

    // Send SMS OTP for both customers and providers
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const smsResult = await sendSmsOTP(otpDoc.phone, newPhoneOTP);
        smsSent = smsResult.success;

        if (!smsResult.success) {
          console.warn(`SMS OTP resend failed: ${smsResult.error}`);
        }
      } catch (error) {
        console.error('SMS resend error:', error.message);
      }
    }

    // In development, always report success for SMS
    if (!smsSent && process.env.NODE_ENV === 'development') {
      console.log(`🚧 [DEV MODE] SMS resend failed, but reporting success`);
      console.log(`📱 New Phone OTP for testing: ${newPhoneOTP}`);
      smsSent = true;
    }

    res.json({
      success: true,
      emailSent: emailSent,
      smsSent: smsSent,
      message: smsSent || emailSent ? "Verification codes sent successfully" : "Unable to send verification codes"
    });

  } catch (err) {
    console.error("Error resending OTP:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to resend verification codes"
    });
  }
});

// Login routes
router.get("/login", (req, res) => {
  res.render("pages/login.ejs");
});

// Logout route
router.get("/logout", async (req, res, next) => {
  try {
    // If user has a remember token, clear it from the database
    if (req.user && req.user._id) {
      await User.findByIdAndUpdate(req.user._id, {
        $unset: { rememberToken: "", rememberTokenExpires: "" }
      });
    }

    // Logout the user
    req.logout((err) => {
      if (err) {
        return next(err);
      }

      // Clear all authentication cookies
      res.clearCookie('username');
      res.clearCookie('rememberToken');
      res.clearCookie('rememberMe');

      req.flash("success", "User logged out successfully");
      res.redirect("/login");
    });
  } catch (err) {
    console.error("Error during logout:", err);
    return next(err);
  }
});

// Forgot Password routes
router.get("/forgot-password", (req, res) => {
  res.render("pages/forgot-password");
});

// Forgot Password route - handle submission
router.post("/forgot-password", [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please enter a valid email address")
    .normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((err) => err.msg);
      req.flash("error", errorMessages.join(", "));
      return res.redirect("/forgot-password");
    }

    const { email } = req.body;

    // Check if user exists with this email
    const user = await User.findOne({ username: email });

    if (!user) {
      // Don't reveal that the user doesn't exist for security
      req.flash("success", "If your email is registered, you will receive password reset instructions shortly");
      return res.redirect("/forgot-password");
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

    // Save token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Generate reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

    // Send email with reset link
    await sendResetEmail(user.username, user.name, resetUrl);

    req.flash("success", "Password reset instructions have been sent to your email");
    res.redirect("/forgot-password");
  } catch (err) {
    console.error("Error in forgot password process:", err);
    req.flash("error", "An error occurred. Please try again later");
    res.redirect("/forgot-password");
  }
});

router.get("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with this token and check if it's not expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      // Token is invalid or expired
      return res.render("pages/reset-password", {
        token,
        tokenExpired: true
      });
    }

    // Token is valid
    res.render("pages/reset-password", {
      token,
      tokenExpired: false
    });
  } catch (err) {
    console.error("Error checking reset token:", err);
    req.flash("error", "An error occurred. Please try again later");
    res.redirect("/forgot-password");
  }
});

router.post("/reset-password/:token", [
  body("password")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
  body("confirmPassword")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((err) => err.msg);
      req.flash("error", errorMessages.join(", "));
      return res.redirect(`/reset-password/${req.params.token}`);
    }

    const { token } = req.params;
    const { password } = req.body;

    // Find user with this token and check if it's not expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired");
      return res.redirect("/forgot-password");
    }

    // Update password and clear reset token
    await user.setPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.flash("success", "Your password has been updated. You can now log in with your new password");
    res.redirect("/login");
  } catch (err) {
    console.error("Error resetting password:", err);
    req.flash("error", "An error occurred while resetting your password");
    res.redirect(`/reset-password/${req.params.token}`);
  }
});

module.exports = router;