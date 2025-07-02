const express = require("express");
const router = express.Router();
const {isAdmin} = require("../middleware");
const adminController = require("../Controllers/adminController");

const multer = require("multer");
const {storage} = require("../config/cloudinary");
const upload = multer({storage});

// Apply admin middleware to all routes
// router.use(isAdmin);

// 🔥 NEW: Provider Approval Routes
router.get("/pending-providers", adminController.getPendingProviders);
router.post("/approve-provider/:providerId", adminController.approveProvider);
router.post("/reject-provider/:providerId", adminController.rejectProvider);
router.post(
  "/manage-permissions/:providerId",
  adminController.manageProviderPermissions
);
router.get(
  "/api/provider-details/:providerId",
  adminController.getProviderDetailsAPI
);

// Dashboard
router.get("/dashboard", adminController.showDashboard);

// Users Management
router.get("/users", adminController.showUsers);

// Categories Management
router.get("/categories", adminController.showCategories);
router.get("/addCategory", adminController.showAddCategory);
router.post(
  "/categories",
  upload.single("image"),
  adminController.createCategory
);
router.get("/editCategory/:id", adminController.showEditCategory);
router.put(
  "/categories/:id",
  upload.single("image"),
  adminController.updateCategory
);
router.delete("/categories/:id", adminController.deleteCategory);
router.post("/categories/:id/toggle", adminController.toggleCategoryStatus);

// Services Management
router.get("/services", adminController.showServices);
router.delete("/services/:id", adminController.deleteService);
router.post("/services/:id/toggle", adminController.toggleServiceStatus);

// Bookings Management
router.get("/bookings", adminController.showBookings);

// Payments Management
router.get("/payments", adminController.showPayments);

// Provider Payouts Management
router.get("/provider-payouts", adminController.showProviderPayouts);
router.post("/process-payout/:providerId", adminController.processPayout);
router.post(
  "/verify-bank-details/:providerId",
  adminController.verifyBankDetails
);

// Reports
router.get("/reports", adminController.showReports);

// Feedback Management
router.get("/feedback", adminController.showFeedback);

// Settings
router.get("/settings", adminController.showSettings);
router.post("/settings", adminController.updateSettings);

module.exports = router;
