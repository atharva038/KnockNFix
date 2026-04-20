const { getSystemSettings } = require("./helpers");

const settingsController = {
  showSettings: async (req, res) => {
    try {
      const settings = await getSystemSettings();
      return res.render("pages/admin/settings", {
        settings,
        currentPath: req.path,
        title: "System Settings - Admin",
      });
    } catch (err) {
      console.error("Error loading settings:", err);
      req.flash("error", "Error loading settings");
      return res.redirect("/admin/dashboard");
    }
  },

  updateSettings: async (req, res) => {
    try {
      const { platformCommission } = req.body;

      const commissionValue = parseInt(platformCommission);
      if (
        isNaN(commissionValue) ||
        commissionValue < 1 ||
        commissionValue > 50
      ) {
        req.flash("error", "Platform commission must be between 1% and 50%");
        return res.redirect("/admin/settings");
      }

      req.flash("success", "Settings updated successfully");
      return res.redirect("/admin/settings");
    } catch (err) {
      console.error("Error updating settings:", err);
      req.flash("error", "Error updating settings");
      return res.redirect("/admin/settings");
    }
  },
};

module.exports = settingsController;
