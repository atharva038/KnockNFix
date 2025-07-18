const mongoose = require("mongoose");

// Define the Service Schema
const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  ratings: {
    type: Number,
    default: 0,
  },
  reviews: {
    type: Number,
    default: 0,
  },
  img: {
    type: String,
    required: true,
  },
  providers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider",
    },
  ],
  price: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number, // Duration in minutes
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category", // Reference to Category
    required: true,
  },
  tags: {
    type: [String],
    default: [], // Array of tags for the service
  },
  isActive: { 
    type: Boolean, 
    default: true 
  }


  
  
});

const Service = mongoose.model("Service", serviceSchema);
module.exports = Service;
