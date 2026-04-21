const dashboardOverviewService = require("./dashboardOverviewService");
const dashboardProviderOperationsService = require("./dashboardProviderOperationsService");

module.exports = {
  ...dashboardOverviewService,
  ...dashboardProviderOperationsService,
};
