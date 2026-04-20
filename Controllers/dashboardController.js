// Controllers/dashboardController.js
// Extracted from routes/dashboard.js for structural clarity

const mongoose = require("mongoose");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const Category = require("../models/category");
const { body, validationResult } = require("express-validator");

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

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

      // Normalise dual date fields
      if (!b.bookingDate && b.date) b.bookingDate = b.date;
      if (!b.date && b.bookingDate) b.date = b.bookingDate;

      // Payment status display
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

    // Ensure availability data exists
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

// =============================================================================
// EXPORTED CONTROLLER METHODS
// =============================================================================

exports.showDashboard = async (req, res) => {
  try {
    const user = req.user;
    const userLocation = req.session.userLocation || null;

    if (user.role === "customer") {
      const data = await getCustomerDashboardData(user._id);
      return res.render("pages/customerDashboard", {
        currUser: user, user, userLocation,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
        title: "Customer Dashboard",
        ...data,
      });
    }

    if (user.role === "provider") {
      const data = await getProviderDashboardData(user._id);
      return res.render("pages/providerDashboard", {
        currUser: user, user,
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

      return res.render("dashboard/admin", {
        totalBookings, totalUsers, totalProviders, totalServices, recentBookings,
        user, currUser: user, title: "Admin Dashboard",
      });
    }

    req.flash("error", "Invalid user role");
    return res.redirect("/");
  } catch (err) {
    console.error("Dashboard error:", err);
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

    res.json({ success: true, bookings });
  } catch (error) {
    console.error("API bookings error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateProviderInfo = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) return res.status(404).json({ success: false, error: "Provider profile not found" });

    if (req.body.experience !== undefined) provider.experience = req.body.experience;
    if (req.body.specialization !== undefined) provider.specialization = req.body.specialization;
    if (req.body.bio !== undefined) provider.bio = req.body.bio;

    await provider.save();
    res.json({ success: true, message: "Provider information updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update provider information: " + error.message });
  }
};

exports.showRegisterService = async (req, res) => {
  try {
    const categories = await Category.find().lean();
    const services = await Service.find().populate("category").lean();
    res.render("pages/registerService", { categories, services, user: req.user, title: "Register Service" });
  } catch (err) {
    req.flash("error", "Unable to load categories and services");
    res.redirect("/dashboard");
  }
};

exports.registerService = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash("error", errors.array().map((e) => e.msg).join(", "));
    return res.redirect("/dashboard/registerService");
  }

  try {
    const userId = req.user._id;
    const { serviceCategories, services, cost, experience } = req.body;

    let serviceProvider = await ServiceProvider.findOne({ user: userId });

    if (serviceProvider) {
      const isDuplicate = serviceProvider.servicesOffered.some((offered) =>
        offered.services.some((s) => s.service.toString() === services)
      );
      if (isDuplicate) {
        req.flash("error", "You have already registered for this service");
        return res.redirect("/dashboard/registerService");
      }

      const existingCategoryIndex = serviceProvider.servicesOffered.findIndex(
        (offered) => offered.category.toString() === serviceCategories
      );

      if (existingCategoryIndex !== -1) {
        await ServiceProvider.findOneAndUpdate(
          { user: userId, "servicesOffered.category": serviceCategories },
          { $push: { "servicesOffered.$.services": { service: services, customCost: Number(cost), experience: `${experience} years` } }, experience: Number(experience) },
          { new: true }
        );
      } else {
        await ServiceProvider.findOneAndUpdate(
          { user: userId },
          { $push: { servicesOffered: { category: serviceCategories, services: [{ service: services, customCost: Number(cost), experience: `${experience} years` }] } }, experience: Number(experience) },
          { new: true }
        );
      }
    } else {
      serviceProvider = await ServiceProvider.create({
        user: userId,
        servicesOffered: [{ category: serviceCategories, services: [{ service: services, customCost: Number(cost), experience: `${experience} years` }] }],
        experience: Number(experience),
      });
    }

    await Service.findByIdAndUpdate(services, { $addToSet: { providers: serviceProvider._id } });

    req.flash("success", "Service added successfully!");
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Service registration error:", err);
    req.flash("error", "Failed to register service. Please try again.");
    res.redirect("/dashboard/registerService");
  }
};

exports.deleteService = async (req, res) => {
  try {
    const serviceId = req.params.id;
    const { categoryId } = req.body;
    const userId = req.user._id;

    if (!serviceId || !categoryId) return res.status(400).json({ success: false, message: "Missing service or category ID" });

    const serviceProvider = await ServiceProvider.findOne({ user: userId });
    if (!serviceProvider) return res.status(404).json({ success: false, message: "Service provider not found" });

    const categoryIndex = serviceProvider.servicesOffered.findIndex((c) => c.category.toString() === categoryId);
    if (categoryIndex === -1) return res.status(404).json({ success: false, message: "Category not found" });

    serviceProvider.servicesOffered[categoryIndex].services = serviceProvider.servicesOffered[categoryIndex].services.filter(
      (s) => s._id.toString() !== serviceId
    );

    await serviceProvider.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getServiceDetails = async (req, res) => {
  try {
    const serviceId = req.params.id;
    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, message: "Invalid service ID format" });
    }

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ success: false, message: "Service not found" });

    res.json({ success: true, service: { name: service.name, img: service.img, price: service.price, description: service.description } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.advancePayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    if (booking.customer.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, error: "Not authorized to make payment for this booking" });

    if (booking.status !== "pending") return res.status(400).json({ success: false, error: "Can only make advance payment for pending bookings" });

    if (booking.automationStatus?.depositProcessed)
      return res.status(400).json({ success: false, error: "This booking already has automated payment processing" });

    booking.advancePayment = { paid: true, amount: booking.totalCost * 0.15, date: new Date() };
    booking.paymentStatus = "partially_paid";
    booking.status = "confirmed";
    await booking.save();

    res.json({ success: true, message: "Advance payment completed successfully" });
  } catch (error) {
    console.error("Advance payment error:", error);
    res.status(500).json({ success: false, error: "Failed to process payment" });
  }
};

