const User = require("../../models/User");
const ServiceProvider = require("../../models/ServiceProvider");
const Service = require("../../models/Service");
const {
  notifyProviderApproval,
  notifyProviderStatusChange,
  logAdminAction,
} = require("../../utils/adminNotifications");

const approvalController = {
  getPendingProviders: async (req, res) => {
    try {
      const pendingProviders = await User.find({
        role: "provider",
        status: "pending_approval",
      })
        .populate({
          path: "addresses",
        })
        .sort({ createdAt: -1 });

      const providersWithDetails = await Promise.all(
        pendingProviders.map(async (user) => {
          const serviceProvider = await ServiceProvider.findOne({
            user: user._id,
          });
          return {
            user,
            serviceProvider,
            registrationDate: user.createdAt,
            businessAddress: user.addresses?.[0] || null,
          };
        })
      );

      return res.render("pages/admin/pending-providers", {
        providers: providersWithDetails,
        title: "Pending Provider Approvals - Admin",
        currentPath: req.path,
      });
    } catch (err) {
      console.error("Error fetching pending providers:", err);
      req.flash("error", "Failed to load pending providers");
      return res.redirect("/admin/dashboard");
    }
  },

  approveProvider: async (req, res) => {
    try {
      const { providerId } = req.params;
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

      const serviceProvider = await ServiceProvider.findOne({ user: providerId });
      if (!serviceProvider) {
        return res.status(404).json({
          success: false,
          error: "ServiceProvider record not found",
        });
      }

      const permissions = {
        dashboardAccess:
          grantDashboardAccess !== "false" && grantDashboardAccess !== false,
        canRegisterServices:
          grantServiceRegistration !== "false" &&
          grantServiceRegistration !== false,
        canReceiveBookings:
          grantBookingAccess !== "false" && grantBookingAccess !== false,
        canAccessPayouts:
          grantPayoutAccess !== "false" && grantPayoutAccess !== false,
      };

      await User.findByIdAndUpdate(providerId, {
        status: "active",
        "approvalStatus.approvedAt": new Date(),
        "approvalStatus.approvedBy": req.user?._id,
        "approvalStatus.notes": notes || "Provider approved by admin",
      });

      await ServiceProvider.findByIdAndUpdate(serviceProvider._id, {
        verificationStatus: "approved",
        isVerified: true,
        isActive: true,
        dashboardAccess: permissions.dashboardAccess,
        canRegisterServices: permissions.canRegisterServices,
        canReceiveBookings: permissions.canReceiveBookings,
        canAccessPayouts: permissions.canAccessPayouts,
        "documentVerification.allDocumentsVerified": true,
        "documentVerification.aadharVerified": true,
        "documentVerification.panVerified": true,
        "documentVerification.imagesVerified": true,
        "documentVerification.verificationDate": new Date(),
        "adminVerification.verifiedBy": req.user?._id,
        "adminVerification.verifiedAt": new Date(),
        "adminVerification.verificationNotes":
          notes || "Provider approved by admin",
        "adminVerification.documentsApproved": true,
        "approvalWorkflow.approvedAt": new Date(),
        "approvalWorkflow.lastStatusChange": new Date(),
      });

      await ServiceProvider.findByIdAndUpdate(serviceProvider._id, {
        $push: {
          "approvalWorkflow.statusHistory": {
            status: "approved",
            changedBy: req.user?._id,
            changedAt: new Date(),
            notes: notes || "Provider approved by admin",
          },
        },
      });

      try {
        if (typeof logAdminAction === "function") {
          await logAdminAction(
            req.user?._id,
            "APPROVE_PROVIDER",
            providerId,
            "provider",
            {
              permissions,
              notes,
            }
          );
        }
      } catch (logError) {
        console.warn("Failed to log admin action:", logError.message);
      }

      try {
        if (typeof notifyProviderApproval === "function") {
          await notifyProviderApproval(providerId, true);
        }
      } catch (notifyError) {
        console.warn("Failed to notify provider:", notifyError.message);
      }

      return res.json({
        success: true,
        message: `Provider ${user.name} has been approved successfully with permissions: Dashboard=${permissions.dashboardAccess}, Services=${permissions.canRegisterServices}, Bookings=${permissions.canReceiveBookings}, Payouts=${permissions.canAccessPayouts}`,
        user: {
          id: user._id,
          name: user.name,
          status: "active",
        },
        permissions,
      });
    } catch (err) {
      console.error("Error approving provider:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to approve provider: " + err.message,
      });
    }
  },

  rejectProvider: async (req, res) => {
    try {
      const { providerId } = req.params;
      const { reason } = req.body;

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

      const serviceProvider = await ServiceProvider.findOne({ user: providerId });
      if (!serviceProvider) {
        return res.status(404).json({
          success: false,
          error: "ServiceProvider record not found",
        });
      }

      await User.findByIdAndUpdate(providerId, {
        status: "rejected",
        "approvalStatus.rejectedAt": new Date(),
        "approvalStatus.rejectedBy": req.user?._id,
        "approvalStatus.rejectionReason": reason.trim(),
      });

      await ServiceProvider.findByIdAndUpdate(serviceProvider._id, {
        verificationStatus: "rejected",
        dashboardAccess: false,
        canRegisterServices: false,
        canReceiveBookings: false,
        canAccessPayouts: false,
        isVerified: false,
      });

      try {
        if (typeof logAdminAction === "function") {
          await logAdminAction(
            req.user?._id,
            "REJECT_PROVIDER",
            providerId,
            "provider",
            { reason: reason.trim() }
          );
        }
      } catch (logError) {
        console.warn("Failed to log admin action:", logError.message);
      }

      try {
        if (typeof notifyProviderApproval === "function") {
          await notifyProviderApproval(providerId, false, reason.trim());
        }
      } catch (notifyError) {
        console.warn("Failed to notify provider:", notifyError.message);
      }

      return res.json({
        success: true,
        message: `Provider ${user.name} has been rejected`,
        user: {
          id: user._id,
          name: user.name,
          status: "rejected",
        },
      });
    } catch (err) {
      console.error("Error rejecting provider:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to reject provider: " + err.message,
      });
    }
  },

  manageProviderPermissions: async (req, res) => {
    try {
      const { providerId } = req.params;
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

      const serviceProvider = await ServiceProvider.findOne({ user: providerId });
      if (!serviceProvider) {
        return res.status(404).json({
          success: false,
          error: "ServiceProvider record not found",
        });
      }

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

      await logAdminAction(
        req.user?._id,
        "UPDATE_PROVIDER_PERMISSIONS",
        providerId,
        "provider",
        { permissions: updatedPermissions, notes }
      );

      const changedPermissions = [];
      if (serviceProvider.dashboardAccess !== updatedPermissions.dashboardAccess) {
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

      return res.json({
        success: true,
        message: `Permissions updated for ${user.name}`,
        permissions: updatedPermissions,
      });
    } catch (err) {
      console.error("Error updating provider permissions:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to update permissions: " + err.message,
      });
    }
  },

  getProviderDetailsAPI: async (req, res) => {
    try {
      const { providerId } = req.params;

      const user = await User.findById(providerId).lean();
      if (!user || user.role !== "provider") {
        return res.status(404).json({
          success: false,
          error: "Provider not found",
        });
      }

      const serviceProvider = await ServiceProvider.findOne({ user: providerId })
        .populate("user")
        .lean();

      const services = await Service.find({ provider: serviceProvider?._id })
        .populate("category")
        .lean();

      const provider = {
        user,
        serviceProvider,
        businessAddress: serviceProvider?.businessAddress,
        registrationDate: user.createdAt,
        services: services || [],
      };

      return res.json({
        success: true,
        provider,
      });
    } catch (err) {
      console.error("Error loading provider details:", err);
      return res.status(500).json({
        success: false,
        error: "Error loading provider details",
      });
    }
  },
};

module.exports = approvalController;
