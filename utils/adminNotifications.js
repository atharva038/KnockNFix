const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");

// Notify admin about new provider registration
const notifyAdminNewProvider = async (providerId) => {
  try {
    console.log(`📢 NEW PROVIDER REGISTRATION ALERT!`);
    console.log(`Provider ID: ${providerId}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`Action Required: Admin approval needed`);

    const provider = await User.findById(providerId).populate({
      path: "addresses",
    });

    if (!provider) {
      console.error("❌ Provider not found for notification");
      return {success: false, error: "Provider not found"};
    }

    // Get ServiceProvider details
    const serviceProvider = await ServiceProvider.findOne({user: providerId});
    if (!serviceProvider) {
      console.error("❌ ServiceProvider record not found");
      return {success: false, error: "ServiceProvider record not found"};
    }

    // Find all admin users
    const admins = await User.find({role: "admin", status: "active"});
    console.log(`📧 Notifying ${admins.length} admin(s)`);

    if (admins.length === 0) {
      console.warn("⚠️ No active admin users found to notify");
      return {success: false, error: "No admin users found"};
    }

    // Log detailed provider info for admin
    console.log(`
    🆕 NEW PROVIDER DETAILS:
    ================================
    Name: ${provider.name}
    Phone: ${provider.phone}
    Email: ${provider.email || "Not provided"}
    Registration Time: ${provider.createdAt?.toLocaleString()}
    Business Address: ${provider.addresses?.[0]?.street || "N/A"}, ${
      provider.addresses?.[0]?.city || "N/A"
    }
    State: ${provider.addresses?.[0]?.state || "N/A"}
    Pincode: ${provider.addresses?.[0]?.pincode || "N/A"}
    Aadhar: ${serviceProvider.aadharCard}
    PAN: ${serviceProvider.panCard}
    Status: ${provider.status}
    Verification Status: ${serviceProvider.verificationStatus}
    Provider ID: ${providerId}
    ServiceProvider ID: ${serviceProvider._id}
    ================================
    `);

    // Log admin notification details
    admins.forEach((admin, index) => {
      console.log(`
      👨‍💼 ADMIN ${index + 1} NOTIFICATION:
      Admin Name: ${admin.name}
      Admin Email: ${admin.email || "No email"}
      Admin Phone: ${admin.phone}
      Admin ID: ${admin._id}
      `);
    });

    // Store notification in database (optional)
    const notificationData = {
      type: "new_provider_registration",
      providerId: providerId,
      providerName: provider.name,
      providerPhone: provider.phone,
      timestamp: new Date(),
      adminsNotified: admins.map((admin) => ({
        adminId: admin._id,
        adminName: admin.name,
        adminEmail: admin.email,
      })),
    };

    console.log(`
    📋 NOTIFICATION SUMMARY:
    ================================
    Notification Type: New Provider Registration
    Provider: ${provider.name} (${provider.phone})
    Admins Notified: ${admins.length}
    Status: Successfully logged
    Next Action: Admin should review and approve/reject
    Admin Panel URL: /admin/pending-providers
    ================================
    `);

    // TODO: Implement actual notifications
    // 1. Send Email notifications
    // await sendEmailToAdmins(admins, provider, serviceProvider);

    // 2. Send SMS notifications
    // await sendSMSToAdmins(admins, provider);

    // 3. Send Push notifications (if implemented)
    // await sendPushNotifications(admins, provider);

    // 4. Store in notification table (if implemented)
    // await storeNotificationInDB(notificationData);

    return {
      success: true,
      adminCount: admins.length,
      notificationData,
    };
  } catch (error) {
    console.error("❌ Error notifying admin:", error);
    return {success: false, error: error.message};
  }
};

// Notify provider about approval/rejection
const notifyProviderApproval = async (providerId, approved, reason = null) => {
  try {
    const provider = await User.findById(providerId);
    if (!provider) {
      console.error("❌ Provider not found for approval notification");
      return {success: false, error: "Provider not found"};
    }

    const serviceProvider = await ServiceProvider.findOne({user: providerId});
    const status = approved ? "APPROVED ✅" : "REJECTED ❌";

    console.log(`
    📱 PROVIDER ${status}
    ================================
    Name: ${provider.name}
    Phone: ${provider.phone}
    Email: ${provider.email || "Not provided"}
    Status: ${approved ? "Active" : "Rejected"}
    ${reason ? `Reason: ${reason}` : ""}
    Verification Status: ${serviceProvider?.verificationStatus || "Unknown"}
    Dashboard Access: ${serviceProvider?.dashboardAccess ? "Granted" : "Denied"}
    Service Registration: ${
      serviceProvider?.canRegisterServices ? "Allowed" : "Denied"
    }
    Booking Access: ${
      serviceProvider?.canReceiveBookings ? "Allowed" : "Denied"
    }
    Time: ${new Date().toLocaleString()}
    ================================
    `);

    // Log next steps for provider
    if (approved) {
      console.log(`
      🎉 PROVIDER APPROVED - NEXT STEPS:
      ================================
      1. Provider can now log in
      2. Dashboard access: ${
        serviceProvider?.dashboardAccess ? "✅ Granted" : "❌ Pending"
      }
      3. Service registration: ${
        serviceProvider?.canRegisterServices ? "✅ Allowed" : "❌ Pending"
      }
      4. Receive bookings: ${
        serviceProvider?.canReceiveBookings ? "✅ Allowed" : "❌ Pending"
      }
      5. Access payouts: ${
        serviceProvider?.canAccessPayouts ? "✅ Allowed" : "❌ Pending"
      }
      
      Provider should receive notification and can access:
      - Login URL: /login
      - Dashboard URL: /provider/dashboard
      ================================
      `);
    } else {
      console.log(`
      ❌ PROVIDER REJECTED - DETAILS:
      ================================
      Rejection Reason: ${reason || "No reason provided"}
      Provider Status: Rejected
      Next Steps: Provider should contact support or re-register
      Support Actions: Review rejection reason and provide guidance
      ================================
      `);
    }

    // TODO: Send actual notifications to provider
    // 1. Send SMS notification
    // await sendProviderSMS(provider, approved, reason);

    // 2. Send Email notification
    // await sendProviderEmail(provider, approved, reason, serviceProvider);

    // 3. Send Push notification (if implemented)
    // await sendProviderPushNotification(provider, approved, reason);

    return {
      success: true,
      provider: {
        id: provider._id,
        name: provider.name,
        phone: provider.phone,
        status: provider.status,
      },
      approved,
      reason,
    };
  } catch (error) {
    console.error("❌ Error notifying provider:", error);
    return {success: false, error: error.message};
  }
};

// Notify provider about status changes (dashboard access, service permissions, etc.)
const notifyProviderStatusChange = async (
  providerId,
  changeType,
  granted,
  adminId,
  notes = null
) => {
  try {
    const provider = await User.findById(providerId);
    const admin = await User.findById(adminId);
    const serviceProvider = await ServiceProvider.findOne({user: providerId});

    if (!provider) {
      return {success: false, error: "Provider not found"};
    }

    const statusText = granted ? "GRANTED ✅" : "REVOKED ❌";

    console.log(`
    🔄 PROVIDER PERMISSION ${statusText}
    ================================
    Provider: ${provider.name} (${provider.phone})
    Permission Type: ${changeType}
    Action: ${granted ? "Granted" : "Revoked"}
    Admin: ${admin?.name || "Unknown"} (${admin?._id})
    Time: ${new Date().toLocaleString()}
    ${notes ? `Notes: ${notes}` : ""}
    
    Current Permissions:
    - Dashboard Access: ${serviceProvider?.dashboardAccess ? "✅" : "❌"}
    - Service Registration: ${
      serviceProvider?.canRegisterServices ? "✅" : "❌"
    }
    - Receive Bookings: ${serviceProvider?.canReceiveBookings ? "✅" : "❌"}
    - Access Payouts: ${serviceProvider?.canAccessPayouts ? "✅" : "❌"}
    ================================
    `);

    // TODO: Send notification to provider
    // await sendProviderPermissionNotification(provider, changeType, granted, notes);

    return {success: true};
  } catch (error) {
    console.error("❌ Error notifying provider status change:", error);
    return {success: false, error: error.message};
  }
};

// Log admin action for audit trail
const logAdminAction = async (
  adminId,
  action,
  targetId,
  targetType,
  details = {}
) => {
  try {
    const admin = await User.findById(adminId);

    console.log(`
    📝 ADMIN ACTION LOG
    ================================
    Admin: ${admin?.name || "Unknown"} (${adminId})
    Action: ${action}
    Target Type: ${targetType}
    Target ID: ${targetId}
    Timestamp: ${new Date().toLocaleString()}
    Details: ${JSON.stringify(details, null, 2)}
    ================================
    `);

    // TODO: Store in audit log database
    // await storeAdminActionLog({
    //   adminId,
    //   adminName: admin?.name,
    //   action,
    //   targetId,
    //   targetType,
    //   details,
    //   timestamp: new Date()
    // });

    return {success: true};
  } catch (error) {
    console.error("❌ Error logging admin action:", error);
    return {success: false, error: error.message};
  }
};

// Get notification statistics
const getNotificationStats = async () => {
  try {
    const pendingProviders = await User.countDocuments({
      role: "provider",
      status: "pending_approval",
    });

    const todayRegistrations = await User.countDocuments({
      role: "provider",
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    });

    const approvedToday = await User.countDocuments({
      role: "provider",
      status: "active",
      "approvalStatus.approvedAt": {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    });

    const stats = {
      pendingProviders,
      todayRegistrations,
      approvedToday,
      timestamp: new Date(),
    };

    console.log(`
    📊 NOTIFICATION STATISTICS
    ================================
    Pending Providers: ${pendingProviders}
    Today's Registrations: ${todayRegistrations}
    Approved Today: ${approvedToday}
    Last Updated: ${stats.timestamp.toLocaleString()}
    ================================
    `);

    return {success: true, stats};
  } catch (error) {
    console.error("❌ Error getting notification stats:", error);
    return {success: false, error: error.message};
  }
};

// Helper function to format provider info for notifications
const formatProviderInfo = (provider, serviceProvider) => {
  return {
    id: provider._id,
    name: provider.name,
    phone: provider.phone,
    email: provider.email || "Not provided",
    registrationDate: provider.createdAt,
    businessAddress: provider.addresses?.[0]
      ? {
          street: provider.addresses[0].street,
          city: provider.addresses[0].city,
          state: provider.addresses[0].state,
          pincode: provider.addresses[0].pincode,
        }
      : null,
    documents: {
      aadhar: serviceProvider?.aadharCard,
      pan: serviceProvider?.panCard,
      aadharImage: serviceProvider?.aadharImage,
      panImage: serviceProvider?.panImage,
    },
    status: provider.status,
    verificationStatus: serviceProvider?.verificationStatus,
  };
};

module.exports = {
  notifyAdminNewProvider,
  notifyProviderApproval,
  notifyProviderStatusChange,
  logAdminAction,
  getNotificationStats,
  formatProviderInfo,
};
