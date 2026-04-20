const express = require("express");
const router = express.Router();
const bookingController = require("../Controllers/bookingController");
const {isLoggedIn, isAdmin} = require("../middleware");
const {
  validateBookingIdParam,
  validateCreateBookingPayload,
  validateConfirmBookingPayload,
  validateCancelBookingPayload,
  validateAdminStatusUpdatePayload,
  handleBookingAPIValidationErrors,
  handleBookingPageValidationErrors,
} = require("../middleware/bookingValidation");

// ===== CUSTOMER ROUTES =====

// Create booking after payment confirmation
router.post(
  "/create",
  isLoggedIn,
  validateCreateBookingPayload,
  handleBookingAPIValidationErrors,
  bookingController.createBooking
);

// Booking confirmation page (before payment)
router.post(
  "/confirm",
  isLoggedIn,
  validateConfirmBookingPayload,
  handleBookingPageValidationErrors,
  bookingController.confirmBooking
);

// Get customer's bookings
router.get("/mybookings", isLoggedIn, bookingController.getMyBookings);

// Get booking details
router.get(
  "/details/:id",
  isLoggedIn,
  validateBookingIdParam,
  handleBookingPageValidationErrors,
  bookingController.getBookingDetails
);

// Complete booking (customer or provider)
router.post(
  "/complete/:id",
  isLoggedIn,
  validateBookingIdParam,
  handleBookingAPIValidationErrors,
  bookingController.completeBooking
);

// Cancel booking (customer only)
router.post(
  "/cancel/:id",
  isLoggedIn,
  validateBookingIdParam,
  validateCancelBookingPayload,
  handleBookingAPIValidationErrors,
  bookingController.cancelBooking
);

// Booking success page
router.get("/success", isLoggedIn, bookingController.getBookingSuccess);

// ===== ADMIN ROUTES =====

// Get all bookings (admin view)
router.get("/admin/all", isLoggedIn, isAdmin, bookingController.getAllBookings);

// Update booking status (admin only)
router.patch(
  "/admin/:id/status",
  isLoggedIn,
  isAdmin,
  validateBookingIdParam,
  validateAdminStatusUpdatePayload,
  handleBookingAPIValidationErrors,
  bookingController.updateBookingStatus
);

module.exports = router;
