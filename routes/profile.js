const express = require('express');
const router = express.Router();
const multer = require('multer');
const { storage } = require('../config/cloudinary');
const upload = multer({ storage });
const { isLoggedIn } = require('../middleware');
const providerController = require('../Controllers/providerController');
const {
    validateProfileUpdate,
    validateTravelFeePayload,
    validateBankDetailsPayload,
    handleProviderValidationErrors,
} = require('../middleware/providerValidation');
router.post('/update', isLoggedIn, upload.single('profileImage'), validateProfileUpdate, handleProviderValidationErrors, providerController.updateProfile);

router.post('/travel-fee', isLoggedIn, validateTravelFeePayload, handleProviderValidationErrors, providerController.updateTravelFee);

router.post('/bank-details', isLoggedIn, validateBankDetailsPayload, handleProviderValidationErrors, providerController.updateBankDetails);

router.get('/bank-details', isLoggedIn, providerController.getBankDetails);

router.get('/payout-info', isLoggedIn, providerController.getPayoutInfo);

module.exports = router;