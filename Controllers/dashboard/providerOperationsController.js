const dashboardCoreController = require("./dashboardCoreController");

module.exports = {
  updateProviderInfo: dashboardCoreController.updateProviderInfo,
  showRegisterService: dashboardCoreController.showRegisterService,
  registerService: dashboardCoreController.registerService,
  deleteService: dashboardCoreController.deleteService,
  getServiceDetails: dashboardCoreController.getServiceDetails,
  advancePayment: dashboardCoreController.advancePayment,
  completePayment: dashboardCoreController.completePayment,
  updateAvailability: dashboardCoreController.updateAvailability,
  updateServiceArea: dashboardCoreController.updateServiceArea,
  addLocation: dashboardCoreController.addLocation,
  deleteLocation: dashboardCoreController.deleteLocation,
  updateLocationSettings: dashboardCoreController.updateLocationSettings,
};
