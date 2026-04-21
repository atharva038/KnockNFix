const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware');
const feedbackController = require('../Controllers/feedbackController');

// Render feedback page
router.get('/:bookingId', isLoggedIn, feedbackController.showFeedbackPage);

// Handle feedback submission
router.post('/submit', isLoggedIn, feedbackController.submitFeedback);

module.exports = router;