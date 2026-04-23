const express = require("express");

function createSystemRoutes({ isDatabaseConnected, getDatabaseStatus }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    return res.render("pages/public/home", {
      dbConnected: isDatabaseConnected(),
    });
  });

  router.get("/db-status", (req, res) => {
    if (process.env.NODE_ENV !== "development") {
      return res.status(404).json({
        success: false,
        error: "Not found",
      });
    }

    return res.json(getDatabaseStatus());
  });

  router.get("/chatbot", (req, res) => {
    if (!req.isAuthenticated()) {
      req.flash("error", "Please login first");
      return res.redirect("/login");
    }

    return res.render("pages/support/chatbot", {
      title: "Chat Assistant",
      currUser: req.user,
    });
  });

  return router;
}

module.exports = {
  createSystemRoutes,
};
