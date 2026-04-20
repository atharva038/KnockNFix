// Shared helpers for service domain controllers.
function findServiceDetails(provider, serviceId) {
  let serviceDetails = null;

  provider.servicesOffered.forEach((category) => {
    category.services.forEach((s) => {
      if (s.service._id.toString() === serviceId) {
        serviceDetails = s;
      }
    });
  });

  return serviceDetails;
}

module.exports = {
  findServiceDetails,
};
