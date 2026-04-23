const Service = require("../../models/Service");

exports.showMyServices = async (req, res) => {
  try {
    const services = await Service.find({ provider: req.user.id });
    return res.render("pages/providerDashboard/myservices", { services });
  } catch (err) {
    return res.status(500).send("Server error");
  }
};

exports.editService = async (req, res) => {
  const { name, description, cost, availability } = req.body;

  try {
    await Service.findByIdAndUpdate(req.params.serviceId, {
      name,
      description,
      cost,
      availability,
    });

    return res.redirect("/provider/myservices");
  } catch (err) {
    return res.status(500).send("Server error");
  }
};
