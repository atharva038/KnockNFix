const User = require("../../models/User");
const Service = require("../../models/Service");
const Booking = require("../../models/Booking");
const { getNotificationStats } = require("../../utils/adminNotifications");
const {
  calculateTotalRevenue,
  getRecentActivity,
  getSystemNotifications,
  formatDate,
} = require("./helpers");

const dashboardAdminController = {
  showDashboard: async (req, res) => {
    try {
      const statistics = {
        usersCount: await User.countDocuments(),
        customersCount: await User.countDocuments({ role: "customer" }),
        providersCount: await User.countDocuments({ role: "provider" }),
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
        revenue: await calculateTotalRevenue(),
      };

      const recentBookings = await Booking.find()
        .populate("customer")
        .populate("service")
        .populate({
          path: "provider",
          populate: { path: "user" },
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      const processedRecentBookings = recentBookings.map((booking) => ({
        _id: booking._id,
        customer: booking.customer || { name: "Unknown Customer", phone: "N/A" },
        service: booking.service || { name: "Unknown Service" },
        provider: booking.provider || { user: { name: "Unknown Provider" } },
        status: booking.status || "unknown",
        totalAmount: booking.totalCost || booking.totalAmount || 0,
        createdAt: booking.createdAt,
        bookingDate: booking.bookingDate || booking.createdAt,
        formattedDate: formatDate(booking.createdAt),
        formattedBookingDate: formatDate(booking.bookingDate || booking.createdAt),
      }));

      const recentActivity = await getRecentActivity();
      const notifications = await getSystemNotifications();
      const notificationStats = await getNotificationStats();

      return res.render("pages/admin/dashboard", {
        statistics,
        totalBookings: statistics.bookingsCount,
        totalUsers: statistics.usersCount,
        totalProviders: statistics.providersCount,
        totalServices: statistics.servicesCount,
        recentActivity,
        recentBookings: processedRecentBookings,
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
      return res.redirect("/");
    }
  },
};

module.exports = dashboardAdminController;
