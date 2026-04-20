const {
  getRevenueData,
  getServiceData,
  getUserGrowthData,
  getFeedbackData,
} = require("./helpers");

const reportsController = {
  showReports: async (req, res) => {
    try {
      const revenueData = await getRevenueData();
      const serviceData = await getServiceData();
      const userGrowthData = await getUserGrowthData();

      return res.render("pages/admin/reports", {
        revenueData,
        serviceData,
        userGrowthData,
        currentPath: req.path,
        title: "Reports - Admin",
      });
    } catch (err) {
      console.error("Error loading reports:", err);
      req.flash("error", "Error loading reports");
      return res.redirect("/admin/dashboard");
    }
  },

  showFeedback: async (req, res) => {
    try {
      const feedback = await getFeedbackData();
      return res.render("pages/admin/feedback", {
        feedback,
        currentPath: req.path,
        title: "Feedback Management - Admin",
      });
    } catch (err) {
      console.error("Error loading feedback:", err);
      req.flash("error", "Error loading feedback");
      return res.redirect("/admin/dashboard");
    }
  },
};

module.exports = reportsController;
