const User = require("../../models/User");
const ServiceProvider = require("../../models/ServiceProvider");
const Service = require("../../models/Service");
const Booking = require("../../models/Booking");

const userAdminController = {
  showUsers: async (req, res) => {
    try {
      let users = await User.find().sort({ createdAt: -1 });

      users = users.map((user) => {
        const normalized = user.toObject ? user.toObject() : { ...user };
        if (!normalized.status) {
          normalized.status = "unverified";
        }
        return normalized;
      });

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

      return res.render("pages/admin/users", {
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
      return res.redirect("/admin/dashboard");
    }
  },

  showUserDetails: async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).lean();
      if (!user) {
        req.flash("error", "User not found");
        return res.redirect("/admin/users");
      }

      let bookings = [];
      let providerServices = [];

      if (user.role === "customer") {
        bookings = await Booking.find({ customer: userId })
          .populate("service")
          .populate({
            path: "provider",
            populate: { path: "user" },
          })
          .sort({ createdAt: -1 })
          .lean();
      }

      if (user.role === "provider") {
        const serviceProvider = await ServiceProvider.findOne({
          user: userId,
        }).lean();

        if (serviceProvider) {
          const services = await Service.find({
            provider: serviceProvider._id,
          })
            .populate("category")
            .lean();

          providerServices = await Promise.all(
            services.map(async (service) => {
              const bookingCount = await Booking.countDocuments({
                service: service._id,
              });

              return {
                ...service,
                bookingCount,
              };
            })
          );
        }
      }

      return res.render("pages/admin/user-details", {
        user,
        bookings,
        providerServices,
        currentPath: req.path,
        title: `${user.name} - User Details - Admin`,
      });
    } catch (err) {
      console.error("Error fetching user details:", err);
      req.flash("error", "Failed to load user details");
      return res.redirect("/admin/users");
    }
  },
};

module.exports = userAdminController;
