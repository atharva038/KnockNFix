const Service = require("../../models/Service");

const serviceAdminController = {
  showServices: async (req, res) => {
    try {
      const services = await Service.find().populate("category").lean();
      return res.render("pages/admin/services", {
        services,
        currentPath: req.path,
        title: "Service Management - Admin",
      });
    } catch (err) {
      console.error("Error loading services:", err);
      req.flash("error", "Error loading services");
      return res.redirect("/admin/dashboard");
    }
  },

  deleteService: async (req, res) => {
    try {
      await Service.findByIdAndDelete(req.params.id);
      req.flash("success", "Service deleted successfully");
      return res.redirect("/admin/services");
    } catch (err) {
      console.error("Error deleting service:", err);
      req.flash("error", "Error deleting service");
      return res.redirect("/admin/services");
    }
  },

  toggleServiceStatus: async (req, res) => {
    try {
      const service = await Service.findById(req.params.id);
      if (!service) {
        return res
          .status(404)
          .json({ success: false, message: "Service not found" });
      }

      service.isActive = !service.isActive;
      await service.save();

      return res.json({
        success: true,
        isActive: service.isActive,
        message: `Service ${
          service.isActive ? "activated" : "deactivated"
        } successfully`,
      });
    } catch (err) {
      console.error("Error toggling service status:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error updating service status" });
    }
  },
};

module.exports = serviceAdminController;
