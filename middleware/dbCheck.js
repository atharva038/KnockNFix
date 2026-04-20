const { isDatabaseConnected } = require("../config/database");

function dbCheck(req, res, next) {
  if (!isDatabaseConnected() && req.path !== "/") {
    req.flash("error", "Database connection is down. Please try again later.");
    return res.redirect("/");
  }
  return next();
}

module.exports = dbCheck;
