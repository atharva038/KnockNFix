const mongoose = require("mongoose");

// Define the Booking Schema
const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to the customer (User model)
    required: true,
  },
  providerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service", // Reference to the service
    required: true,
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider", // Reference to the service provider
    required: true,
  },
  address: { type: String, required: true },
  bookingDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number], // [lng, lat]
  },

  notes: { type: String },
  totalCost: {
    type: Number,
    required: true
  },
  providerConfirmation: {
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    confirmedAt: Date,
    rejectionReason: String
  },
  advancePayment: {
    amount: Number,
    paymentId: String,
    orderId: String,
    paid: {
      type: Boolean,
      default: false
    }
  },
  finalPayment: {
    amount: Number,
    paymentId: String,
    orderId: String,
    paid: {
      type: Boolean,
      default: false
    }
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'refunded'],
    default: 'pending'
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxLength: 1000
    },
    recommend: {
      type: Boolean,
      default: null
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  }
});

module.exports = mongoose.model("Booking", bookingSchema);
