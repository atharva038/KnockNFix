const mongoose = require("mongoose");

const serviceProviderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Each user can only have one provider profile
    },

    // Document verification fields for providers
    aadharCard: {
      type: String,
      required: true,
      unique: true,
      match: /^[0-9]{12}$/,
      trim: true,
    },

    panCard: {
      type: String,
      required: true,
      unique: true,
      match: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
      trim: true,
      uppercase: true,
    },

    // Document Images for verification
    aadharImage: {
      type: String, // Cloudinary URL
      required: true,
      trim: true,
    },

    panImage: {
      type: String, // Cloudinary URL
      required: true,
      trim: true,
    },

    // 🔥 ENHANCED VERIFICATION STATUS
    verificationStatus: {
      type: String,
      enum: ["pending", "documents_verified", "approved", "rejected"],
      default: "pending",
    },

    // 🔥 ADMIN VERIFICATION DETAILS
    adminVerification: {
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      verifiedAt: {
        type: Date,
        default: null,
      },
      verificationNotes: {
        type: String,
        default: null,
      },
      documentsApproved: {
        type: Boolean,
        default: false,
      },
      rejectionReason: {
        type: String,
        default: null,
      },
    },

    // 🔥 ACCESS CONTROL FLAGS
    canRegisterServices: {
      type: Boolean,
      default: false,
    },

    dashboardAccess: {
      type: Boolean,
      default: false,
    },

    canReceiveBookings: {
      type: Boolean,
      default: false,
    },

    canAccessPayouts: {
      type: Boolean,
      default: false,
    },

    // Enhanced document verification
    documentVerification: {
      aadharVerified: {type: Boolean, default: false},
      panVerified: {type: Boolean, default: false},
      imagesVerified: {type: Boolean, default: false},
      allDocumentsVerified: {type: Boolean, default: false},
      verificationDate: {type: Date},
      verificationNotes: {type: String, trim: true},
      rejectionReason: {type: String, trim: true},
    },

    // Keep legacy fields for backward compatibility
    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationNotes: {
      type: String,
      trim: true,
    },

    verifiedAt: {
      type: Date,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin who verified
    },

    // Business address (from registration)
    businessAddress: {
      street: {type: String, trim: true},
      city: {type: String, trim: true},
      state: {type: String, trim: true},
      pincode: {
        type: String,
        match: /^[0-9]{6}$/,
      },
      coordinates: {
        latitude: {type: Number},
        longitude: {type: Number},
      },
    },

    // Group services category-wise
    servicesOffered: [
      {
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
        services: [
          {
            service: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Service",
              required: true,
            },
            customCost: {type: Number},
            experience: {type: String}, // e.g. "2 years"
          },
        ],
      },
    ],

    // Primary service area
    serviceArea: {
      radius: {type: Number, default: 20},
      city: {type: String},
      state: {type: String},
      pincode: {type: String},
    },

    // Specific service areas/locations
    serviceAreas: [
      {
        address: {type: String},
        lat: {type: Number},
        lng: {type: Number},
        radius: {type: Number, default: 10},
      },
    ],

    // Portfolio of work
    portfolio: [
      {
        img: String,
        description: String,
        uploadedAt: {type: Date, default: Date.now},
      },
    ],

    // General experience field
    experience: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Financial tracking
    earnings: {
      type: Number,
      default: 0,
    },

    totalBookings: {
      type: Number,
      default: 0,
    },

    completedBookings: {
      type: Number,
      default: 0,
    },

    // Rating and reviews
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    totalReviews: {
      type: Number,
      default: 0,
    },

    // Availability schema
    availability: {
      monday: {
        isAvailable: {type: Boolean, default: true},
        slots: [
          {
            startTime: {type: String, default: "07:00"},
            endTime: {type: String, default: "21:00"},
            isActive: {type: Boolean, default: true},
          },
        ],
      },
      tuesday: {
        isAvailable: {type: Boolean, default: true},
        slots: [
          {
            startTime: {type: String, default: "07:00"},
            endTime: {type: String, default: "21:00"},
            isActive: {type: Boolean, default: true},
          },
        ],
      },
      wednesday: {
        isAvailable: {type: Boolean, default: true},
        slots: [
          {
            startTime: {type: String, default: "07:00"},
            endTime: {type: String, default: "21:00"},
            isActive: {type: Boolean, default: true},
          },
        ],
      },
      thursday: {
        isAvailable: {type: Boolean, default: true},
        slots: [
          {
            startTime: {type: String, default: "07:00"},
            endTime: {type: String, default: "21:00"},
            isActive: {type: Boolean, default: true},
          },
        ],
      },
      friday: {
        isAvailable: {type: Boolean, default: true},
        slots: [
          {
            startTime: {type: String, default: "07:00"},
            endTime: {type: String, default: "21:00"},
            isActive: {type: Boolean, default: true},
          },
        ],
      },
      saturday: {
        isAvailable: {type: Boolean, default: true},
        slots: [
          {
            startTime: {type: String, default: "07:00"},
            endTime: {type: String, default: "21:00"},
            isActive: {type: Boolean, default: true},
          },
        ],
      },
      sunday: {
        isAvailable: {type: Boolean, default: true},
        slots: [
          {
            startTime: {type: String, default: "07:00"},
            endTime: {type: String, default: "21:00"},
            isActive: {type: Boolean, default: true},
          },
        ],
      },
    },

    // Travel fee settings
    travelFeeEnabled: {
      type: Boolean,
      default: false,
    },

    travelFeeAmount: {
      type: Number,
      default: 5,
    },

    // Provider status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Account status
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "inactive"],
      default: "active",
    },

    // Bank details for payments
    bankDetails: {
      accountNumber: {
        type: String,
        trim: true,
      },
      ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
      },
      accountHolderName: {
        type: String,
        trim: true,
      },
      bankName: {
        type: String,
        trim: true,
      },
      verified: {
        type: Boolean,
        default: false,
      },
    },

    // Payment gateway integration
    razorpayContactId: String,
    razorpayFundAccountId: String,

    pendingPayouts: {
      type: Number,
      default: 0,
    },

    // Profile completion tracking
    profileCompletionScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Last activity tracking
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },

    // 🔥 NEW: APPROVAL WORKFLOW FIELDS
    approvalWorkflow: {
      documentsSubmittedAt: {
        type: Date,
        default: Date.now,
      },
      documentsReviewedAt: {
        type: Date,
        default: null,
      },
      approvedAt: {
        type: Date,
        default: null,
      },
      rejectedAt: {
        type: Date,
        default: null,
      },
      lastStatusChange: {
        type: Date,
        default: Date.now,
      },
      statusHistory: [
        {
          status: {
            type: String,
            enum: ["pending", "documents_verified", "approved", "rejected"],
          },
          changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          changedAt: {
            type: Date,
            default: Date.now,
          },
          notes: {
            type: String,
          },
        },
      ],
    },

    // 🔥 NEW: NOTIFICATION SETTINGS
    notifications: {
      approvalStatusChange: {
        type: Boolean,
        default: true,
      },
      newBookingReceived: {
        type: Boolean,
        default: true,
      },
      paymentReceived: {
        type: Boolean,
        default: true,
      },
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      smsNotifications: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Indexes for better query performance
serviceProviderSchema.index({user: 1});
serviceProviderSchema.index({aadharCard: 1});
serviceProviderSchema.index({panCard: 1});
serviceProviderSchema.index({isVerified: 1});
serviceProviderSchema.index({verificationStatus: 1}); // 🔥 NEW INDEX
serviceProviderSchema.index({isActive: 1});
serviceProviderSchema.index({"businessAddress.coordinates": "2dsphere"});
serviceProviderSchema.index({averageRating: -1});
serviceProviderSchema.index({completedBookings: -1});
serviceProviderSchema.index({"documentVerification.allDocumentsVerified": 1});
serviceProviderSchema.index({"adminVerification.verifiedBy": 1}); // 🔥 NEW INDEX
serviceProviderSchema.index({"adminVerification.verifiedAt": 1}); // 🔥 NEW INDEX
serviceProviderSchema.index({canRegisterServices: 1}); // 🔥 NEW INDEX
serviceProviderSchema.index({dashboardAccess: 1}); // 🔥 NEW INDEX
serviceProviderSchema.index({canReceiveBookings: 1}); // 🔥 NEW INDEX

// Pre-save middleware
serviceProviderSchema.pre("save", function (next) {
  // Ensure PAN card is uppercase
  if (this.panCard) {
    this.panCard = this.panCard.toUpperCase();
  }

  // Update overall verification status based on individual document verification
  if (this.documentVerification) {
    const {aadharVerified, panVerified, imagesVerified} =
      this.documentVerification;
    this.documentVerification.allDocumentsVerified =
      aadharVerified && panVerified && imagesVerified;

    // Sync with legacy isVerified field for backward compatibility
    this.isVerified = this.documentVerification.allDocumentsVerified;
  }

  // 🔥 UPDATE APPROVAL WORKFLOW
  if (this.isModified("verificationStatus")) {
    this.approvalWorkflow.lastStatusChange = new Date();

    // Add to status history
    if (!this.approvalWorkflow.statusHistory) {
      this.approvalWorkflow.statusHistory = [];
    }

    this.approvalWorkflow.statusHistory.push({
      status: this.verificationStatus,
      changedAt: new Date(),
      changedBy: this.adminVerification?.verifiedBy || null,
      notes: this.adminVerification?.verificationNotes || null,
    });

    // Update specific timestamps based on status
    switch (this.verificationStatus) {
      case "documents_verified":
        this.approvalWorkflow.documentsReviewedAt = new Date();
        break;
      case "approved":
        this.approvalWorkflow.approvedAt = new Date();
        this.canRegisterServices = true;
        this.dashboardAccess = true;
        this.canReceiveBookings = true;
        this.canAccessPayouts = true;
        break;
      case "rejected":
        this.approvalWorkflow.rejectedAt = new Date();
        this.canRegisterServices = false;
        this.dashboardAccess = false;
        this.canReceiveBookings = false;
        this.canAccessPayouts = false;
        break;
    }
  }

  // Update profile completion score
  this.updateProfileCompletionScore();

  next();
});

// Instance methods
serviceProviderSchema.methods.updateProfileCompletionScore = function () {
  let score = 0;

  // Basic info (40 points)
  if (this.aadharCard) score += 8;
  if (this.panCard) score += 8;
  if (this.aadharImage) score += 6;
  if (this.panImage) score += 6;
  if (this.businessAddress && this.businessAddress.street) score += 6;
  if (this.isVerified) score += 6;

  // Services (30 points)
  if (this.servicesOffered && this.servicesOffered.length > 0) score += 20;
  if (this.experience > 0) score += 10;

  // Portfolio (20 points)
  if (this.portfolio && this.portfolio.length > 0) score += 20;

  // Bank details (10 points)
  if (this.bankDetails && this.bankDetails.accountNumber) score += 10;

  this.profileCompletionScore = score;
  return score;
};

serviceProviderSchema.methods.updateRating = function (newRating) {
  const totalRating = this.averageRating * this.totalReviews + newRating;
  this.totalReviews += 1;
  this.averageRating = totalRating / this.totalReviews;
  return this.save();
};

serviceProviderSchema.methods.incrementBookings = function () {
  this.totalBookings += 1;
  return this.save();
};

serviceProviderSchema.methods.incrementCompletedBookings = function () {
  this.completedBookings += 1;
  return this.save();
};

serviceProviderSchema.methods.updateLastActive = function () {
  this.lastActiveAt = new Date();
  return this.save();
};

// 🔥 NEW: ADMIN APPROVAL METHODS
serviceProviderSchema.methods.approveProvider = function (adminId, notes) {
  this.verificationStatus = "approved";
  this.adminVerification = {
    verifiedBy: adminId,
    verifiedAt: new Date(),
    verificationNotes: notes,
    documentsApproved: true,
  };

  // Enable all access permissions
  this.canRegisterServices = true;
  this.dashboardAccess = true;
  this.canReceiveBookings = true;
  this.canAccessPayouts = true;

  // Update document verification
  this.documentVerification = {
    aadharVerified: true,
    panVerified: true,
    imagesVerified: true,
    allDocumentsVerified: true,
    verificationDate: new Date(),
    verificationNotes: notes,
  };

  // Legacy fields for backward compatibility
  this.isVerified = true;
  this.verifiedAt = new Date();
  this.verifiedBy = adminId;
  if (notes) this.verificationNotes = notes;

  return this.save();
};

serviceProviderSchema.methods.rejectProvider = function (
  adminId,
  reason,
  notes
) {
  this.verificationStatus = "rejected";
  this.adminVerification = {
    verifiedBy: adminId,
    verifiedAt: new Date(),
    verificationNotes: notes,
    documentsApproved: false,
    rejectionReason: reason,
  };

  // Disable all access permissions
  this.canRegisterServices = false;
  this.dashboardAccess = false;
  this.canReceiveBookings = false;
  this.canAccessPayouts = false;

  // Update document verification
  this.documentVerification = {
    aadharVerified: false,
    panVerified: false,
    imagesVerified: false,
    allDocumentsVerified: false,
    rejectionReason: reason,
  };

  // Legacy fields
  this.isVerified = false;
  this.verifiedBy = adminId;
  this.verificationNotes = notes;

  return this.save();
};

serviceProviderSchema.methods.grantDashboardAccess = function (adminId) {
  this.dashboardAccess = true;
  this.adminVerification.verifiedBy = adminId;
  this.adminVerification.verifiedAt = new Date();
  return this.save();
};

serviceProviderSchema.methods.revokeDashboardAccess = function (
  adminId,
  reason
) {
  this.dashboardAccess = false;
  this.canRegisterServices = false;
  this.canReceiveBookings = false;
  this.adminVerification.rejectionReason = reason;
  return this.save();
};

serviceProviderSchema.methods.enableServiceRegistration = function (adminId) {
  this.canRegisterServices = true;
  this.adminVerification.verifiedBy = adminId;
  this.adminVerification.verifiedAt = new Date();
  return this.save();
};

serviceProviderSchema.methods.disableServiceRegistration = function (
  adminId,
  reason
) {
  this.canRegisterServices = false;
  this.adminVerification.rejectionReason = reason;
  return this.save();
};

// Enhanced verification methods
serviceProviderSchema.methods.verifyDocument = function (
  documentType,
  adminId,
  notes
) {
  if (!this.documentVerification) {
    this.documentVerification = {};
  }

  this.documentVerification[`${documentType}Verified`] = true;
  this.documentVerification.verificationDate = new Date();
  this.documentVerification.verificationNotes = notes;
  this.verifiedBy = adminId;

  return this.save();
};

serviceProviderSchema.methods.verifyAllDocuments = function (adminId, notes) {
  this.verificationStatus = "documents_verified"; // 🔥 UPDATED STATUS

  this.documentVerification = {
    aadharVerified: true,
    panVerified: true,
    imagesVerified: true,
    allDocumentsVerified: true,
    verificationDate: new Date(),
    verificationNotes: notes,
  };

  this.adminVerification = {
    verifiedBy: adminId,
    verifiedAt: new Date(),
    verificationNotes: notes,
    documentsApproved: true,
  };

  // Legacy fields for backward compatibility
  this.isVerified = true;
  this.verifiedAt = new Date();
  this.verifiedBy = adminId;
  if (notes) this.verificationNotes = notes;

  return this.save();
};

// Legacy methods (keep for backward compatibility)
serviceProviderSchema.methods.verify = function (adminId, notes) {
  return this.approveProvider(adminId, notes);
};

serviceProviderSchema.methods.reject = function (adminId, notes) {
  return this.rejectProvider(adminId, notes, notes);
};

// Static methods
serviceProviderSchema.statics.findVerified = function () {
  return this.find({
    isVerified: true,
    isActive: true,
    accountStatus: "active",
  });
};

serviceProviderSchema.statics.findFullyVerified = function () {
  return this.find({
    "documentVerification.allDocumentsVerified": true,
    isActive: true,
    accountStatus: "active",
  });
};

serviceProviderSchema.statics.findPendingVerification = function () {
  return this.find({verificationStatus: "pending"})
    .populate("user", "name phone email createdAt")
    .sort({createdAt: -1});
};

// 🔥 NEW STATIC METHODS FOR ADMIN APPROVAL WORKFLOW
serviceProviderSchema.statics.findPendingApproval = function () {
  return this.find({
    verificationStatus: {$in: ["pending", "documents_verified"]},
  })
    .populate("user", "name phone email createdAt addresses")
    .populate("adminVerification.verifiedBy", "name email")
    .sort({createdAt: -1});
};

serviceProviderSchema.statics.findApprovedProviders = function () {
  return this.find({
    verificationStatus: "approved",
    isActive: true,
  })
    .populate("user", "name phone email")
    .populate("adminVerification.verifiedBy", "name email")
    .sort({"adminVerification.verifiedAt": -1});
};

serviceProviderSchema.statics.findRejectedProviders = function () {
  return this.find({
    verificationStatus: "rejected",
  })
    .populate("user", "name phone email")
    .populate("adminVerification.verifiedBy", "name email")
    .sort({"adminVerification.verifiedAt": -1});
};

serviceProviderSchema.statics.findWithDashboardAccess = function () {
  return this.find({
    dashboardAccess: true,
    isActive: true,
  });
};

serviceProviderSchema.statics.findWithServiceRegistrationAccess = function () {
  return this.find({
    canRegisterServices: true,
    isActive: true,
  });
};

serviceProviderSchema.statics.getApprovalStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: "$verificationStatus",
        count: {$sum: 1},
      },
    },
  ]);
};

