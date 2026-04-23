const Service = require("../../models/Service");
const User = require("../../models/User");
const ServiceProvider = require("../../models/ServiceProvider");
const {findServiceDetails} = require("./helpers");

// Book service route
exports.bookService = async (req, res) => {
  try {
    const {id: serviceId, provider: providerId} = req.params;

    // Fetch service and provider
    const [service, provider] = await Promise.all([
      Service.findById(serviceId).populate("category").lean(),
      ServiceProvider.findById(providerId)
        .populate("user")
        .populate("servicesOffered.services.service")
        .lean(),
    ]);

    if (!service) {
      req.flash("error", "Service not found");
      return res.redirect("/services");
    }

    if (!provider) {
      req.flash("error", "Provider not found");
      return res.redirect("/services");
    }

    // Find the specific service details from provider's servicesOffered
    const serviceDetails = findServiceDetails(provider, serviceId);

    // If service details not found
    if (!serviceDetails) {
      req.flash("error", "Service details not found");
      return res.redirect("/services");
    }

    // Fetch user addresses
    const user = await User.findById(req.user._id).lean();
    const addresses = user ? user.addresses : [];

    // Add custom cost to service object
    service.cost = serviceDetails.customCost;
    service.providerExperience = serviceDetails.experience;

    res.render("pages/booking/index", {
      service,
      provider,
      addresses,
      serviceDetails,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY, // Add this line!
      title: `Book ${service.name}`,
    });
  } catch (error) {
    console.error("Error fetching service or provider:", error);
    req.flash("error", "Something went wrong");
    res.redirect("/services");
  }
};
