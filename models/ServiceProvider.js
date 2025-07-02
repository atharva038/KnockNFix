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

    // NEW: Document Images for verification
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

    // NEW: Enhanced document verification
    documentVerification: {
      aadharVerified: {type: Boolean, default: false},
      panVerified: {type: Boolean, default: false},
      imagesVerified: {type: Boolean, default: false},
      allDocumentsVerified: {type: Boolean, default: false},
      verificationDate: {type: Date},
      verificationNotes: {type: String, trim: true},
      rejectionReason: {type: String, trim: true},
    },

    // Admin verification status (keep for backward compatibility)
    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
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
serviceProviderSchema.index({verificationStatus: 1});
serviceProviderSchema.index({isActive: 1});
serviceProviderSchema.index({"businessAddress.coordinates": "2dsphere"});
serviceProviderSchema.index({averageRating: -1});
serviceProviderSchema.index({completedBookings: -1});
serviceProviderSchema.index({"documentVerification.allDocumentsVerified": 1}); // NEW INDEX

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
    this.verificationStatus = this.documentVerification.allDocumentsVerified
      ? "verified"
      : "pending";
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
  if (this.aadharImage) score += 6; // NEW
  if (this.panImage) score += 6; // NEW
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

// NEW: Enhanced verification methods
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
  this.verificationStatus = "verified";
  this.verifiedAt = new Date();
  this.verifiedBy = adminId;
  if (notes) this.verificationNotes = notes;

  return this.save();
};

// Legacy methods (keep for backward compatibility)
serviceProviderSchema.methods.verify = function (adminId, notes) {
  return this.verifyAllDocuments(adminId, notes);
};

serviceProviderSchema.methods.reject = function (adminId, notes) {
  this.documentVerification = {
    aadharVerified: false,
    panVerified: false,
    imagesVerified: false,
    allDocumentsVerified: false,
    rejectionReason: notes,
  };

  // Legacy fields
  this.isVerified = false;
  this.verificationStatus = "rejected";
  this.verifiedBy = adminId;
  this.verificationNotes = notes;

  return this.save();
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
  return this.find({verificationStatus: "pending"});
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
    isVerified: true,
    isActive: true,
  });
};

// Virtual for verification status display
serviceProviderSchema.virtual("verificationStatusDisplay").get(function () {
  switch (this.verificationStatus) {
    case "pending":
      return "Verification Pending";
    case "verified":
      return "Verified";
    case "rejected":
      return "Verification Rejected";
    default:
      return "Unknown";
  }
});

// NEW: Virtual for document verification progress
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

module.exports = mongoose.model("ServiceProvider", serviceProviderSchema);
