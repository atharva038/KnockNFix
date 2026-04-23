const Booking = require("../../models/Booking");

const bookingAdminController = {
  showBookings: async (req, res) => {
    try {
      const bookings = await Booking.find()
        .populate("customer")
        .populate("service")
        .populate("provider")
        .populate({
          path: "service",
          populate: { path: "category" },
        })
        .sort({ createdAt: -1 });

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

        if (!plainBooking.service) {
          plainBooking.service = { name: "Unknown Service", category: { name: "Unknown Category" } };
        } else if (!plainBooking.service.category) {
          plainBooking.service.category = { name: "Unknown Category" };
        }

        if (!plainBooking.provider) {
          plainBooking.provider = { name: "Not assigned", businessName: "N/A", user: { name: "Unknown" } };
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

      return res.render("pages/admin/bookings", {
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
      return res.redirect("/admin/dashboard");
    }
  },
};

module.exports = bookingAdminController;
