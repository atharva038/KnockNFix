const ServiceProvider = require("../../models/ServiceProvider");
const Service = require("../../models/Service");
const Booking = require("../../models/Booking");
const Payment = require("../../models/Payment");

async function calculateBookingIncrease(providerId) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonth = await Booking.countDocuments({ provider: providerId, createdAt: { $gte: startOfMonth } });
    const lastMonth = await Booking.countDocuments({ provider: providerId, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } });

    if (lastMonth === 0) return thisMonth > 0 ? 100 : 0;
    return Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  } catch (error) {
    console.error("Error calculating booking increase:", error);
    return 0;
  }
}

async function calculateProviderRatings(providerId) {
  try {
    const bookingsWithRatings = await Booking.find({ provider: providerId, "feedback.rating": { $exists: true, $ne: null } }).select("feedback.rating");
    if (bookingsWithRatings.length === 0) return { average: 0, total: 0 };

    const totalRating = bookingsWithRatings.reduce((sum, b) => sum + (b.feedback.rating || 0), 0);
    return { average: Math.round((totalRating / bookingsWithRatings.length) * 10) / 10, total: bookingsWithRatings.length };
  } catch (error) {
    console.error("Error calculating provider ratings:", error);
    return { average: 0, total: 0 };
  }
}

async function getCustomerDashboardData(userId) {
  try {
    const bookings = await Booking.find({ customer: userId })
      .populate({ path: "service", select: "name img price description category" })
      .populate({ path: "provider", populate: { path: "user", select: "name email phone profileImage" } })
      .sort({ createdAt: -1 })
      .lean();

    const processedBookings = bookings.map((booking) => {
      const b = JSON.parse(JSON.stringify(booking));

      if (!b.service) {
        b.service = { name: "Unknown Service", img: "https://placehold.co/300x200?text=Unknown+Service", price: 0 };
      } else if (!b.service.img) {
        b.service.img = "https://placehold.co/300x200?text=No+Image";
      }

      if (!b.provider) {
        b.provider = { user: { name: "Unknown Provider", profileImage: "https://placehold.co/100x100?text=Provider" } };
      } else if (!b.provider.user) {
        b.provider.user = { name: "Unknown Provider", profileImage: "https://placehold.co/100x100?text=Provider" };
      } else if (!b.provider.user.profileImage || b.provider.user.profileImage.includes("data:;base64,=")) {
        b.provider.user.profileImage = "https://placehold.co/100x100?text=Provider";
      }

      if (!b.bookingDate && b.date) b.bookingDate = b.date;
      if (!b.date && b.bookingDate) b.date = b.bookingDate;

      if (b.paymentStatus === "partially_paid") {
        b.displayStatus = "Advance Paid";
        b.badgeClass = "badge-warning";
      } else if (b.paymentStatus === "completed") {
        b.displayStatus = "Fully Paid";
        b.badgeClass = "badge-success";
      } else {
        b.displayStatus = "Payment Pending";
        b.badgeClass = "badge-danger";
      }

      if (b.automationStatus?.depositProcessed) {
        b.isAutomated = true;
        b.automationInfo = "Automated Payment System";
      }

      return b;
    });

    const services = await Service.find({ isActive: true }).populate("category").limit(6).lean();

    const bookingStats = {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
    };

    const recentPayments = await Payment.find({ status: "completed" })
      .populate({ path: "booking", match: { customer: userId }, select: "service status createdAt" })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return {
      bookings: processedBookings,
      services: services || [],
      bookingStats,
      recentPayments: recentPayments.filter((p) => p.booking),
    };
  } catch (error) {
    console.error("Error fetching customer dashboard data:", error);
    return { bookings: [], services: [], bookingStats: { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 }, recentPayments: [] };
  }
}

