const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const passportLocalMongoose = require("passport-local-mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },

    email: {
      type: String,
      sparse: true, // Allows null values, but enforces uniqueness when present
      index: true,
      trim: true,
      lowercase: true,
      required: false, // Optional for providers
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      match: /^[6-9]\d{9}$/, // Indian mobile number format
      index: true,
    },

    profileImage: {
      type: String,
      default: null,
    },

    role: {
      type: String,
      enum: ["customer", "provider"],
      required: true,
      default: "customer",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "unverified"],
      default: "unverified",
    },

    // Address management
    addresses: [
      {
        street: {
          type: String,
          trim: true,
        },
        city: {
          type: String,
          trim: true,
        },
        state: {
          type: String,
          trim: true,
        },
        pincode: {
          type: String,
          match: /^[0-9]{6}$/,
        },
        coordinates: {
          latitude: {type: Number},
          longitude: {type: Number},
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
        label: {
          type: String,
          default: "Home",
          enum: ["Home", "Work", "Business Address", "Other"],
        },
      },
    ],

    // Store current location for proximity-based services
    currentLocation: {
      latitude: {type: Number},
      longitude: {type: Number},
      lastUpdated: {type: Date},
    },

    // Account creation date
    date: {
      type: Date,
      default: Date.now,
    },

    // Last login tracking
    lastLogin: {
      type: Date,
      default: null,
    },

    // Account verification status
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexes for better query performance
UserSchema.index({phone: 1});
UserSchema.index({email: 1});
UserSchema.index({role: 1});
UserSchema.index({status: 1});
UserSchema.index({"addresses.coordinates": "2dsphere"}); // For location-based queries

// Pre-save middleware
UserSchema.pre("save", function (next) {
  // Ensure only one default address
  if (this.addresses && this.addresses.length > 0) {
    const defaultAddresses = this.addresses.filter((addr) => addr.isDefault);
    if (defaultAddresses.length > 1) {
      // If multiple defaults, keep only the first one
      this.addresses.forEach((addr, index) => {
        if (index > 0) addr.isDefault = false;
      });
    }
  }

  // Update phone verification status
  if (this.isModified("phone")) {
    this.isPhoneVerified = false;
  }

  // Update email verification status
  if (this.isModified("email")) {
    this.isEmailVerified = false;
  }

  next();
});

// Instance methods
UserSchema.methods.addAddress = function (addressData) {
  // If this is the first address or marked as default, make it default
  if (this.addresses.length === 0 || addressData.isDefault) {
    this.addresses.forEach((addr) => (addr.isDefault = false));
    addressData.isDefault = true;
  }
  this.addresses.push(addressData);
  return this.save();
};

UserSchema.methods.getDefaultAddress = function () {
  return this.addresses.find((addr) => addr.isDefault) || this.addresses[0];
};

UserSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

UserSchema.methods.verifyPhone = function () {
  this.isPhoneVerified = true;
  this.status = "active";
  return this.save();
};

UserSchema.methods.verifyEmail = function () {
  this.isEmailVerified = true;
  return this.save();
};

// Static methods
UserSchema.statics.findByPhone = function (phone) {
  return this.findOne({phone: phone});
};

UserSchema.statics.findProviders = function () {
  return this.find({role: "provider", status: "active"});
};

UserSchema.statics.findCustomers = function () {
  return this.find({role: "customer", status: "active"});
};

// Virtual for full name (if needed for display)
UserSchema.virtual("displayName").get(function () {
  return this.name;
});

// Configure passport-local-mongoose for OTP-based auth
UserSchema.plugin(passportLocalMongoose, {
  usernameField: "username", // We'll use either phone or email as username
  limitAttempts: true,
  maxAttempts: 5,
  digestAlgorithm: "sha256",
  encoding: "hex",
  saltlen: 32,
  iterations: 25000,
  keylen: 512,
  passwordValidator: function (password, cb) {
    // Since we use auto-generated passwords, skip validation
    return cb();
  },
  usernameLowerCase: true,
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