serviceProviderSchema.statics.findByAadhar = function (aadharCard) {
  return this.findOne({aadharCard});
};

serviceProviderSchema.statics.findByPan = function (panCard) {
  return this.findOne({panCard: panCard.toUpperCase()});
};

serviceProviderSchema.statics.findInArea = function (
  coordinates,
  radiusInKm = 20
) {
  return this.find({
    "businessAddress.coordinates": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [coordinates.longitude, coordinates.latitude],
        },
        $maxDistance: radiusInKm * 1000, // Convert km to meters
      },
    },
    verificationStatus: "approved", // 🔥 ONLY APPROVED PROVIDERS
    isActive: true,
    canReceiveBookings: true,
  });
};

// Virtual for verification status display
serviceProviderSchema.virtual("verificationStatusDisplay").get(function () {
  switch (this.verificationStatus) {
    case "pending":
      return "Pending Admin Review";
    case "documents_verified":
      return "Documents Verified - Awaiting Final Approval";
    case "approved":
      return "Approved & Active";
    case "rejected":
      return "Verification Rejected";
    default:
      return "Unknown Status";
  }
});

// 🔥 NEW VIRTUAL FOR APPROVAL PROGRESS
serviceProviderSchema.virtual("approvalProgress").get(function () {
  switch (this.verificationStatus) {
    case "pending":
      return 25;
    case "documents_verified":
      return 75;
    case "approved":
      return 100;
    case "rejected":
      return 0;
    default:
      return 0;
  }
});

