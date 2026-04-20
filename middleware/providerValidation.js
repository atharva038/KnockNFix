const { body, param, validationResult } = require('express-validator');

const isBooleanLike = (value) => {
  return value === true || value === false || value === 'true' || value === 'false';
};

const validateServiceIdParam = [
  param('serviceId').isMongoId().withMessage('Invalid service id.'),
];

const validateProviderServiceUpdate = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Service name is required.')
    .isLength({ min: 2 })
    .withMessage('Service name must be at least 2 characters long.'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Service description is required.')
    .isLength({ min: 5 })
    .withMessage('Service description must be at least 5 characters long.'),
  body('cost')
    .notEmpty()
    .withMessage('Cost is required.')
    .bail()
    .isFloat({ gt: 0 })
    .withMessage('Cost must be a positive number.'),
  body('availability')
    .optional({ nullable: true })
    .trim(),
];

const validateProfileUpdate = [
  body('name')
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long.'),
  body('phone')
    .optional({ nullable: true })
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please enter a valid 10-digit Indian mobile number.'),
  body('address')
    .optional({ nullable: true })
    .trim(),
];

const validateTravelFeePayload = [
  body('enabled')
    .exists({ checkNull: true })
    .withMessage('enabled is required.')
    .bail()
    .custom(isBooleanLike)
    .withMessage('enabled must be true or false.'),
  body('amount')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      const enabled = req.body.enabled === true || req.body.enabled === 'true';
      if (!enabled) {
        return true;
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error('amount must be a positive number when travel fee is enabled.');
      }
      return true;
    }),
];

const validateBankDetailsPayload = [
  body('accountHolderName')
    .trim()
    .notEmpty()
    .withMessage('Account holder name is required.')
    .isLength({ min: 2 })
    .withMessage('Account holder name must be at least 2 characters long.'),
  body('accountNumber')
    .trim()
    .notEmpty()
    .withMessage('Account number is required.')
    .matches(/^\d{8,20}$/)
    .withMessage('Account number must be 8 to 20 digits.'),
  body('ifscCode')
    .trim()
    .notEmpty()
    .withMessage('IFSC code is required.')
    .matches(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/)
    .withMessage('Please enter a valid IFSC code.'),
  body('bankName')
    .trim()
    .notEmpty()
    .withMessage('Bank name is required.')
    .isLength({ min: 2 })
    .withMessage('Bank name must be at least 2 characters long.'),
];

const handleProviderValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const errorText = errors.array().map((err) => err.msg).join(', ');
  const wantsJson =
    req.originalUrl.includes('/api/') ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json'));

  if (wantsJson) {
    return res.status(400).json({
      success: false,
      error: errorText,
      errors: errors.array(),
    });
  }

  if (typeof req.flash === 'function') {
    req.flash('error', errorText);
    return res.redirect(req.get('Referrer') || '/');
  }

  return res.status(400).json({
    success: false,
    error: errorText,
    errors: errors.array(),
  });
};

module.exports = {
  validateServiceIdParam,
  validateProviderServiceUpdate,
  validateProfileUpdate,
  validateTravelFeePayload,
  validateBankDetailsPayload,
  handleProviderValidationErrors,
};
