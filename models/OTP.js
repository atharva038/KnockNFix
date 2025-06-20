const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        sparse: true // Allow null/undefined but enforce uniqueness for non-null values
    },
    phone: {
        type: String,
        required: true // Phone is always required
    },
    emailOTP: {
        type: String,
        required: function () {
            // Only require emailOTP if email is provided AND not a temporary customer email
            return this.email && !this.email.includes('@customer.temp');
        }
    },
    phoneOTP: {
        type: String,
        required: true // Phone OTP is always required
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },
    userData: {
        type: Object,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // Automatically expire document after 10 minutes (600 seconds)
    }
});

const OTP = mongoose.model('OTP', OTPSchema);
module.exports = OTP;