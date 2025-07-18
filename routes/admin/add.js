const express = require("express");
const router = express.Router();
const { upload } = require("../../config/cloudinary");
const Service = require("../../models/Service");
const Category = require("../../models/category");
const Booking = require('../../models/Booking'); // ✅ Ensure you import Booking model
const User = require("../../models/User"); // <-- Import User model
const ExcelJS = require('exceljs');

// ✅ Add Category Page (if needed)
router.get("/admin/addCategory", (req, res) => {
    console.log("✅ GET /admin/addCategory route hit");
    res.render("pages/admin/addCategory");
});

// ✅ Add Service Page
router.get("/admin/addService", async (req, res) => {
    const categories = await Category.find();
    res.render("pages/admin/addService", { categories });
});

// ✅ Create New Category
router.post("/admin/category/add", upload.single("image"), async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!req.file) {
            return res.status(400).send("Image is required");
        }

        const newCategory = new Category({
            name,
            description,
            img: req.file.path, // Cloudinary URL
        });

        await newCategory.save();
        res.redirect("/admin/categories");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error adding category");
    }
});
// ✅ Create New Service
router.post("/admin/service/add", upload.single("image"), async (req, res) => {
    try {
        // const { name, description, price, duration, category, tags } = req.body;
        // const img = req.file.path; // Cloudinary URL

        // if (!name || !description || !price || !duration || !category || !img) {
        //     return res.status(400).json({ error: 'All required fields must be provided' });
        // }

        const newService = new Service({
            name: req.body.name, // ✅ match your form input
            category: req.body.category,
            description: req.body.description,
            price: req.body.price,
            duration: req.body.duration,
            tags: Array.isArray(req.body.tags) ? req.body.tags : req.body.tags ? [req.body.tags] : [],
            img: req.file.path
    });


        await newService.save();
        res.redirect('/admin/services');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding service');
    }
});


// ✅ Show All Categories
router.get("/admin/categories", async (req, res) => {
    try {
        const categories = await Category.find();        
        // router.post('/admin/categories/:id/toggle', async (req, res) => {
        //     try {
        //         const category = await Category.findById(req.params.id);
        //         if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        
        //         category.isActive = !category.isActive;
        //         await category.save();
        
        //         res.json({ success: true, isActive: category.isActive });
        //     } catch (err) {
        //         res.status(500).json({ success: false, message: 'Server error' });
        //     }
        // });
        const categoriesWithServiceCount = await Promise.all(
        categories.map(async (category) => {
            const serviceCount = await Service.countDocuments({ category: category._id });
            return {
                ...category.toObject(),
                serviceCount,
        };
    }),
);
        router.get('/user/:userId', adminController.showUserDetails);


        res.render("pages/admin/categories", { 
            categories: categoriesWithServiceCount 
        });
    } catch (err) {
        console.error("Error loading categories:", err);
        res.status(500).send("Error fetching categories");
    }
});

// ✅ Show Edit Category Page
router.get("/admin/category/edit/:id", async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        res.render("pages/admin/editCategory", { category });
    } catch (err) {
        res.status(500).send("Error fetching category");
    }
});

