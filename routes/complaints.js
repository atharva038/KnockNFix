const express = require('express');
const router = express.Router();
const complaintController = require('../Controllers/complaintController');
const { isLoggedIn } = require('../middleware');
const { upload } = require('../config/cloudinary');

router.get('/', isLoggedIn, complaintController.showComplaints);

// Add new complaint
router.post('/add', isLoggedIn, upload.array('attachments'), complaintController.createComplaint);

module.exports = router;