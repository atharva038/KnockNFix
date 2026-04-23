const User = require("../../models/User");
const ServiceProvider = require("../../models/ServiceProvider");
const Service = require("../../models/Service");
const Booking = require("../../models/Booking");
const { getCustomerDashboardData, getProviderDashboardData } = require("./dashboardDataService");

exports.showDashboard = async (req, res) => {
  try {
    const user = req.user;
    const userLocation = req.session.userLocation || null;

    if (user.role === "customer") {
      const data = await getCustomerDashboardData(user._id);
      return res.render("pages/customerDashboard", {
        currUser: user,
        user,
        userLocation,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
        title: "Customer Dashboard",
        ...data,
      });
    }

    if (user.role === "provider") {
      const data = await getProviderDashboardData(user._id);
      return res.render("pages/providerDashboard", {
        currUser: user,
        user,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
        googleMapsId: process.env.GOOGLE_MAPS_ID,
        title: "Provider Dashboard",
        ...data,
      });
    }

    if (user.role === "admin") {
      const [totalBookings, totalUsers, totalProviders, totalServices, recentBookings] = await Promise.all([
        Booking.countDocuments(),
        User.countDocuments(),
        ServiceProvider.countDocuments(),
        Service.countDocuments(),
        Booking.find()
          .populate("customer", "name email")
          .populate("service", "name")
          .populate({ path: "provider", populate: { path: "user", select: "name" } })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

      return res.render("pages/admin/dashboard", {
        totalBookings,
        totalUsers,
        totalProviders,
        totalServices,
        recentBookings,
        user,
        currUser: user,
        title: "Admin Dashboard",
      });
    }

    req.flash("error", "Invalid user role");
    return res.redirect("/");
  } catch (err) {
    console.error("Dashboard error:", err);
    // BUG-021: Surface provider profile missing as a clear, actionable error
    if (err.code === 'PROVIDER_PROFILE_MISSING') {
      req.flash("error", err.message);
      return res.redirect("/");
    }
    req.flash("error", "Error loading dashboard: " + err.message);
    return res.redirect("/");
  }
};

exports.getBookingsAPI = async (req, res) => {
  try {
    let bookings = [];

    if (req.user.role === "customer") {
      bookings = await Booking.find({ customer: req.user._id })
        .populate("service", "name img")
        .populate({ path: "provider", populate: { path: "user", select: "name" } })
        .sort({ createdAt: -1 })
        .lean();
    } else if (req.user.role === "provider") {
      const provider = await ServiceProvider.findOne({ user: req.user._id });
      if (provider) {
        bookings = await Booking.find({ provider: provider._id })
          .populate("service", "name img")
          .populate("customer", "name")
          .sort({ createdAt: -1 })
          .lean();
      }
    }

    return res.json({ success: true, bookings });
  } catch (error) {
    console.error("API bookings error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
