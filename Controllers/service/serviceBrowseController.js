const Service = require("../../models/Service");
const Category = require("../../models/category");

// Get all services/categories
exports.getAllServices = async (req, res) => {
  try {
    // Fetch all categories with their images
    const categories = await Category.find();

    // Render the services page with the category data
    res.render("pages/public/service", {categories});
  } catch (err) {
    console.error("Error fetching categories:", err);
    req.flash("error", "Failed to load services");
    res.status(500).render("pages/public/service", {categories: []});
  }
};

// Route to list services by specific category
exports.getServicesByCategory = async (req, res) => {
  try {
    // Get the category ID from the URL parameter
    const categoryId = req.params.id;

    // Fetch the category details
    const category = await Category.findById(categoryId);

    if (!category) {
      req.flash("error", "Category not found");
      return res.status(404).render("pages/public/services", {
        error: "Category not found.",
        services: [],
        category: null,
      });
    }

    // Fetch services that belong to the requested category
    const services = await Service.find({category: categoryId}).populate(
      "category"
    );

    // Check if there are services for this category
    if (services.length === 0) {
      req.flash("info", `No services found for ${category.name} category`);
      return res.render("pages/public/services", {
        services: [],
        category,
        message: `No services available in ${category.name} category yet.`,
      });
    }

    // Render the services page with the list of services under that category
    res.render("pages/public/services", {services, category});
  } catch (err) {
    console.error("Error fetching services by category:", err);
    req.flash("error", "Failed to load services");
    res.status(500).render("pages/public/services", {
      services: [],
      category: null,
      error: "Server error occurred",
    });
  }
};
