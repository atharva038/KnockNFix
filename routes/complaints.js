const express = require('express');
const router = express.Router();
const complaintController = require('../Controllers/complaintController');
const { isLoggedIn } = require('../middleware');
const { upload } = require('../config/cloudinary');
const {
  validateComplaintPayload,
  handleComplaintValidationErrors,
} = require('../middleware/complaintValidation');

router.get('/', isLoggedIn, complaintController.showComplaints);

// Add new complaint
// NOTE: upload.array runs first so multer can parse multipart/form-data before express-validator reads req.body
router.post(
  '/add',
  isLoggedIn,
  upload.array('attachments'),
  validateComplaintPayload,
  handleComplaintValidationErrors,
  complaintController.createComplaint
);

module.exports = router;