exports.completePayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    if (booking.customer.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, error: "Not authorized to complete payment for this booking" });

    if (booking.status !== "confirmed") return res.status(400).json({ success: false, error: "Can only complete payment for confirmed bookings" });

    const remainingAmount = booking.totalCost - (booking.advancePayment?.amount || 0);
    booking.finalPayment = { paid: true, amount: remainingAmount, date: new Date() };
    booking.status = "completed";
    booking.paymentStatus = "completed";
    booking.completedAt = new Date();
    await booking.save();

    res.json({ success: true, message: "Final payment completed successfully" });
  } catch (error) {
    console.error("Final payment error:", error);
    res.status(500).json({ success: false, error: "Failed to process payment" });
  }
};

exports.updateAvailability = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) return res.status(404).json({ success: false, error: "Provider profile not found" });

    provider.isActive = req.body.isActive;

    if (req.body.availability) {
      const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      days.forEach((day) => {
        if (!req.body.availability[day]) {
          req.body.availability[day] = { isAvailable: true, slots: [{ startTime: "07:00", endTime: "21:00", isActive: true }] };
        }
        if (!req.body.availability[day].slots || !Array.isArray(req.body.availability[day].slots) || req.body.availability[day].slots.length === 0) {
          req.body.availability[day].slots = [{ startTime: "07:00", endTime: "21:00", isActive: true }];
        }
        req.body.availability[day].slots = req.body.availability[day].slots.map((slot) => ({
          startTime: slot.startTime || "07:00",
          endTime: slot.endTime || "21:00",
          isActive: typeof slot.isActive === "boolean" ? slot.isActive : true,
        }));
      });
      provider.availability = req.body.availability;
    }

    await provider.save();
    res.json({ success: true, message: "Availability settings updated successfully" });
  } catch (error) {
    console.error("Error updating availability:", error);
    res.status(500).json({ success: false, error: "Failed to update availability settings: " + error.message });
  }
};