// ✅ Update Category
router.post("/admin/category/edit/:id", async (req, res) => {
    try {
        const { name, description, image } = req.body;
        await Category.findByIdAndUpdate(req.params.id, {
            name,
            description,
            image,
        });
        res.redirect("/admin/categories");
    } catch (err) {
        res.status(500).send("Error updating category");
    }
});
router.post('/admin/categories/:id/toggle', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

        category.isActive = !category.isActive;
        await category.save();

        res.json({ success: true, isActive: category.isActive });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ Delete Category
router.post("/admin/category/delete/:id", async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.redirect("/admin/categories");
    } catch (err) {
        res.status(500).send("Error deleting category");
    }
});
router.post('/admin/services/:id/toggle', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

        service.isActive = !service.isActive;
        await service.save();

        res.json({ success: true, isActive: service.isActive });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// ✅ Show Edit Service Page
router.get('/admin/editService/:id', async (req, res) => {
    const service = await Service.findById(req.params.id).populate('category');
    const categories = await Category.find(); // <-- This fetches all categories
    res.render('pages/admin/editService', { service, categories});
});

// ✅ Show All Services
// router.get('/admin/services', async (req, res) => {
//     const services = await Service.find().populate('category'); // <-- This is critical!
//     res.render('pages/admin/services', { services });
// });
router.get("/admin/services", async (req, res) => {
    try {
        const services = await Service.find().populate("category");
        
        // Nested POST route to toggle service status
        router.post("/admin/services/:id/toggle", async (req, res) => {
            try {
                const service = await Service.findById(req.params.id);
                if (!service) {
                    return res.status(404).json({ success: false, message: "Service not found" });
                }

                service.isActive = !service.isActive;
                await service.save();

                res.json({ success: true, isActive: service.isActive });
            } catch (err) {
                res.status(500).json({ success: false, message: "Server error" });
            }
        });

        res.render("pages/admin/services", { services });
    } catch (err) {
        res.status(500).send("Error fetching services");
    }
});



// // Update Service
// router.post('/admin/editService/:id', async (req, res) => {
//     try {
//         const { name, description, price, duration, category, tags } = req.body;
//         await Service.findByIdAndUpdate(req.params.id, {
//             name,
//             description,
//             price,
//             duration, // <-- this must match your model field!
//             category,
//             tags: tags ? tags.split(',').map(t => t.trim()) : [],
//             img,
//         });
//         res.redirect('/admin/services');
//     } catch (err) {
//         res.status(500).send('Error updating service');
//     }
// });

// POST: Update Service
router.post('/admin/editService/:id', upload.single('image'), async (req, res) => {
    try {
        const updateData = {
            name: req.body.name,
            category: req.body.category,
            description: req.body.description,
            price: req.body.price,
            duration: req.body.duration,
            tags: Array.isArray(req.body.tags)
                ? req.body.tags
                : req.body.tags
                ? req.body.tags.split(',').map(tag => tag.trim())
                : [],
        };

        // ✅ Add image only if uploaded
        if (req.file && req.file.path) {
            updateData.img = req.file.path;
        }

        await Service.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/admin/services');
    } catch (err) {
        console.error("Error updating service:", err);
        res.status(500).send('Error updating service');
    }
});


router.put('/admin/category/update/:id', upload.single('image'), async (req, res) => {
    try {
        const { name, description, isActive, displayOrder } = req.body;
        const updateData = {
            name,
            description,
            isActive: isActive === "true", // convert string to boolean
            displayOrder
        };

        // Handle image upload
        if (req.file && req.file.path) {
            updateData.image = { url: req.file.path };
        }
        // Handle remove image
        if (req.body.removeImage) {
            updateData.image = null;
        }

        await Category.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/admin/categories'); // <-- Redirect to categories page after update
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating category');
    }
});

// Update user status
router.post('/admin/users/:id/status', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.status = req.body.status;
        await user.save();

        res.json({ success: true, status: user.status });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// View User Details
router.get('/admin/users/:id', async (req, res) => {
    try {
        // const user = await User.findById(req.params.id);
        // if (!user) {
        //     return res.status(404).render('404', { title: 'User Not Found' });
        // }
        const user = await User.findById(req.params.id);
        let bookings = [];
        let providerServices = [];

        if (user.role === 'user') {
            // ✅ Get all bookings made by the user
            bookings = await Booking.find({ user: user._id }).populate('service');
        }

        if (user.role === 'provider') {
            // ✅ Get all services by this provider
            providerServices = await Service.find({ provider: user._id });

            // Optionally add booking count for each service
            for (let service of providerServices) {
                service.bookingCount = await Booking.countDocuments({ service: service._id });
            }
        }
        res.render('pages/admin/viewUser', { 
            user, 
            bookings,           // for regular user
            providerServices 
    });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// GET Edit User Page
router.get('/admin/users/edit/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('User not found');
        res.render('pages/admin/editUser', { user });
    } catch (err) {
        res.status(500).send('Error loading edit user page');
    }
});

// POST Edit User (update)
router.post('/admin/users/edit/:id', async (req, res) => {
    try {
        const { name, email, phone, role, status } = req.body;
        await User.findByIdAndUpdate(req.params.id, { name, email, phone, role, status });
        res.redirect('/admin/users');
    } catch (err) {
        res.status(500).send('Error updating user');
    }
});

// Export Users to Excel
router.get('/admin/users/export', async (req, res) => {
    try {
        const users = await User.find();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Users');

        // Add header row
        worksheet.addRow(['Name', 'Email', 'Phone', 'Role', 'Status', 'Joined']);

        // Add user data
        users.forEach(user => {
            worksheet.addRow([
                user.name,
                user.email,
                user.phone,
                user.role,
                user.status,
                user.createdAt ? user.createdAt.toLocaleString() : ''
            ]);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});
 
router.delete('/admin/users/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/admin/users');
    } catch (err) {
        res.status(500).send('Error deleting user');
    }
});

module.exports = router;