const express = require("express");
const router = express.Router();
const {isAdmin} = require("../middleware");
const {
  validateProviderIdParam,
  validateObjectIdParam,
  validateRejectProvider,
  validateManageProviderPermissions,
  validateApproveProvider,
  validateCategoryPayload,
  handleAdminValidationErrors,
} = require("../middleware/adminValidation");
const approvalController = require("../Controllers/admin/approvalController");
const dashboardAdminController = require("../Controllers/admin/dashboardAdminController");
const userAdminController = require("../Controllers/admin/userAdminController");
const categoryController = require("../Controllers/admin/categoryController");
const serviceAdminController = require("../Controllers/admin/serviceAdminController");
const bookingAdminController = require("../Controllers/admin/bookingAdminController");
const paymentAdminController = require("../Controllers/admin/paymentAdminController");
const reportsController = require("../Controllers/admin/reportsController");
const settingsController = require("../Controllers/admin/settingsController");

const multer = require("multer");
const {storage} = require("../config/cloudinary");
const upload = multer({storage});

// Apply admin middleware to all routes
router.use(isAdmin);

// 🔥 NEW: Provider Approval Routes
router.get("/pending-providers", approvalController.getPendingProviders);
router.post(
  "/approve-provider/:providerId",
  validateApproveProvider,
  handleAdminValidationErrors,
  approvalController.approveProvider
);
router.post(
  "/reject-provider/:providerId",
  validateRejectProvider,
  handleAdminValidationErrors,
  approvalController.rejectProvider
);
router.post(
  "/manage-permissions/:providerId",
  validateManageProviderPermissions,
  handleAdminValidationErrors,
  approvalController.manageProviderPermissions
);
router.get(
  "/api/provider-details/:providerId",
  validateProviderIdParam,
  handleAdminValidationErrors,
  approvalController.getProviderDetailsAPI
);

// Dashboard
router.get("/dashboard", dashboardAdminController.showDashboard);

// Users Management
router.get("/users", userAdminController.showUsers);

// Categories Management
router.get("/categories", categoryController.showCategories);
router.get("/addCategory", categoryController.showAddCategory);
router.post(
  "/categories",
  upload.single("image"),
  validateCategoryPayload,
  handleAdminValidationErrors,
  categoryController.createCategory
);
router.get(
  "/editCategory/:id",
  validateObjectIdParam,
  handleAdminValidationErrors,
  categoryController.showEditCategory
);
router.put(
  "/categories/:id",
  upload.single("image"),
  validateObjectIdParam,
  validateCategoryPayload,
  handleAdminValidationErrors,
  categoryController.updateCategory
);
router.delete(
  "/categories/:id",
  validateObjectIdParam,
  handleAdminValidationErrors,
  categoryController.deleteCategory
);
router.post(
  "/categories/:id/toggle",
  validateObjectIdParam,
  handleAdminValidationErrors,
  categoryController.toggleCategoryStatus
);

// Services Management
router.get("/services", serviceAdminController.showServices);
router.delete(
  "/services/:id",
  validateObjectIdParam,
  handleAdminValidationErrors,
  serviceAdminController.deleteService
);
router.post(
  "/services/:id/toggle",
  validateObjectIdParam,
  handleAdminValidationErrors,
  serviceAdminController.toggleServiceStatus
);

// Bookings Management
router.get("/bookings", bookingAdminController.showBookings);

// Payments Management
router.get("/payments", paymentAdminController.showPayments);

// Provider Payouts Management
router.get("/provider-payouts", paymentAdminController.showProviderPayouts);
router.post(
  "/process-payout/:providerId",
  validateProviderIdParam,
  handleAdminValidationErrors,
  paymentAdminController.processPayout
);
router.post(
  "/verify-bank-details/:providerId",
  validateProviderIdParam,
  handleAdminValidationErrors,
  paymentAdminController.verifyBankDetails
);

// Reports
router.get("/reports", reportsController.showReports);

// Feedback Management
router.get("/feedback", reportsController.showFeedback);

// Settings
router.get("/settings", settingsController.showSettings);
router.post("/settings", settingsController.updateSettings);

module.exports = router;
