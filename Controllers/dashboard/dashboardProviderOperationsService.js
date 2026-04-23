const mongoose = require("mongoose");
const User = require("../../models/User");
const ServiceProvider = require("../../models/ServiceProvider");
const Service = require("../../models/Service");
const Booking = require("../../models/Booking");
const Category = require("../../models/category");
const { validationResult } = require("express-validator");

exports.updateProviderInfo = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) return res.status(404).json({ success: false, error: "Provider profile not found" });

    if (req.body.experience !== undefined) provider.experience = req.body.experience;
    if (req.body.specialization !== undefined) provider.specialization = req.body.specialization;
    if (req.body.bio !== undefined) provider.bio = req.body.bio;

    await provider.save();
    return res.json({ success: true, message: "Provider information updated successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to update provider information: " + error.message });
  }
};

exports.showRegisterService = async (req, res) => {
  try {
    const categories = await Category.find().lean();
    const services = await Service.find().populate("category").lean();
    return res.render("pages/public/registerService", { categories, services, user: req.user, title: "Register Service" });
  } catch (err) {
    req.flash("error", "Unable to load categories and services");
    return res.redirect("/dashboard");
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
    return res.redirect("/dashboard");
  } catch (err) {
    console.error("Service registration error:", err);
    req.flash("error", "Failed to register service. Please try again.");
    return res.redirect("/dashboard/registerService");
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
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
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

    return res.json({ success: true, service: { name: service.name, img: service.img, price: service.price, description: service.description } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.advancePayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Not authorized to make payment for this booking" });
    }

    if (booking.status !== "pending") return res.status(400).json({ success: false, error: "Can only make advance payment for pending bookings" });

    if (booking.automationStatus?.depositProcessed) {
      return res.status(400).json({ success: false, error: "This booking already has automated payment processing" });
    }

    booking.advancePayment = { paid: true, amount: booking.totalCost * 0.15, date: new Date() };
    booking.paymentStatus = "partially_paid";
    booking.status = "confirmed";
    await booking.save();

    return res.json({ success: true, message: "Advance payment completed successfully" });
  } catch (error) {
    console.error("Advance payment error:", error);
    return res.status(500).json({ success: false, error: "Failed to process payment" });
  }
};

exports.completePayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Not authorized to complete payment for this booking" });
    }

    if (booking.status !== "confirmed") return res.status(400).json({ success: false, error: "Can only complete payment for confirmed bookings" });

    const remainingAmount = booking.totalCost - (booking.advancePayment?.amount || 0);
    booking.finalPayment = { paid: true, amount: remainingAmount, date: new Date() };
    booking.status = "completed";
    booking.paymentStatus = "completed";
    booking.completedAt = new Date();
    await booking.save();

    return res.json({ success: true, message: "Final payment completed successfully" });
  } catch (error) {
    console.error("Final payment error:", error);
    return res.status(500).json({ success: false, error: "Failed to process payment" });
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
    return res.json({ success: true, message: "Availability settings updated successfully" });
  } catch (error) {
    console.error("Error updating availability:", error);
    return res.status(500).json({ success: false, error: "Failed to update availability settings: " + error.message });
  }
};

exports.updateServiceArea = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) return res.status(404).json({ success: false, error: "Provider profile not found" });

    const radius = parseInt(req.body.radius, 10) || 20;
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
    return res.json({ success: true, message: "Service area updated successfully", data: { serviceArea: provider.serviceArea } });
  } catch (error) {
    console.error("Error updating service area:", error);
    return res.status(500).json({ success: false, error: "Failed to update service area: " + error.message });
  }
};

exports.addLocation = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: "Provider profile not found" });

    const { name, lat, lng, radius } = req.body;
    if (!name || !lat || !lng || !radius) return res.status(400).json({ success: false, message: "Missing required location data" });

    const location = { name: name.trim(), lat: parseFloat(lat), lng: parseFloat(lng), radius: parseInt(radius, 10) };
    if (isNaN(location.lat) || isNaN(location.lng) || isNaN(location.radius)) {
      return res.status(400).json({ success: false, message: "Invalid location coordinates or radius" });
    }

    if (!provider.serviceAreas) provider.serviceAreas = [];
    provider.serviceAreas.push(location);
    await provider.save();

    return res.json({ success: true, message: "Service area location added successfully", location });
  } catch (error) {
    console.error("Error adding service area location:", error);
    return res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const locationId = req.params.id;
    if (!locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({ success: false, message: "Invalid location ID" });
    }

    const provider = await ServiceProvider.findOne({ user: req.user._id });
    if (!provider) return res.status(404).json({ success: false, message: "Provider profile not found" });
    if (!provider.serviceAreas?.length) return res.status(404).json({ success: false, message: "No service areas found" });

    const locationIndex = provider.serviceAreas.findIndex((area) => area._id.toString() === locationId);
    if (locationIndex === -1) return res.status(404).json({ success: false, message: "Service area location not found" });

    provider.serviceAreas.splice(locationIndex, 1);
    await provider.save();

    return res.json({ success: true, message: "Service area location removed successfully" });
  } catch (error) {
    console.error("Error removing service area location:", error);
    return res.status(500).json({ success: false, message: "Server error: " + error.message });
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
    return res.json({ success: true, message: "Travel fee settings updated successfully", data: { travelFeeEnabled: provider.travelFeeEnabled, travelFeeAmount: provider.travelFeeAmount } });
  } catch (error) {
    console.error("Error updating travel fee settings:", error);
    return res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};
