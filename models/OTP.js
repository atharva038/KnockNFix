const mongoose = require("mongoose");

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    sparse: true, // Allow null/undefined but enforce uniqueness for non-null values
    default: null,
  },
  phone: {
    type: String,
    required: true, // Phone is always required for our SMS-based auth
    sparse: true,
  },
  emailOTP: {
    type: String,
    required: false, // Make emailOTP completely optional
    default: null,
  },
  phoneOTP: {
    type: String,
    required: true, // Phone OTP is always required
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  userData: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // Automatically expire document after 10 minutes (600 seconds)
  },
});

// Index for better query performance
OTPSchema.index({phone: 1});

// Pre-save middleware to ensure data consistency
OTPSchema.pre("save", function (next) {
  // If no email is provided, ensure emailOTP is null
  if (!this.email) {
    this.emailOTP = null;
  }

  // Ensure phone and phoneOTP are always present
  if (!this.phone || !this.phoneOTP) {
    return next(new Error("Phone and phoneOTP are required"));
  }

  next();
});

// Instance methods
OTPSchema.methods.verifyPhoneOTP = function (inputOTP) {
  return this.phoneOTP === inputOTP;
};

OTPSchema.methods.markPhoneVerified = function () {
  this.phoneVerified = true;
  return this.save();
};

// Static methods
OTPSchema.statics.findByPhone = function (phone) {
  return this.findOne({phone: phone});
};

OTPSchema.statics.createPhoneOTP = function (phone, phoneOTP, userData) {
  return this.create({
    phone: phone,
    phoneOTP: phoneOTP,
    userData: userData,
    email: null,
    emailOTP: null,
  });
};

const OTP = mongoose.model("OTP", OTPSchema);
module.exports = OTP;
