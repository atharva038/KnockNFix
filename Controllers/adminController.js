const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");
const Category = require("../models/category");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const {
  notifyProviderApproval,
  notifyProviderStatusChange,
  logAdminAction,
  getNotificationStats,
} = require("../utils/adminNotifications");

const adminController = {
  // 🔥 NEW: Provider Approval Management
  getPendingProviders: async (req, res) => {
    try {
      const pendingProviders = await User.find({
        role: "provider",
        status: "pending_approval",
      })
        .populate({
          path: "addresses",
        })
        .sort({createdAt: -1});

      const providersWithDetails = await Promise.all(
        pendingProviders.map(async (user) => {
          const serviceProvider = await ServiceProvider.findOne({
            user: user._id,
          });
          return {
            user: user,
            serviceProvider: serviceProvider,
            registrationDate: user.createdAt,
            businessAddress: user.addresses?.[0] || null,
          };
        })
      );

      res.render("pages/admin/pending-providers", {
        providers: providersWithDetails,
        title: "Pending Provider Approvals - Admin",
        currentPath: req.path,
      });
    } catch (err) {
      console.error("Error fetching pending providers:", err);
      req.flash("error", "Failed to load pending providers");
      res.redirect("/admin/dashboard");
    }
  },

  // 🔥 NEW: Approve Provider
  approveProvider: async (req, res) => {
    try {
      const {providerId} = req.params;
      const {
        grantDashboardAccess,
        grantServiceRegistration,
        grantBookingAccess,
        grantPayoutAccess,
        notes,
      } = req.body;

      const user = await User.findById(providerId);
      if (!user || user.role !== "provider") {
        return res.status(404).json({
          success: false,
          error: "Provider not found",
        });
      }

      if (user.status !== "pending_approval") {
        return res.status(400).json({
          success: false,
          error: "Provider is not pending approval",
        });
      }

      const serviceProvider = await ServiceProvider.findOne({user: providerId});
      if (!serviceProvider) {
        return res.status(404).json({
          success: false,
          error: "ServiceProvider record not found",
        });
      }

      // Update User status
      await User.findByIdAndUpdate(providerId, {
        status: "active",
        "approvalStatus.approvedAt": new Date(),
        "approvalStatus.approvedBy": req.user?._id,
        "approvalStatus.notes": notes || "Provider approved by admin",
      });

      // Update ServiceProvider permissions
      await ServiceProvider.findByIdAndUpdate(serviceProvider._id, {
        verificationStatus: "approved",
        dashboardAccess: grantDashboardAccess === "true",
        canRegisterServices: grantServiceRegistration === "true",
        canReceiveBookings: grantBookingAccess === "true",
        canAccessPayouts: grantPayoutAccess === "true",
        "documentVerification.allDocumentsVerified": true,
        "documentVerification.aadharVerified": true,
        "documentVerification.panVerified": true,
        "documentVerification.imagesVerified": true,
        // Legacy field for backward compatibility
        isVerified: true,
      });

      // Log admin action
      await logAdminAction(
        req.user?._id,
        "APPROVE_PROVIDER",
        providerId,
        "provider",
        {
          permissions: {
            dashboardAccess: grantDashboardAccess === "true",
            canRegisterServices: grantServiceRegistration === "true",
            canReceiveBookings: grantBookingAccess === "true",
            canAccessPayouts: grantPayoutAccess === "true",
          },
          notes: notes,
        }
      );

      // Notify provider about approval
      await notifyProviderApproval(providerId, true);

      res.json({
        success: true,
        message: `✅ Provider ${user.name} has been approved successfully`,
        user: {
          id: user._id,
          name: user.name,
          status: "active",
        },
      });
    } catch (err) {
      console.error("Error approving provider:", err);
      res.status(500).json({
        success: false,
        error: "Failed to approve provider: " + err.message,
      });
    }
  },

  // 🔥 NEW: Reject Provider
  rejectProvider: async (req, res) => {
    try {
      const {providerId} = req.params;
      const {reason} = req.body;

      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({
          success: false,
          error: "Rejection reason must be at least 10 characters long",
        });
      }

      const user = await User.findById(providerId);
      if (!user || user.role !== "provider") {
        return res.status(404).json({
          success: false,
          error: "Provider not found",
        });
      }

      if (user.status !== "pending_approval") {
        return res.status(400).json({
          success: false,
          error: "Provider is not pending approval",
        });
      }

      const serviceProvider = await ServiceProvider.findOne({user: providerId});
      if (!serviceProvider) {
        return res.status(404).json({
          success: false,
          error: "ServiceProvider record not found",
        });
      }

      // Update User status
      await User.findByIdAndUpdate(providerId, {
        status: "rejected",
        "approvalStatus.rejectedAt": new Date(),
        "approvalStatus.rejectedBy": req.user?._id,
        "approvalStatus.rejectionReason": reason.trim(),
      });

      // Update ServiceProvider status
      await ServiceProvider.findByIdAndUpdate(serviceProvider._id, {
        verificationStatus: "rejected",
        dashboardAccess: false,
        canRegisterServices: false,
        canReceiveBookings: false,
        canAccessPayouts: false,
        // Legacy field
        isVerified: false,
      });

      // Log admin action
      await logAdminAction(
        req.user?._id,
        "REJECT_PROVIDER",
        providerId,
        "provider",
        {reason: reason.trim()}
      );

      // Notify provider about rejection
      await notifyProviderApproval(providerId, false, reason.trim());

      res.json({
        success: true,
        message: `❌ Provider ${user.name} has been rejected`,
        user: {
          id: user._id,
          name: user.name,
          status: "rejected",
        },
      });
    } catch (err) {
      console.error("Error rejecting provider:", err);
      res.status(500).json({
        success: false,
        error: "Failed to reject provider: " + err.message,
      });
    }
  },

  // 🔥 NEW: Manage Provider Permissions
  manageProviderPermissions: async (req, res) => {
    try {
      const {providerId} = req.params;
      const {
        dashboardAccess,
        canRegisterServices,
        canReceiveBookings,
        canAccessPayouts,
        notes,
      } = req.body;

      const user = await User.findById(providerId);
      if (!user || user.role !== "provider" || user.status !== "active") {
        return res.status(404).json({
          success: false,
          error: "Active provider not found",
        });
      }

      const serviceProvider = await ServiceProvider.findOne({user: providerId});
      if (!serviceProvider) {
        return res.status(404).json({
          success: false,
          error: "ServiceProvider record not found",
        });
      }

      // Update permissions
      const updatedPermissions = {
        dashboardAccess: dashboardAccess === "true",
        canRegisterServices: canRegisterServices === "true",
        canReceiveBookings: canReceiveBookings === "true",
        canAccessPayouts: canAccessPayouts === "true",
      };

      await ServiceProvider.findByIdAndUpdate(
        serviceProvider._id,
        updatedPermissions
      );

      // Log admin action
      await logAdminAction(
        req.user?._id,
        "UPDATE_PROVIDER_PERMISSIONS",
        providerId,
        "provider",
        {permissions: updatedPermissions, notes: notes}
      );

      // Notify provider about permission changes
      const changedPermissions = [];
      if (
        serviceProvider.dashboardAccess !== updatedPermissions.dashboardAccess
      ) {
        changedPermissions.push(
          `Dashboard Access: ${
            updatedPermissions.dashboardAccess ? "Granted" : "Revoked"
          }`
        );
      }
      if (
        serviceProvider.canRegisterServices !==
        updatedPermissions.canRegisterServices
      ) {
        changedPermissions.push(
          `Service Registration: ${
            updatedPermissions.canRegisterServices ? "Granted" : "Revoked"
          }`
        );
      }
      if (
        serviceProvider.canReceiveBookings !==
        updatedPermissions.canReceiveBookings
      ) {
        changedPermissions.push(
          `Receive Bookings: ${
            updatedPermissions.canReceiveBookings ? "Granted" : "Revoked"
          }`
        );
      }
      if (
        serviceProvider.canAccessPayouts !== updatedPermissions.canAccessPayouts
      ) {
        changedPermissions.push(
          `Payout Access: ${
            updatedPermissions.canAccessPayouts ? "Granted" : "Revoked"
          }`
        );
      }

      if (changedPermissions.length > 0) {
        await notifyProviderStatusChange(
          providerId,
          "PERMISSION_UPDATE",
          true,
          req.user?._id,
          `Changes: ${changedPermissions.join(", ")}. ${notes || ""}`
        );
      }

      res.json({
        success: true,
        message: `✅ Permissions updated for ${user.name}`,
        permissions: updatedPermissions,
      });
    } catch (err) {
      console.error("Error updating provider permissions:", err);
      res.status(500).json({
        success: false,
        error: "Failed to update permissions: " + err.message,
      });
    }
  },

  // Dashboard
  showDashboard: async (req, res) => {
    try {
      // Get statistics
      const statistics = {
        usersCount: await User.countDocuments(),
        customersCount: await User.countDocuments({role: "customer"}),
        providersCount: await User.countDocuments({role: "provider"}),
        activeProvidersCount: await User.countDocuments({
          role: "provider",
          status: "active",
        }),
        pendingProvidersCount: await User.countDocuments({
          role: "provider",
          status: "pending_approval",
        }),
        servicesCount: await Service.countDocuments(),
        bookingsCount: await Booking.countDocuments(),
        revenue: await adminController.calculateTotalRevenue(),
      };

      // 🔥 FIX: Get recent bookings separately for the dashboard
      const recentBookings = await Booking.find()
        .populate("customer")
        .populate("service")
        .populate({
          path: "provider",
          populate: {path: "user"},
        })
        .sort({createdAt: -1})
        .limit(10)
        .lean();

      // Process recent bookings to ensure all fields exist
      const processedRecentBookings = recentBookings.map((booking) => ({
        _id: booking._id,
        customer: booking.customer || {name: "Unknown Customer", phone: "N/A"},
        service: booking.service || {name: "Unknown Service"},
        provider: booking.provider || {user: {name: "Unknown Provider"}},
        status: booking.status || "unknown",
        totalAmount: booking.totalCost || booking.totalAmount || 0,
        createdAt: booking.createdAt,
        bookingDate: booking.bookingDate || booking.createdAt,
        formattedDate: adminController.formatDate(booking.createdAt),
        formattedBookingDate: adminController.formatDate(
          booking.bookingDate || booking.createdAt
        ),
      }));

      // Get recent activity (existing function)
      const recentActivity = await adminController.getRecentActivity();

      // Get system notifications
      const notifications = await adminController.getSystemNotifications();

      // Get notification stats
      const notificationStats = await getNotificationStats();

      // 🔥 FIX: Pass both recentBookings and recentActivity
      res.render("pages/admin/dashboard", {
        statistics,
        recentActivity,
        recentBookings: processedRecentBookings, // 🔥 ADD THIS
        notifications,
        notificationStats: notificationStats.success
          ? notificationStats.stats
          : null,
        currentPath: req.path,
        title: "Admin Dashboard - KnockNFix",
      });
    } catch (err) {
      console.error("Error loading admin dashboard:", err);
      req.flash("error", "Error loading admin dashboard");
      res.redirect("/");
    }
  },

  // Users Management
  showUsers: async (req, res) => {
    try {
      // Fetch all users with proper error handling
      let users = await User.find().sort({createdAt: -1});

      // Ensure all users have a status
      users = users.map((user) => {
        const u = user.toObject ? user.toObject() : {...user};
        if (!u.status) {
          u.status = "unverified";
        }
        return u;
      });

      // Categorize users
      const customers = users.filter((user) => user.role === "customer");
      const providers = users.filter((user) => user.role === "provider");
      const pendingProviders = providers.filter(
        (user) => user.status === "pending_approval"
      );
      const activeProviders = providers.filter(
        (user) => user.status === "active"
      );
      const rejectedProviders = providers.filter(
        (user) => user.status === "rejected"
      );

      res.render("pages/admin/users", {
        users,
        customers,
        providers,
        pendingProviders,
        activeProviders,
        rejectedProviders,
        currentPath: req.path,
        title: "User Management - Admin",
      });
    } catch (err) {
      console.error("Error fetching users:", err);
      req.flash("error", "Failed to load users");
      res.redirect("/admin/dashboard");
    }
  },

  // Categories Management
  showCategories: async (req, res) => {
    try {
      const categories = await Category.find().lean();
      res.render("pages/admin/categories", {
        categories,
        currentPath: req.path,
        title: "Category Management - Admin",
      });
    } catch (err) {
      console.error("Error loading categories:", err);
      req.flash("error", "Error loading categories");
      res.redirect("/admin/dashboard");
    }
  },

  showAddCategory: (req, res) => {
    res.render("pages/admin/addCategory", {
      title: "Add Category - Admin",
    });
  },

  createCategory: async (req, res) => {
    try {
      const {name, description} = req.body;
      const isActive =
        req.body.isActive === "true" || req.body.isActive === true;

      const newCategory = new Category({
        name,
        description,
        isActive,
      });

      if (req.file) {
        newCategory.img = req.file.path;
      }

      await newCategory.save();
      req.flash("success", "Category created successfully");
      res.redirect("/admin/categories");
    } catch (err) {
      console.error("Error creating category:", err);
      req.flash("error", "Failed to create category: " + err.message);
      res.redirect("/admin/addCategory");
    }
  },

  showEditCategory: async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) {
        req.flash("error", "Category not found");
        return res.redirect("/admin/categories");
      }
      res.render("pages/admin/editCategory", {
        category,
        title: "Edit Category - Admin",
      });
    } catch (err) {
      console.error("Error loading category:", err);
      req.flash("error", "Error loading category");
      res.redirect("/admin/categories");
    }
  },

  updateCategory: async (req, res) => {
    try {
      const {name, description} = req.body;
      const isActive =
        req.body.isActive === "true" || req.body.isActive === true;

      const updateData = {name, description, isActive};

      if (req.file) {
        updateData.image = {
          url: req.file.path,
          filename: req.file.filename,
        };
      }

      await Category.findByIdAndUpdate(req.params.id, updateData);
      req.flash("success", "Category updated successfully");
      res.redirect("/admin/categories");
    } catch (err) {
      console.error("Error updating category:", err);
      req.flash("error", "Error updating category");
      res.redirect(`/admin/editCategory/${req.params.id}`);
    }
  },

  deleteCategory: async (req, res) => {
    try {
      await Category.findByIdAndDelete(req.params.id);
      req.flash("success", "Category deleted successfully");
      res.redirect("/admin/categories");
    } catch (err) {
      console.error("Error deleting category:", err);
      req.flash("error", "Error deleting category");
      res.redirect("/admin/categories");
    }
  },

  toggleCategoryStatus: async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) {
        return res
          .status(404)
          .json({success: false, message: "Category not found"});
      }

      category.isActive = !category.isActive;
      await category.save();

      return res.json({
        success: true,
        isActive: category.isActive,
        message: `Category ${
          category.isActive ? "activated" : "deactivated"
        } successfully`,
      });
    } catch (err) {
      console.error("Error toggling category status:", err);
      return res
        .status(500)
        .json({success: false, message: "Error updating category status"});
    }
  },

  // Services Management
  showServices: async (req, res) => {
    try {
      const services = await Service.find().populate("category").lean();
      res.render("pages/admin/services", {
        services,
        currentPath: req.path,
        title: "Service Management - Admin",
      });
    } catch (err) {
      console.error("Error loading services:", err);
      req.flash("error", "Error loading services");
      res.redirect("/admin/dashboard");
    }
  },

  deleteService: async (req, res) => {
    try {
      await Service.findByIdAndDelete(req.params.id);
      req.flash("success", "Service deleted successfully");
      res.redirect("/admin/services");
    } catch (err) {
      console.error("Error deleting service:", err);
      req.flash("error", "Error deleting service");
      res.redirect("/admin/services");
    }
  },

  toggleServiceStatus: async (req, res) => {
    try {
      const service = await Service.findById(req.params.id);
      if (!service) {
        return res
          .status(404)
          .json({success: false, message: "Service not found"});
      }

      service.isActive = !service.isActive;
      await service.save();

      return res.json({
        success: true,
        isActive: service.isActive,
        message: `Service ${
          service.isActive ? "activated" : "deactivated"
        } successfully`,
      });
    } catch (err) {
      console.error("Error toggling service status:", err);
      return res
        .status(500)
        .json({success: false, message: "Error updating service status"});
    }
  },

  // Bookings Management
  showBookings: async (req, res) => {
    try {
      const bookings = await Booking.find()
        .populate("customer")
        .populate("service")
        .populate("provider")
        .populate({
          path: "service",
          populate: {path: "category"},
        })
        .sort({createdAt: -1});

      const safeBookings = bookings.map((booking) => {
        const plainBooking = booking.toObject();

        if (plainBooking.customer && !plainBooking.user) {
          plainBooking.user = plainBooking.customer;
        }

        if (!plainBooking.user) {
          plainBooking.user = {
            name: "Unknown User",
            phone: "No phone",
            profileImage: null,
          };
        }

        if (plainBooking.totalCost && !plainBooking.totalAmount) {
          plainBooking.totalAmount = plainBooking.totalCost;
        } else if (!plainBooking.totalAmount && !plainBooking.totalCost) {
          plainBooking.totalAmount = 0;
        }

        if (!plainBooking.paymentStatus) {
          plainBooking.paymentStatus = "Unknown";
        }

        return plainBooking;
      });

      const pendingBookings = safeBookings.filter(
        (booking) => booking.status === "pending"
      );
      const confirmedBookings = safeBookings.filter(
        (booking) => booking.status === "confirmed"
      );
      const completedBookings = safeBookings.filter(
        (booking) => booking.status === "completed"
      );
      const cancelledBookings = safeBookings.filter(
        (booking) => booking.status === "cancelled"
      );

      res.render("pages/admin/bookings", {
        bookings: safeBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        cancelledBookings,
        currentPath: req.path,
        title: "Booking Management - Admin",
      });
    } catch (err) {
      console.error("Error fetching bookings:", err);
      req.flash("error", "Failed to load bookings");
      res.redirect("/admin/dashboard");
    }
  },

  // Payments Management
  showPayments: async (req, res) => {
    try {
      const payments = await Payment.find()
        .populate("booking")
        .populate({
          path: "booking",
          populate: [{path: "service"}, {path: "customer"}, {path: "provider"}],
        })
        .sort({createdAt: -1});

      const processedPayments = payments.map((payment) => {
        const plainPayment = payment.toObject();

        if (!plainPayment.booking) {
          plainPayment.booking = {
            service: {name: "Unknown Service"},
            customer: {name: "Unknown Customer"},
            provider: {user: {name: "Unknown Provider"}},
            totalCost: 0,
          };
        }

        return plainPayment;
      });

      res.render("pages/admin/payments", {
        payments: processedPayments,
        currentPath: req.path,
        title: "Payment Management - Admin",
      });
    } catch (err) {
      console.error("Error fetching payments:", err);
      req.flash("error", "Failed to load payments");
      res.redirect("/admin/dashboard");
    }
  },

  // Provider Payouts Management
  showProviderPayouts: async (req, res) => {
    try {
      const providers = await ServiceProvider.find({
        $or: [
          {pendingPayouts: {$gt: 0}},
          {
            "bankDetails.accountNumber": {$exists: true, $ne: null, $ne: ""},
            "bankDetails.verified": {$ne: true},
          },
        ],
      }).populate("user");

      const bookings = await Booking.find({
        "providerPayout.status": {$exists: true},
      })
        .sort({"providerPayout.processedAt": -1})
        .limit(20)
        .populate({
          path: "provider",
          populate: {path: "user"},
        })
        .populate("service")
        .populate("customer");

      const payoutData = {
        pendingAmount: providers.reduce(
          (sum, provider) => sum + (provider.pendingPayouts || 0),
          0
        ),
        processedAmount: bookings
          .filter(
            (b) => b.providerPayout && b.providerPayout.status === "processed"
          )
          .reduce((sum, b) => sum + (b.providerPayout.amount || 0), 0),
        providers: providers.map((provider) => ({
          id: provider._id,
          name: provider.user?.name || "Unknown",
          email: provider.user?.email || provider.user?.username || "Unknown",
          phone: provider.user?.phone || "Not provided",
          pendingAmount: provider.pendingPayouts || 0,
          hasBankDetails: !!(
            provider.bankDetails && provider.bankDetails.accountNumber
          ),
          bankVerified: !!(
            provider.bankDetails && provider.bankDetails.verified
          ),
          accountHolderName: provider.bankDetails?.accountHolderName || "",
          bankName: provider.bankDetails?.bankName || "",
          ifscCode: provider.bankDetails?.ifscCode || "",
          accountNumber: provider.bankDetails?.accountNumber
            ? "•••••" + provider.bankDetails.accountNumber.slice(-4)
            : "",
        })),
        recentPayouts: bookings
          .filter((b) => b.providerPayout && b.providerPayout.status)
          .map((booking) => ({
            id: booking._id,
            providerName: booking.provider?.user?.name || "Unknown",
            serviceName: booking.service?.name || "Unknown",
            customerName: booking.customer?.name || "Unknown",
            amount: booking.providerPayout?.amount || 0,
            status: booking.providerPayout?.status || "unknown",
            date: booking.providerPayout?.processingAt || booking.createdAt,
            reference: booking.providerPayout?.transactionId || "None",
          })),
      };

      res.render("pages/admin/provider-payouts", {
        payoutData,
        currentPath: req.path,
        title: "Provider Payouts - Admin",
      });
    } catch (err) {
      console.error("Error fetching payout data:", err);
      req.flash("error", "Failed to load payout data");
      res.redirect("/admin/dashboard");
    }
  },

  // Process Provider Payout
  processPayout: async (req, res) => {
    try {
      // Implementation for processing payouts
      res.json({
        success: true,
        message: "Payout processed successfully",
      });
    } catch (err) {
      console.error("Error processing payout:", err);
      res.status(500).json({
        success: false,
        message: "Failed to process payout: " + err.message,
      });
    }
  },

  // Verify Provider Bank Details
  verifyBankDetails: async (req, res) => {
    try {
      const providerId = req.params.providerId;

      const provider = await ServiceProvider.findById(providerId).populate(
        "user"
      );
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: "Provider not found",
        });
      }

      if (!provider.bankDetails || !provider.bankDetails.accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Provider has no bank details to verify",
        });
      }

      provider.bankDetails.verified = true;
      provider.bankDetails.verifiedAt = new Date();

      if (req.user && req.user._id) {
        provider.bankDetails.verifiedBy = req.user._id;
      }

      await provider.save();

      res.json({
        success: true,
        message: "Bank details verified successfully",
        provider: {
          id: provider._id,
          name: provider.user.name,
        },
      });
    } catch (err) {
      console.error("Error verifying bank details:", err);
      res.status(500).json({
        success: false,
        message: "Failed to verify bank details: " + err.message,
      });
    }
  },

  // Reports
  showReports: async (req, res) => {
    try {
      const revenueData = await adminController.getRevenueData();
      const serviceData = await adminController.getServiceData();
      const userGrowthData = await adminController.getUserGrowthData();

      res.render("pages/admin/reports", {
        revenueData,
        serviceData,
        userGrowthData,
        currentPath: req.path,
        title: "Reports - Admin",
      });
    } catch (err) {
      console.error("Error loading reports:", err);
      req.flash("error", "Error loading reports");
      res.redirect("/admin/dashboard");
    }
  },

  // Feedback Management
  showFeedback: async (req, res) => {
    try {
      const feedback = await adminController.getFeedbackData();
      res.render("pages/admin/feedback", {
        feedback,
        currentPath: req.path,
        title: "Feedback Management - Admin",
      });
    } catch (err) {
      console.error("Error loading feedback:", err);
      req.flash("error", "Error loading feedback");
      res.redirect("/admin/dashboard");
    }
  },

  // Settings
  showSettings: async (req, res) => {
    try {
      const settings = await adminController.getSystemSettings();
      res.render("pages/admin/settings", {
        settings,
        currentPath: req.path,
        title: "System Settings - Admin",
      });
    } catch (err) {
      console.error("Error loading settings:", err);
      req.flash("error", "Error loading settings");
      res.redirect("/admin/dashboard");
    }
  },

  updateSettings: async (req, res) => {
    try {
      const {
        siteName,
        siteEmail,
        platformCommission,
        bookingFee,
        maintenanceMode,
        emailNotifications,
        autoApproveProviders,
        currency,
        timeZone,
      } = req.body;

      const commissionValue = parseInt(platformCommission);
      if (
        isNaN(commissionValue) ||
        commissionValue < 1 ||
        commissionValue > 50
      ) {
        req.flash("error", "Platform commission must be between 1% and 50%");
        return res.redirect("/admin/settings");
      }

      // Update settings in database (implement this)
      // await adminController.updateSystemSettings({ ... });

      req.flash("success", "Settings updated successfully");
      res.redirect("/admin/settings");
    } catch (err) {
      console.error("Error updating settings:", err);
      req.flash("error", "Error updating settings");
      res.redirect("/admin/settings");
    }
  },

  // Helper functions
  calculateTotalRevenue: async () => {
    try {
      const payments = await Payment.find({status: "completed"});
      return payments.reduce((total, payment) => total + payment.amount, 0);
    } catch (err) {
      console.error("Error calculating revenue:", err);
      return 0;
    }
  },

  getRecentActivity: async () => {
    try {
      const recentBookings = await Booking.find()
        .populate("customer")
        .populate("service")
        .populate({
          path: "provider",
          populate: {path: "user"},
        })
        .sort({createdAt: -1})
        .limit(5);

      const recentPayments = await Payment.find()
        .populate({
          path: "booking",
          populate: [{path: "customer"}, {path: "service"}],
        })
        .sort({createdAt: -1})
        .limit(5);

      const recentUsers = await User.find().sort({createdAt: -1}).limit(5);

      // 🔥 FIX: Return structured data with type information
      const activities = [
        ...recentBookings.map((booking) => ({
          type: "booking",
          action: `New Booking: ${booking.service?.name || "Unknown Service"}`,
          user: booking.customer?.name || "Unknown",
          dateTime: booking.createdAt,
          status: booking.status,
          // Additional booking-specific data
          bookingId: booking._id,
          serviceName: booking.service?.name,
          providerName: booking.provider?.user?.name,
          amount: booking.totalCost || booking.totalAmount || 0,
        })),
        ...recentPayments.map((payment) => ({
          type: "payment",
          action: `Payment: ₹${payment.amount}`,
          user: payment.booking?.customer?.name || "Unknown",
          dateTime: payment.createdAt,
          status: payment.status,
          // Additional payment-specific data
          amount: payment.amount,
          paymentId: payment._id,
        })),
        ...recentUsers.map((user) => ({
          type: "user",
          action: "New User Registration",
          user: user.name || user.username,
          dateTime: user.createdAt,
          status: user.status || "registered",
          // Additional user-specific data
          userId: user._id,
          role: user.role,
        })),
      ]
        .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
        .slice(0, 10);

      return {
        all: activities.map((activity) => ({
          ...activity,
          dateTime: adminController.formatDate(activity.dateTime),
        })),
        // 🔥 ADD: Separate arrays for different types
        bookings: activities.filter((a) => a.type === "booking").slice(0, 5),
        payments: activities.filter((a) => a.type === "payment").slice(0, 5),
        users: activities.filter((a) => a.type === "user").slice(0, 5),
      };
    } catch (err) {
      console.error("Error getting recent activity:", err);
      return {
        all: [],
        bookings: [],
        payments: [],
        users: [],
      };
    }
  },

  formatDate: (date) => {
    if (!date) return "Unknown date";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid date";
    return d.toLocaleString("en-IN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  },

  getSystemNotifications: async () => {
    try {
      const notifications = [];

      const providersNeedingBankDetails = await ServiceProvider.find({
        pendingPayouts: {$gt: 0},
        bankDetails: {$exists: false},
      }).countDocuments();

      if (providersNeedingBankDetails > 0) {
        notifications.push({
          type: "warning",
          message: `${providersNeedingBankDetails} providers have pending payouts but no bank details`,
          time: "Today",
        });
      }

      const totalPendingPayouts = await ServiceProvider.aggregate([
        {
          $group: {
            _id: null,
            total: {$sum: "$pendingPayouts"},
          },
        },
      ]);

      if (totalPendingPayouts.length && totalPendingPayouts[0].total > 0) {
        notifications.push({
          type: "info",
          message: `₹${totalPendingPayouts[0].total} in pending provider payouts`,
          time: "Today",
        });
      }

      if (notifications.length === 0) {
        notifications.push({
          type: "success",
          message: "All systems running normally",
          time: "Just now",
        });
      }

      return notifications;
    } catch (err) {
      console.error("Error getting notifications:", err);
      return [];
    }
  },

  getRevenueData: async () => {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const monthlyRevenue = await Payment.aggregate([
        {
          $match: {
            status: "completed",
            createdAt: {$gte: oneYearAgo},
          },
        },
        {
          $group: {
            _id: {$month: "$createdAt"},
            total: {$sum: "$amount"},
          },
        },
        {
          $sort: {_id: 1},
        },
      ]);

      const monthlyData = Array(12).fill(0);
      monthlyRevenue.forEach((item) => {
        monthlyData[item._id - 1] = item.total;
      });

      return {monthly: monthlyData};
    } catch (err) {
      console.error("Error getting revenue data:", err);
      return {monthly: Array(12).fill(0)};
    }
  },

  getServiceData: async () => {
    try {
      const popularServices = await Booking.aggregate([
        {
          $lookup: {
            from: "services",
            localField: "service",
            foreignField: "_id",
            as: "serviceInfo",
          },
        },
        {
          $unwind: "$serviceInfo",
        },
        {
          $group: {
            _id: "$serviceInfo.name",
            count: {$sum: 1},
          },
        },
        {
          $sort: {count: -1},
        },
        {
          $limit: 5,
        },
      ]);

      return {
        popularServices: popularServices.map((s) => ({
          name: s._id,
          count: s.count,
        })),
      };
    } catch (err) {
      console.error("Error getting service data:", err);
      return {popularServices: []};
    }
  },

  getUserGrowthData: async () => {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const monthlyNewUsers = await User.aggregate([
        {
          $match: {
            createdAt: {$gte: oneYearAgo},
          },
        },
        {
          $group: {
            _id: {
              month: {$month: "$createdAt"},
              role: "$role",
            },
            count: {$sum: 1},
          },
        },
        {
          $sort: {"_id.month": 1},
        },
      ]);

      const customers = Array(12).fill(0);
      const providers = Array(12).fill(0);

      monthlyNewUsers.forEach((item) => {
        const monthIndex = item._id.month - 1;
        if (item._id.role === "customer") {
          customers[monthIndex] += item.count;
        } else if (item._id.role === "provider") {
          providers[monthIndex] += item.count;
        }
      });

      return {customers, providers};
    } catch (err) {
      console.error("Error getting user growth data:", err);
      return {
        customers: Array(12).fill(0),
        providers: Array(12).fill(0),
      };
    }
  },

  getFeedbackData: async () => {
    try {
      const bookingsWithFeedback = await Booking.find({
        "feedback.rating": {$exists: true},
      })
        .populate("customer")
        .populate("service")
        .populate({
          path: "provider",
          populate: {path: "user"},
        })
        .sort({"feedback.createdAt": -1})
        .limit(10);

      return bookingsWithFeedback.map((booking) => ({
        id: booking._id,
        customer: booking.customer?.name || "Unknown Customer",
        service: booking.service?.name || "Unknown Service",
        provider: booking.provider?.user?.name || "Unknown Provider",
        rating: booking.feedback?.rating || 0,
        comment: booking.feedback?.comment || "No comment provided",
        date: adminController.formatDate(
          booking.feedback?.createdAt || booking.updatedAt
        ),
      }));
    } catch (err) {
      console.error("Error getting feedback data:", err);
      return [];
    }
  },

  getSystemSettings: async () => {
    try {
      return {
        siteName: "KnockNFix",
        siteEmail: "admin@knocknfix.com",
        bookingFee: 5,
        platformCommission: 15,
        maintenanceMode: false,
        emailNotifications: true,
        autoApproveProviders: false,
        currency: "INR",
        timeZone: "Asia/Kolkata",
      };
    } catch (err) {
      console.error("Error getting system settings:", err);
      return {};
    }
  },
  getProviderDetailsAPI: async (req, res) => {
    try {
      const {providerId} = req.params;

      // Fetch provider with all related data
      const user = await User.findById(providerId).lean();
      if (!user || user.role !== "provider") {
        return res.status(404).json({
          success: false,
          error: "Provider not found",
        });
      }

      const serviceProvider = await ServiceProvider.findOne({user: providerId})
        .populate("user")
        .lean();

      // Get services if any
      const services = await Service.find({provider: serviceProvider?._id})
        .populate("category")
        .lean();

      // Construct provider data
      const provider = {
        user: user,
        serviceProvider: serviceProvider,
        businessAddress: serviceProvider?.businessAddress,
        registrationDate: user.createdAt,
        services: services || [],
      };

      res.json({
        success: true,
        provider,
      });
    } catch (err) {
      console.error("Error loading provider details:", err);
      res.status(500).json({
        success: false,
        error: "Error loading provider details",
      });
    }
  },
};

module.exports = adminController;
