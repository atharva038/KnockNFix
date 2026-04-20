const User = require("../../models/User");
const ServiceProvider = require("../../models/ServiceProvider");
const Service = require("../../models/Service");
const Booking = require("../../models/Booking");
const Payment = require("../../models/Payment");

const formatDate = (date) => {
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
};

const calculateTotalRevenue = async () => {
  try {
    const payments = await Payment.find({ status: "completed" });
    return payments.reduce((total, payment) => total + payment.amount, 0);
  } catch (err) {
    console.error("Error calculating revenue:", err);
    return 0;
  }
};

const getRecentActivity = async () => {
  try {
    const recentBookings = await Booking.find()
      .populate("customer")
      .populate("service")
      .populate({
        path: "provider",
        populate: { path: "user" },
      })
      .sort({ createdAt: -1 })
      .limit(5);

    const recentPayments = await Payment.find()
      .populate({
        path: "booking",
        populate: [{ path: "customer" }, { path: "service" }],
      })
      .sort({ createdAt: -1 })
      .limit(5);

    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);

    const activities = [
      ...recentBookings.map((booking) => ({
        type: "booking",
        action: `New Booking: ${booking.service?.name || "Unknown Service"}`,
        user: booking.customer?.name || "Unknown",
        dateTime: booking.createdAt,
        status: booking.status,
        bookingId: booking._id,
        serviceName: booking.service?.name,
        providerName: booking.provider?.user?.name,
        amount: booking.totalCost || booking.totalAmount || 0,
      })),
      ...recentPayments.map((payment) => ({
        type: "payment",
        action: `Payment: INR ${payment.amount}`,
        user: payment.booking?.customer?.name || "Unknown",
        dateTime: payment.createdAt,
        status: payment.status,
        amount: payment.amount,
        paymentId: payment._id,
      })),
      ...recentUsers.map((user) => ({
        type: "user",
        action: "New User Registration",
        user: user.name || user.username,
        dateTime: user.createdAt,
        status: user.status || "registered",
        userId: user._id,
        role: user.role,
      })),
    ]
      .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
      .slice(0, 10);

    return {
      all: activities.map((activity) => ({
        ...activity,
        dateTime: formatDate(activity.dateTime),
      })),
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
};

const getSystemNotifications = async () => {
  try {
    const notifications = [];

    const providersNeedingBankDetails = await ServiceProvider.find({
      pendingPayouts: { $gt: 0 },
      bankDetails: { $exists: false },
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
          total: { $sum: "$pendingPayouts" },
        },
      },
    ]);

    if (totalPendingPayouts.length && totalPendingPayouts[0].total > 0) {
      notifications.push({
        type: "info",
        message: `INR ${totalPendingPayouts[0].total} in pending provider payouts`,
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
};

const getRevenueData = async () => {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: oneYearAgo },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$amount" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const monthlyData = Array(12).fill(0);
    monthlyRevenue.forEach((item) => {
      monthlyData[item._id - 1] = item.total;
    });

    return { monthly: monthlyData };
  } catch (err) {
    console.error("Error getting revenue data:", err);
    return { monthly: Array(12).fill(0) };
  }
};

const getServiceData = async () => {
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
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
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
    return { popularServices: [] };
  }
};

const getUserGrowthData = async () => {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const monthlyNewUsers = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: oneYearAgo },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            role: "$role",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.month": 1 },
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

    return { customers, providers };
  } catch (err) {
    console.error("Error getting user growth data:", err);
    return {
      customers: Array(12).fill(0),
      providers: Array(12).fill(0),
    };
  }
};

const getFeedbackData = async () => {
  try {
    const bookingsWithFeedback = await Booking.find({
      "feedback.rating": { $exists: true },
    })
      .populate("customer")
      .populate("service")
      .populate({
        path: "provider",
        populate: { path: "user" },
      })
      .sort({ "feedback.createdAt": -1 })
      .limit(10);

    return bookingsWithFeedback.map((booking) => ({
      id: booking._id,
      customer: booking.customer?.name || "Unknown Customer",
      service: booking.service?.name || "Unknown Service",
      provider: booking.provider?.user?.name || "Unknown Provider",
      rating: booking.feedback?.rating || 0,
      comment: booking.feedback?.comment || "No comment provided",
      date: formatDate(booking.feedback?.createdAt || booking.updatedAt),
    }));
  } catch (err) {
    console.error("Error getting feedback data:", err);
    return [];
  }
};

const getSystemSettings = async () => {
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
};

module.exports = {
  formatDate,
  calculateTotalRevenue,
  getRecentActivity,
  getSystemNotifications,
  getRevenueData,
  getServiceData,
  getUserGrowthData,
  getFeedbackData,
  getSystemSettings,
};
