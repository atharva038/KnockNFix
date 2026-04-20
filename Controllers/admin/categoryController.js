const Category = require("../../models/category");

const categoryController = {
  showCategories: async (req, res) => {
    try {
      const categories = await Category.find().lean();
      return res.render("pages/admin/categories", {
        categories,
        currentPath: req.path,
        title: "Category Management - Admin",
      });
    } catch (err) {
      console.error("Error loading categories:", err);
      req.flash("error", "Error loading categories");
      return res.redirect("/admin/dashboard");
    }
  },

  showAddCategory: (req, res) => {
    res.render("pages/admin/addCategory", {
      title: "Add Category - Admin",
    });
  },

  createCategory: async (req, res) => {
    try {
      const { name, description } = req.body;
      const isActive =
        req.body.isActive === "true" || req.body.isActive === true;

      const newCategory = new Category({
        name,
        description,
        isActive,
      });

      if (req.file) {
        newCategory.img = req.file.path;
      }

      await newCategory.save();
      req.flash("success", "Category created successfully");
      return res.redirect("/admin/categories");
    } catch (err) {
      console.error("Error creating category:", err);
      req.flash("error", "Failed to create category: " + err.message);
      return res.redirect("/admin/addCategory");
    }
  },

  showEditCategory: async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) {
        req.flash("error", "Category not found");
        return res.redirect("/admin/categories");
      }
      return res.render("pages/admin/editCategory", {
        category,
        title: "Edit Category - Admin",
      });
    } catch (err) {
      console.error("Error loading category:", err);
      req.flash("error", "Error loading category");
      return res.redirect("/admin/categories");
    }
  },

  updateCategory: async (req, res) => {
    try {
      const { name, description } = req.body;
      const isActive =
        req.body.isActive === "true" || req.body.isActive === true;

      const updateData = { name, description, isActive };

      if (req.file) {
        updateData.image = {
          url: req.file.path,
          filename: req.file.filename,
        };
      }

      await Category.findByIdAndUpdate(req.params.id, updateData);
      req.flash("success", "Category updated successfully");
      return res.redirect("/admin/categories");
    } catch (err) {
      console.error("Error updating category:", err);
      req.flash("error", "Error updating category");
      return res.redirect(`/admin/editCategory/${req.params.id}`);
    }
  },

  deleteCategory: async (req, res) => {
    try {
      await Category.findByIdAndDelete(req.params.id);
      req.flash("success", "Category deleted successfully");
      return res.redirect("/admin/categories");
    } catch (err) {
      console.error("Error deleting category:", err);
      req.flash("error", "Error deleting category");
      return res.redirect("/admin/categories");
    }
  },

  toggleCategoryStatus: async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) {
        return res
          .status(404)
          .json({ success: false, message: "Category not found" });
      }

      category.isActive = !category.isActive;
      await category.save();

      return res.json({
        success: true,
        isActive: category.isActive,
        message: `Category ${
          category.isActive ? "activated" : "deactivated"
        } successfully`,
      });
    } catch (err) {
      console.error("Error toggling category status:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error updating category status" });
    }
  },
};

module.exports = categoryController;
