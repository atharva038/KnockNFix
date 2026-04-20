const { query, validationResult } = require('express-validator');

const validateSuggestionsQuery = [
  query('query')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Query must be at least 3 characters long.'),
];

const validateAutocompleteQuery = [
  query('input')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Input must be at least 3 characters long.'),
];

const validateLatLngQuery = [
  query('lat')
    .notEmpty()
    .withMessage('Latitude is required.')
    .bail()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90.'),
  query('lng')
    .notEmpty()
    .withMessage('Longitude is required.')
    .bail()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180.'),
];

const validatePlaceIdQuery = [
  query('placeId')
    .trim()
    .notEmpty()
    .withMessage('Place ID is required.'),
];

const handleLocationValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    status: 'error',
    message: errors.array().map((err) => err.msg).join(', '),
    errors: errors.array(),
  });
};

module.exports = {
  validateSuggestionsQuery,
  validateAutocompleteQuery,
  validateLatLngQuery,
  validatePlaceIdQuery,
  handleLocationValidationErrors,
};
