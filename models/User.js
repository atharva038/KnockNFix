const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const passportLocalMongoose = require("passport-local-mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String,
  },
  role: {
    type: String,
    enum: ["customer", "provider"], // Distinguish between customer and service provider
    default: "customer",
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'unverified'],
    default: 'unverified'
  },
  addresses: [
    {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      pincode: { type: String },
      coordinates: {
        latitude: { type: Number },
        longitude: { type: Number }
      },
      isDefault: { type: Boolean, default: false },
      label: { type: String, default: "Home" } // e.g., "Home", "Work", "Other"
    }
  ],
  // Store current location
  currentLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    lastUpdated: { type: Date }
  },

  phone: String,

  serviceCategories: [
    {
      type: String, // The service categories the provider offers, e.g., 'Plumbing'
      required: function () {
        return this.role === "provider"; // Only required for providers
      },
    },
  ],
  servicesOffered: [
    {
      type: mongoose.Schema.Types.ObjectId, // Reference to the services offered by the provider
      ref: "Service",
      required: function () {
        return this.role === "provider"; // Only required for providers
      },
    },
  ],
  date: {
    type: Date,
    default: Date.now,
  },
  // Add these fields for password reset functionality
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  // Add these fields to your User schema
  rememberToken: String,
  rememberTokenExpires: Date
});

UserSchema.plugin(passportLocalMongoose);

[
  {
    type: String,
  },
];


const User = mongoose.model("User", UserSchema);
module.exports = User;
