const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['service_quality', 'payment', 'provider_behaviour', 'other'],
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'resolved'],
        default: 'pending'
    },
    attachments: [{
        type: String // Cloudinary URLs
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Complaint', complaintSchema);