async function getProviderDashboardData(userId) {
  try {
    let serviceProviderData = await ServiceProvider.findOne({ user: userId });

    if (!serviceProviderData) {
      const defaultAvailability = {};
      ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].forEach((day) => {
        defaultAvailability[day] = { isAvailable: true, slots: [{ startTime: "09:00", endTime: "17:00", isActive: true }] };
      });
      serviceProviderData = await ServiceProvider.create({ user: userId, availability: defaultAvailability, earnings: 0, isVerified: false, isActive: true });
    }

    const providerWithServices = await ServiceProvider.findOne({ user: userId })
      .populate({ path: "servicesOffered.category", model: "Category", select: "name description" })
      .populate({ path: "servicesOffered.services.service", model: "Service", select: "name img price description category" })
      .lean();

    const bookings = await Booking.find({ provider: serviceProviderData._id })
      .populate({ path: "service", select: "name img price description category" })
      .populate({ path: "customer", model: "User", select: "name email phone profileImage" })
      .sort({ createdAt: -1 })
      .lean();

    const processedBookings = bookings.map((booking) => {
      const b = JSON.parse(JSON.stringify(booking));

      if (!b.service) {
        b.service = { name: "Unknown Service", img: "https://placehold.co/300x200?text=Unknown+Service", price: 0 };
      } else if (!b.service.img) {
        b.service.img = "https://placehold.co/300x200?text=No+Image";
      }

      if (!b.customer) {
        b.customer = { name: "Unknown Customer", profileImage: "https://placehold.co/100x100?text=Customer" };
      } else if (!b.customer.profileImage || b.customer.profileImage.includes("data:;base64,=")) {
        b.customer.profileImage = "https://placehold.co/100x100?text=Customer";
      }

      if (!b.bookingDate && b.date) b.bookingDate = b.date;
      if (!b.date && b.bookingDate) b.date = b.bookingDate;

      switch (b.status) {
        case "pending":
          b.statusDisplay = b.automationStatus?.depositProcessed ? "Awaiting Provider Confirmation (Deposit Paid)" : "Pending Confirmation";
          b.statusClass = "text-warning";
          break;
        case "confirmed":
          b.statusDisplay = b.automationStatus?.depositProcessed ? "Confirmed (Auto-Payment) - Awaiting Work Completion" : "Confirmed - Ready for Work";
          b.statusClass = "text-info";
          break;
        case "completed":
          b.statusDisplay = "Work Completed & Paid";
          b.statusClass = "text-success";
          break;
        case "cancelled":
          b.statusDisplay = "Cancelled";
          b.statusClass = "text-danger";
          break;
        default:
          b.statusDisplay = "Unknown";
          b.statusClass = "text-muted";
      }

      if (b.status === "completed") {
        if (b.providerPayout?.status === "processed") {
          b.payoutStatus = "Paid Out";
          b.payoutClass = "badge-success";
        } else if (b.automationStatus?.providerPayoutScheduled) {
          b.payoutStatus = "Auto-Payout Scheduled";
          b.payoutClass = "badge-info";
        } else {
          b.payoutStatus = "Payout Pending";
          b.payoutClass = "badge-warning";
        }
      }

      return b;
    });

    const bookingStats = {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      confirmed: bookings.filter((b) => b.status === "confirmed").length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
      increase: await calculateBookingIncrease(serviceProviderData._id),
    };

    const ratings = await calculateProviderRatings(serviceProviderData._id);

    const completedBookings = bookings.filter((b) => b.status === "completed" && b.finalPayment?.paid);
    let totalEarnings = 0;
    let automatedEarnings = 0;

    completedBookings.forEach((booking) => {
      if (booking.finalPayment?.amount) {
        const commission = booking.commission || Math.round(booking.finalPayment.amount * 0.1);
        const netAmount = booking.finalPayment.amount - commission;
        totalEarnings += netAmount;
        if (booking.automationStatus?.automationCompleted) automatedEarnings += netAmount;
      }
    });

    if (totalEarnings !== serviceProviderData.earnings) {
      await ServiceProvider.findByIdAndUpdate(serviceProviderData._id, { earnings: totalEarnings });
      serviceProviderData.earnings = totalEarnings;
    }

    if (!providerWithServices?.availability) {
      const defaultAvailability = {};
      ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].forEach((day) => {
        defaultAvailability[day] = { isAvailable: true, slots: [{ startTime: "09:00", endTime: "17:00", isActive: true }] };
      });
      await ServiceProvider.findByIdAndUpdate(serviceProviderData._id, { availability: defaultAvailability });
      if (providerWithServices) providerWithServices.availability = defaultAvailability;
    }

    const recentPayments = await Payment.find({ status: "completed" })
      .populate({ path: "booking", match: { provider: serviceProviderData._id }, select: "customer service status createdAt" })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return {
      provider: providerWithServices || serviceProviderData,
      bookings: processedBookings,
      services: providerWithServices?.servicesOffered || [],
      bookingStats,
      ratings,
      earnings: totalEarnings,
      automatedEarnings,
      recentPayments: recentPayments.filter((p) => p.booking),
    };
  } catch (error) {
    console.error("Error fetching provider dashboard data:", error);
    return { provider: null, bookings: [], services: [], bookingStats: { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, increase: 0 }, ratings: { average: 0, total: 0 }, earnings: 0, automatedEarnings: 0, recentPayments: [] };
  }
}

module.exports = {
  getCustomerDashboardData,
  getProviderDashboardData,
};