exports.updateServiceArea = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) return res.status(404).json({ success: false, error: "Provider profile not found" });

    const radius = parseInt(req.body.radius) || 20;
    const city = req.body.city || "";
    const state = req.body.state || "";
    const pincode = req.body.pincode || "";

    if (!provider.serviceArea) provider.serviceArea = {};
    provider.serviceArea.radius = radius;
    provider.serviceArea.city = city;
    provider.serviceArea.state = state;
    provider.serviceArea.pincode = pincode;

    if (req.body.latitude && req.body.longitude) {
      const latitude = parseFloat(req.body.latitude);
      const longitude = parseFloat(req.body.longitude);
      if (!isNaN(latitude) && !isNaN(longitude)) {
        provider.serviceArea.coordinates = { latitude, longitude };
      }
    } else if (!provider.serviceArea.coordinates) {
      const user = await User.findById(req.user._id);
      if (user?.addresses?.length > 0) {
        const defaultAddress = user.addresses.find((a) => a.isDefault) || user.addresses[0];
        if (defaultAddress.coordinates?.latitude && defaultAddress.coordinates?.longitude) {
          provider.serviceArea.coordinates = { latitude: defaultAddress.coordinates.latitude, longitude: defaultAddress.coordinates.longitude };
        }
      }
    }

    await provider.save();
    res.json({ success: true, message: "Service area updated successfully", data: { serviceArea: provider.serviceArea } });
  } catch (error) {
    console.error("Error updating service area:", error);
    res.status(500).json({ success: false, error: "Failed to update service area: " + error.message });
  }
};

exports.addLocation = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: "Provider profile not found" });

    const { name, lat, lng, radius } = req.body;
    if (!name || !lat || !lng || !radius) return res.status(400).json({ success: false, message: "Missing required location data" });

    const location = { name: name.trim(), lat: parseFloat(lat), lng: parseFloat(lng), radius: parseInt(radius) };
    if (isNaN(location.lat) || isNaN(location.lng) || isNaN(location.radius))
      return res.status(400).json({ success: false, message: "Invalid location coordinates or radius" });

    if (!provider.serviceAreas) provider.serviceAreas = [];
    provider.serviceAreas.push(location);
    await provider.save();

    res.json({ success: true, message: "Service area location added successfully", location });
  } catch (error) {
    console.error("Error adding service area location:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const locationId = req.params.id;
    if (!locationId || !mongoose.Types.ObjectId.isValid(locationId))
      return res.status(400).json({ success: false, message: "Invalid location ID" });

    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: "Provider profile not found" });
    if (!provider.serviceAreas?.length) return res.status(404).json({ success: false, message: "No service areas found" });

    const locationIndex = provider.serviceAreas.findIndex((area) => area._id.toString() === locationId);
    if (locationIndex === -1) return res.status(404).json({ success: false, message: "Service area location not found" });

    provider.serviceAreas.splice(locationIndex, 1);
    await provider.save();

    res.json({ success: true, message: "Service area location removed successfully" });
  } catch (error) {
    console.error("Error removing service area location:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

exports.updateLocationSettings = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: "Provider profile not found" });

    const { travelFeeEnabled, travelFeeAmount } = req.body;
    provider.travelFeeEnabled = !!travelFeeEnabled;

    if (travelFeeAmount !== undefined) {
      const amount = parseFloat(travelFeeAmount);
      if (!isNaN(amount) && amount >= 0) provider.travelFeeAmount = amount;
    }

    await provider.save();
    res.json({ success: true, message: "Travel fee settings updated successfully", data: { travelFeeEnabled: provider.travelFeeEnabled, travelFeeAmount: provider.travelFeeAmount } });
  } catch (error) {
    console.error("Error updating travel fee settings:", error);
    res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};