// Virtual for document verification progress
serviceProviderSchema.virtual("documentVerificationProgress").get(function () {
  if (!this.documentVerification) return 0;

  let completed = 0;
  if (this.documentVerification.aadharVerified) completed++;
  if (this.documentVerification.panVerified) completed++;
  if (this.documentVerification.imagesVerified) completed++;

  return Math.round((completed / 3) * 100);
});

// Virtual for completion rate
serviceProviderSchema.virtual("completionRate").get(function () {
  if (this.totalBookings === 0) return 0;
  return Math.round((this.completedBookings / this.totalBookings) * 100);
});

// 🔥 NEW VIRTUAL FOR ACCESS PERMISSIONS SUMMARY
serviceProviderSchema.virtual("accessPermissions").get(function () {
  return {
    dashboardAccess: this.dashboardAccess,
    canRegisterServices: this.canRegisterServices,
    canReceiveBookings: this.canReceiveBookings,
    canAccessPayouts: this.canAccessPayouts,
    isFullyEnabled:
      this.dashboardAccess &&
      this.canRegisterServices &&
      this.canReceiveBookings,
  };
});

// 🔥 NEW VIRTUAL FOR APPROVAL TIMELINE
serviceProviderSchema.virtual("approvalTimeline").get(function () {
  const timeline = [];

  if (this.approvalWorkflow?.documentsSubmittedAt) {
    timeline.push({
      step: "Documents Submitted",
      date: this.approvalWorkflow.documentsSubmittedAt,
      status: "completed",
    });
  }

  if (this.approvalWorkflow?.documentsReviewedAt) {
    timeline.push({
      step: "Documents Reviewed",
      date: this.approvalWorkflow.documentsReviewedAt,
      status: "completed",
    });
  }

  if (this.approvalWorkflow?.approvedAt) {
    timeline.push({
      step: "Provider Approved",
      date: this.approvalWorkflow.approvedAt,
      status: "completed",
    });
  } else if (this.approvalWorkflow?.rejectedAt) {
    timeline.push({
      step: "Provider Rejected",
      date: this.approvalWorkflow.rejectedAt,
      status: "rejected",
    });
  }

  return timeline;
});

// Set virtual fields to be included in JSON output
serviceProviderSchema.set("toJSON", {virtuals: true});
serviceProviderSchema.set("toObject", {virtuals: true});

module.exports = mongoose.model("ServiceProvider", serviceProviderSchema);
