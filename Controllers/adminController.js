const approvalController = require("./admin/approvalController");
const dashboardAdminController = require("./admin/dashboardAdminController");
const userAdminController = require("./admin/userAdminController");
const categoryController = require("./admin/categoryController");
const serviceAdminController = require("./admin/serviceAdminController");
const bookingAdminController = require("./admin/bookingAdminController");
const paymentAdminController = require("./admin/paymentAdminController");
const reportsController = require("./admin/reportsController");
const settingsController = require("./admin/settingsController");
const helperFunctions = require("./admin/helpers");

module.exports = {
  ...approvalController,
  ...dashboardAdminController,
  ...userAdminController,
  ...categoryController,
  ...serviceAdminController,
  ...bookingAdminController,
  ...paymentAdminController,
  ...reportsController,
  ...settingsController,
  ...helperFunctions,
};
