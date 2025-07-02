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
      enum: ["customer", "provider", "admin"], // 🔥 ADD ADMIN ROLE
      required: true,
      default: "customer",
    },

    // 🔥 UPDATE STATUS ENUM TO INCLUDE APPROVAL STATES
    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "unverified",
        "pending_approval",
        "rejected",
        "suspended",
      ],
      default: "unverified",
    },

    // 🔥 ADD APPROVAL STATUS TRACKING
    approvalStatus: {
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      approvedAt: {
        type: Date,
        default: null,
      },
      rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      rejectedAt: {
        type: Date,
        default: null,
      },
      rejectionReason: {
        type: String,
        default: null,
      },
      adminNotes: {
        type: String,
        default: null,
      },
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
UserSchema.index({"approvalStatus.approvedBy": 1}); // 🔥 NEW INDEX
UserSchema.index({"approvalStatus.rejectedBy": 1}); // 🔥 NEW INDEX

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

// 🔥 UPDATED PHONE VERIFICATION - DIFFERENT BEHAVIOR FOR PROVIDERS
UserSchema.methods.verifyPhone = function () {
  this.isPhoneVerified = true;
  // Don't auto-activate providers - they need admin approval
  if (this.role === "customer") {
    this.status = "active";
  } else if (this.role === "provider") {
    this.status = "pending_approval";
  } else if (this.role === "admin") {
    this.status = "active";
  }
  return this.save();
};

UserSchema.methods.verifyEmail = function () {
  this.isEmailVerified = true;
  return this.save();
};

// 🔥 NEW APPROVAL METHODS
UserSchema.methods.approveProvider = function (adminId, notes) {
  this.status = "active";
  this.approvalStatus = {
    approvedBy: adminId,
    approvedAt: new Date(),
    adminNotes: notes || null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
  };
  return this.save();
};

UserSchema.methods.rejectProvider = function (adminId, reason, notes) {
  this.status = "rejected";
  this.approvalStatus = {
    rejectedBy: adminId,
    rejectedAt: new Date(),
    rejectionReason: reason,
    adminNotes: notes || null,
    approvedBy: null,
    approvedAt: null,
  };
  return this.save();
};

UserSchema.methods.suspendUser = function (adminId, reason) {
  this.status = "suspended";
  this.approvalStatus = {
    rejectedBy: adminId,
    rejectedAt: new Date(),
    rejectionReason: reason,
  };
  return this.save();
};

UserSchema.methods.reactivateUser = function (adminId, notes) {
  if (this.role === "customer") {
    this.status = "active";
  } else if (this.role === "provider") {
    this.status = "active"; // Reactivate approved provider
  }
  this.approvalStatus = {
    approvedBy: adminId,
    approvedAt: new Date(),
    adminNotes: notes || "Account reactivated",
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
  };
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

// 🔥 NEW STATIC METHODS FOR ADMIN
UserSchema.statics.findPendingProviders = function () {
  return this.find({role: "provider", status: "pending_approval"})
    .populate("approvalStatus.approvedBy", "name email")
    .populate("approvalStatus.rejectedBy", "name email")
    .sort({createdAt: -1});
};

UserSchema.statics.findRejectedProviders = function () {
  return this.find({role: "provider", status: "rejected"})
    .populate("approvalStatus.rejectedBy", "name email")
    .sort({"approvalStatus.rejectedAt": -1});
};

UserSchema.statics.findAdmins = function () {
  return this.find({role: "admin", status: "active"});
};

UserSchema.statics.findActiveProviders = function () {
  return this.find({role: "provider", status: "active"})
    .populate("approvalStatus.approvedBy", "name email")
    .sort({"approvalStatus.approvedAt": -1});
};

UserSchema.statics.findSuspendedUsers = function () {
  return this.find({status: "suspended"})
    .populate("approvalStatus.rejectedBy", "name email")
    .sort({"approvalStatus.rejectedAt": -1});
};

UserSchema.statics.getProviderStats = function () {
  return this.aggregate([
    {
      $match: {role: "provider"},
    },
    {
      $group: {
        _id: "$status",
        count: {$sum: 1},
      },
    },
  ]);
};

UserSchema.statics.getCustomerStats = function () {
  return this.aggregate([
    {
      $match: {role: "customer"},
    },
    {
      $group: {
        _id: "$status",
        count: {$sum: 1},
      },
    },
  ]);
};

// 🔥 NEW VIRTUAL FOR APPROVAL STATUS DISPLAY
UserSchema.virtual("approvalStatusDisplay").get(function () {
  switch (this.status) {
    case "pending_approval":
      return "Pending Admin Approval";
    case "active":
      if (this.role === "provider" && this.approvalStatus?.approvedAt) {
        return "Approved by Admin";
      }
      return "Active";
    case "rejected":
      return "Rejected by Admin";
    case "suspended":
      return "Suspended";
    case "unverified":
      return "Phone Not Verified";
    case "inactive":
      return "Inactive";
    default:
      return "Unknown Status";
  }
});

// 🔥 NEW VIRTUAL FOR SERVICE PROVIDER REFERENCE
UserSchema.virtual("serviceProvider", {
  ref: "ServiceProvider",
  localField: "_id",
  foreignField: "user",
  justOne: true,
});

// Virtual for full name (if needed for display)
UserSchema.virtual("displayName").get(function () {
  return this.name;
});

// 🔥 NEW VIRTUAL FOR APPROVAL DATE FORMATTING
UserSchema.virtual("approvalDateFormatted").get(function () {
  if (this.approvalStatus?.approvedAt) {
    return this.approvalStatus.approvedAt.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (this.approvalStatus?.rejectedAt) {
    return this.approvalStatus.rejectedAt.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return null;
});

// 🔥 NEW VIRTUAL FOR CHECKING IF USER CAN LOGIN
UserSchema.virtual("canLogin").get(function () {
  return (
    this.isPhoneVerified &&
    this.status !== "unverified" &&
    this.status !== "pending_approval" &&
    this.status !== "rejected" &&
    this.status !== "suspended"
  );
});

// 🔥 NEW VIRTUAL FOR CHECKING IF PROVIDER CAN ACCESS SERVICES
UserSchema.virtual("canAccessServices").get(function () {
  return (
    this.role === "provider" && this.status === "active" && this.isPhoneVerified
  );
});

// Set virtual fields to be included in JSON output
UserSchema.set("toJSON", {virtuals: true});
UserSchema.set("toObject", {virtuals: true});

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
