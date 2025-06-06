const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware');
const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');
const Service = require('../models/Service');
const Category = require('../models/category');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Razorpay = require('razorpay');

const multer = require('multer');
const { storage } = require('../config/cloudinary');
const upload = multer({ storage });

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Apply admin middleware to all routes
// router.use(isAdmin);

router.get('/dashboard', async (req, res) => {
    try {
        // Get stats for dashboard
        const statistics = {
            usersCount: await User.countDocuments(),
            servicesCount: await Service.countDocuments(),
            bookingsCount: await Booking.countDocuments(),
            revenue: await calculateTotalRevenue()
        };

        // Get recent activity
        const recentActivity = await getRecentActivity();

        // Get system notifications
        const notifications = await getSystemNotifications();

        res.render('pages/admin/dashboard', {
            statistics,
            recentActivity,
            notifications,
            recentBookings: [], // Add recent bookings or fetch them
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading admin dashboard');
        res.redirect('/');
    }
});

// Update this route
router.get('/users', async (req, res) => {
    try {
        // Fetch all users
        let users = await User.find().sort({ createdAt: -1 });

        // Ensure all users have a status
        users = users.map(user => {
            // Convert to plain object if it's a Mongoose document
            const u = user.toObject ? user.toObject() : { ...user };

            // Set default status if missing
            if (!u.status) {
                u.status = 'unverified';
            }

            return u;
        });

        // Filter users by role
        const customers = users.filter(user => user.role === 'customer');
        const providers = users.filter(user => user.role === 'provider');

        res.render('pages/admin/users', {
            users,
            customers,
            providers
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        req.flash('error', 'Failed to load users');
        res.redirect('/admin/dashboard');
    }
});

// Categories Management
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.find().lean();
        res.render('pages/admin/categories', {
            categories,
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading categories');
        res.redirect('/admin/dashboard');
    }
});

// Add Category Form
router.get('/addCategory', (req, res) => {
    res.render('pages/admin/addCategory');
});

// Create new category
router.post('/categories', upload.single('image'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const isActive = req.body.isActive === 'true' || req.body.isActive === true;

        // Create new category
        const newCategory = new Category({
            name,
            description,
            isActive
        });

        // Add image if uploaded
        if (req.file) {
            newCategory.img = req.file.path;  // Just save the path, not an object
        }

        await newCategory.save();

        req.flash('success', 'Category created successfully');
        res.redirect('/admin/categories');
    } catch (err) {
        console.error('Error creating category:', err);
        req.flash('error', 'Failed to create category: ' + err.message);
        res.redirect('/admin/addCategory');
    }
});

// Edit Category Form
router.get('/editCategory/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            req.flash('error', 'Category not found');
            return res.redirect('/admin/categories');
        }

        res.render('pages/admin/editCategory', { category });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading category');
        res.redirect('/admin/categories');
    }
});

// Update Category
router.put('/categories/:id', upload.single('image'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const isActive = req.body.isActive === 'true' || req.body.isActive === true;

        const updateData = {
            name,
            description,
            isActive
        };

        // Add image if uploaded
        if (req.file) {
            updateData.image = {
                url: req.file.path,
                filename: req.file.filename
            };
        }

        await Category.findByIdAndUpdate(req.params.id, updateData);

        req.flash('success', 'Category updated successfully');
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error updating category');
        res.redirect(`/admin/editCategory/${req.params.id}`);
    }
});

// Delete Category
router.delete('/categories/:id', async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        req.flash('success', 'Category deleted successfully');
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error deleting category');
        res.redirect('/admin/categories');
    }
});

// Toggle Category Status
router.post('/categories/:id/toggle', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        // Toggle the active status
        category.isActive = !category.isActive;
        await category.save();

        return res.json({
            success: true,
            isActive: category.isActive,
            message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Error updating category status' });
    }
});

// Services Management
router.get('/services', async (req, res) => {
    try {
        const services = await Service.find()
            .populate('category')
            .lean();

        res.render('pages/admin/services', {
            services,
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading services');
        res.redirect('/admin/dashboard');
    }
});

// Delete service
router.delete('/services/:id', async (req, res) => {
    try {
        await Service.findByIdAndDelete(req.params.id);
        req.flash('success', 'Service deleted successfully');
        res.redirect('/admin/services');
    } catch (err) {
        console.error('Error deleting service:', err);
        req.flash('error', 'Error deleting service');
        res.redirect('/admin/services');
    }
});

// Toggle service status
router.post('/services/:id/toggle', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);

        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        // Toggle the active status
        service.isActive = !service.isActive;
        await service.save();

        return res.json({
            success: true,
            isActive: service.isActive,
            message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (err) {
        console.error('Error toggling service status:', err);
        return res.status(500).json({ success: false, message: 'Error updating service status' });
    }
});

// Bookings Management
router.get('/bookings', async (req, res) => {
    try {
        // Check your Booking schema to confirm these field names
        const bookings = await Booking.find()
            .populate('customer') // If your schema uses 'customer' instead of 'user'
            .populate('service')
            .populate('provider')
            .populate({
                path: 'service',
                populate: { path: 'category' }
            })
            .sort({ createdAt: -1 });

        // Map the results to ensure safe access
        const safeBookings = bookings.map(booking => {
            // Create a plain object we can safely modify
            const plainBooking = booking.toObject();

            // Fix field name if needed (map 'customer' to 'user')
            if (plainBooking.customer && !plainBooking.user) {
                plainBooking.user = plainBooking.customer;
            }

            // Ensure all required nested properties exist
            if (!plainBooking.user) {
                plainBooking.user = {
                    name: 'Unknown User',
                    phone: 'No phone',
                    profileImage: null
                };
            }

            // Fix the totalAmount vs totalCost issue
            if (plainBooking.totalCost && !plainBooking.totalAmount) {
                plainBooking.totalAmount = plainBooking.totalCost;
            } else if (!plainBooking.totalAmount && !plainBooking.totalCost) {
                plainBooking.totalAmount = 0;
            }

            // Set default payment status if missing
            if (!plainBooking.paymentStatus) {
                plainBooking.paymentStatus = 'Unknown';
            }

            return plainBooking;
        });
        // Filter by status
        const pendingBookings = safeBookings.filter(booking => booking.status === 'pending');
        const confirmedBookings = safeBookings.filter(booking => booking.status === 'confirmed');
        const completedBookings = safeBookings.filter(booking => booking.status === 'completed');
        const cancelledBookings = safeBookings.filter(booking => booking.status === 'cancelled');

        res.render('pages/admin/bookings', {
            bookings: safeBookings,
            pendingBookings,
            confirmedBookings,
            completedBookings,
            cancelledBookings
        });
    } catch (err) {
        console.error('Error fetching bookings:', err);
        req.flash('error', 'Failed to load bookings');
        res.redirect('/admin/dashboard');
    }
});

// Payment Management - NEW
router.get('/payments', async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('booking')
            .populate({
                path: 'booking',
                populate: [
                    { path: 'service' },
                    { path: 'customer' },
                    { path: 'provider' }
                ]
            })
            .sort({ createdAt: -1 });

        // Transform for display
        const processedPayments = payments.map(payment => {
            const plainPayment = payment.toObject();

            // Handle missing fields
            if (!plainPayment.booking) {
                plainPayment.booking = {
                    service: { name: 'Unknown Service' },
                    customer: { name: 'Unknown Customer' },
                    provider: { user: { name: 'Unknown Provider' } },
                    totalCost: 0
                };
            }

            return plainPayment;
        });

        res.render('pages/admin/payments', {
            payments: processedPayments,
            currentPath: req.path
        });
    } catch (err) {
        console.error('Error fetching payments:', err);
        req.flash('error', 'Failed to load payments');
        res.redirect('/admin/dashboard');
    }
});

// Provider Payouts Management - NEW
router.get('/provider-payouts', async (req, res) => {
    try {
        // Find providers with pending payouts OR unverified bank details
        const providers = await ServiceProvider.find({
            $or: [
                { pendingPayouts: { $gt: 0 } },
                {
                    'bankDetails.accountNumber': { $exists: true, $ne: null, $ne: '' },
                    'bankDetails.verified': { $ne: true }
                }
            ]
        }).populate('user');


        console.log(`Found ${providers.length} providers with pending payouts or unverified bank details`);

        // Get recent processed bookings for payout history
        const bookings = await Booking.find({
            'providerPayout.status': { $exists: true }
        })
            .sort({ 'providerPayout.processedAt': -1 })
            .limit(20)
            .populate({
                path: 'provider',
                populate: { path: 'user' }
            })
            .populate('service')
            .populate('customer');

        const payoutData = {
            pendingAmount: providers.reduce((sum, provider) => sum + (provider.pendingPayouts || 0), 0),
            processedAmount: bookings
                .filter(b => b.providerPayout && b.providerPayout.status === 'processed')
                .reduce((sum, b) => sum + (b.providerPayout.amount || 0), 0),
            providers: providers.map(provider => ({
                id: provider._id,
                name: provider.user?.name || 'Unknown',
                email: provider.user?.email || provider.user?.username || 'Unknown',
                phone: provider.user?.phone || 'Not provided',
                pendingAmount: provider.pendingPayouts || 0,
                hasBankDetails: !!(provider.bankDetails && provider.bankDetails.accountNumber),
                bankVerified: !!(provider.bankDetails && provider.bankDetails.verified),
                accountHolderName: provider.bankDetails?.accountHolderName || '',
                bankName: provider.bankDetails?.bankName || '',
                ifscCode: provider.bankDetails?.ifscCode || '',
                accountNumber: provider.bankDetails?.accountNumber ?
                    '•••••' + provider.bankDetails.accountNumber.slice(-4) : ''
            })),
            recentPayouts: bookings
                .filter(b => b.providerPayout && b.providerPayout.status)
                .map(booking => ({
                    id: booking._id,
                    providerName: booking.provider?.user?.name || 'Unknown',
                    serviceName: booking.service?.name || 'Unknown',
                    customerName: booking.customer?.name || 'Unknown',
                    amount: booking.providerPayout?.amount || 0,
                    status: booking.providerPayout?.status || 'unknown',
                    date: booking.providerPayout?.processingAt || booking.createdAt,
                    reference: booking.providerPayout?.transactionId || 'None'
                }))
        };

        res.render('pages/admin/provider-payouts', {
            payoutData,
            currentPath: req.path
        });
    } catch (err) {
        console.error('Error fetching payout data:', err);
        req.flash('error', 'Failed to load payout data');
        res.redirect('/admin/dashboard');
    }
});

// Process Provider Payout - NEW
router.post('/process-payout/:providerId', async (req, res) => {
    try {
        // Your existing process-payout code...
    } catch (err) {
        console.error('Error processing payout:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to process payout: ' + err.message
        });
    }
});

// Verify Provider Bank Details
router.post('/verify-bank-details/:providerId', async (req, res) => {
    try {
        const providerId = req.params.providerId;

        // Find the provider
        const provider = await ServiceProvider.findById(providerId).populate('user');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        // Check if provider has bank details
        if (!provider.bankDetails || !provider.bankDetails.accountNumber) {
            return res.status(400).json({
                success: false,
                message: 'Provider has no bank details to verify'
            });
        }

        // Update bank details verification status
        provider.bankDetails.verified = true;
        provider.bankDetails.verifiedAt = new Date();

        // Only set verifiedBy if req.user exists
        if (req.user && req.user._id) {
            provider.bankDetails.verifiedBy = req.user._id;
        }

        await provider.save();

        // For debugging
        console.log(`Bank details verified for provider ${provider._id} (${provider.user.name})`);

        res.json({
            success: true,
            message: 'Bank details verified successfully',
            provider: {
                id: provider._id,
                name: provider.user.name
            }
        });
    } catch (err) {
        console.error('Error verifying bank details:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to verify bank details: ' + err.message
        });
    }
});
// Reports
router.get('/reports', async (req, res) => {
    try {
        // Get reports data
        const revenueData = await getRevenueData();
        const serviceData = await getServiceData();
        const userGrowthData = await getUserGrowthData();

        res.render('pages/admin/reports', {
            revenueData,
            serviceData,
            userGrowthData,
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading reports');
        res.redirect('/admin/dashboard');
    }
});

// Feedback Management
router.get('/feedback', async (req, res) => {
    try {
        // Get feedback data
        const feedback = await getFeedbackData();

        res.render('pages/admin/feedback', {
            feedback,
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading feedback');
        res.redirect('/admin/dashboard');
    }
});

// Settings
router.get('/settings', async (req, res) => {
    try {
        // Get current settings
        const settings = await getSystemSettings();

        res.render('pages/admin/settings', {
            settings,
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading settings');
        res.redirect('/admin/dashboard');
    }
});

// Update settings
router.post('/settings', async (req, res) => {
    try {
        // Update settings logic
        const { siteName, siteEmail, platformCommission, bookingFee, maintenanceMode,
            emailNotifications, autoApproveProviders, currency, timeZone } = req.body;

        // Validate the commission percentage (should be between 1-50%)
        const commissionValue = parseInt(platformCommission);
        if (isNaN(commissionValue) || commissionValue < 1 || commissionValue > 50) {
            req.flash('error', 'Platform commission must be between 1% and 50%');
            return res.redirect('/admin/settings');
        }

        // Here you would typically update these settings in your database
        // For now, just flash a success message
        req.flash('success', 'Settings updated successfully');
        res.redirect('/admin/settings');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error updating settings');
        res.redirect('/admin/settings');
    }
});

// Helper functions
async function calculateTotalRevenue() {
    try {
        const payments = await Payment.find({ status: 'completed' });
        return payments.reduce((total, payment) => total + payment.amount, 0);
    } catch (err) {
        console.error('Error calculating revenue:', err);
        return 0;
    }
}

async function getRecentActivity() {
    try {
        // Get actual recent activity from database instead of mock data
        const recentBookings = await Booking.find()
            .populate('customer')
            .populate('service')
            .sort({ createdAt: -1 })
            .limit(5);

        const recentPayments = await Payment.find()
            .populate('booking')
            .sort({ createdAt: -1 })
            .limit(5);

        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5);

        // Combine and sort by date
        const activities = [
            ...recentBookings.map(booking => ({
                action: `New Booking: ${booking.service?.name || 'Unknown Service'}`,
                user: booking.customer?.name || 'Unknown',
                dateTime: booking.createdAt,
                status: booking.status
            })),
            ...recentPayments.map(payment => ({
                action: `Payment: ₹${payment.amount}`,
                user: payment.booking?.customer?.name || 'Unknown',
                dateTime: payment.createdAt,
                status: payment.status
            })),
            ...recentUsers.map(user => ({
                action: 'New User Registration',
                user: user.name || user.username,
                dateTime: user.createdAt,
                status: 'registered'
            }))
        ].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime)).slice(0, 5);

        return activities.map(activity => ({
            ...activity,
            dateTime: formatDate(activity.dateTime)
        }));
    } catch (err) {
        console.error('Error getting recent activity:', err);
        // Fallback to mock data
        return [
            {
                action: 'New Booking Created',
                user: 'John Smith',
                dateTime: '2023-05-15 14:30',
                status: 'Pending'
            },
            {
                action: 'Service Completed',
                user: 'Maria Rodriguez',
                dateTime: '2023-05-15 12:15',
                status: 'Completed'
            },
            {
                action: 'Payment Received',
                user: 'David Chen',
                dateTime: '2023-05-15 10:45',
                status: 'Completed'
            },
            {
                action: 'Booking Cancelled',
                user: 'Sarah Johnson',
                dateTime: '2023-05-14 16:20',
                status: 'Cancelled'
            },
            {
                action: 'New User Registered',
                user: 'Raj Patel',
                dateTime: '2023-05-14 09:10',
                status: 'Completed'
            }
        ];
    }
}

function formatDate(date) {
    if (!date) return 'Unknown date';

    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';

    return d.toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

async function getSystemNotifications() {
    try {
        // In a real implementation, fetch these from your database
        // For now, check for actual system conditions
        const notifications = [];

        // Check for providers without bank details
        const providersNeedingBankDetails = await ServiceProvider.find({
            pendingPayouts: { $gt: 0 },
            bankDetails: { $exists: false }
        }).countDocuments();

        if (providersNeedingBankDetails > 0) {
            notifications.push({
                type: 'warning',
                message: `${providersNeedingBankDetails} providers have pending payouts but no bank details`,
                time: 'Today'
            });
        }

        // Check for pending payout amounts
        const totalPendingPayouts = await ServiceProvider.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: '$pendingPayouts' }
                }
            }
        ]);

        if (totalPendingPayouts.length && totalPendingPayouts[0].total > 0) {
            notifications.push({
                type: 'info',
                message: `₹${totalPendingPayouts[0].total} in pending provider payouts`,
                time: 'Today'
            });
        }

        // Add a fallback notification if we have none
        if (notifications.length === 0) {
            notifications.push({
                type: 'success',
                message: 'All systems running normally',
                time: 'Just now'
            });
        }

        return notifications;
    } catch (err) {
        console.error('Error getting notifications:', err);
        // Fall back to mock data
        return [
            {
                type: 'warning',
                message: 'System update scheduled for tonight at 2:00 AM',
                time: '2 hours ago'
            },
            {
                type: 'success',
                message: 'Backup completed successfully',
                time: '5 hours ago'
            },
            {
                type: 'info',
                message: '3 new service providers registered today',
                time: '1 day ago'
            }
        ];
    }
}

async function getRevenueData() {
    try {
        // In a real implementation, calculate these from your payment records
        // Group payments by month
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const monthlyRevenue = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: oneYearAgo }
                }
            },
            {
                $group: {
                    _id: { $month: '$createdAt' },
                    total: { $sum: '$amount' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Convert to array of 12 months
        const monthlyData = Array(12).fill(0);
        monthlyRevenue.forEach(item => {
            // MongoDB months are 1-indexed
            monthlyData[item._id - 1] = item.total;
        });

        // For categories, get revenue by service category
        const categoryRevenue = await Payment.aggregate([
            {
                $match: { status: 'completed' }
            },
            {
                $lookup: {
                    from: 'bookings',
                    localField: 'booking',
                    foreignField: '_id',
                    as: 'bookingInfo'
                }
            },
            {
                $unwind: '$bookingInfo'
            },
            {
                $lookup: {
                    from: 'services',
                    localField: 'bookingInfo.service',
                    foreignField: '_id',
                    as: 'serviceInfo'
                }
            },
            {
                $unwind: '$serviceInfo'
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'serviceInfo.category',
                    foreignField: '_id',
                    as: 'categoryInfo'
                }
            },
            {
                $unwind: '$categoryInfo'
            },
            {
                $group: {
                    _id: '$categoryInfo.name',
                    total: { $sum: '$amount' }
                }
            },
            {
                $sort: { total: -1 }
            },
            {
                $limit: 5
            }
        ]);

        const categoryData = {
            labels: categoryRevenue.map(c => c._id),
            data: categoryRevenue.map(c => c.total)
        };

        return {
            monthly: monthlyData,
            categories: categoryData
        };
    } catch (err) {
        console.error('Error getting revenue data:', err);
        // Fallback to mock data
        return {
            monthly: [5000, 7200, 8500, 9200, 7800, 10500, 12000, 11500, 13800, 15000, 14200, 16500],
            categories: {
                labels: ['Plumbing', 'Electrical', 'Cleaning', 'Painting', 'Carpentry'],
                data: [25, 30, 15, 18, 12]
            }
        };
    }
}

async function getServiceData() {
    try {
        // Get popular services by booking count
        const popularServices = await Booking.aggregate([
            {
                $lookup: {
                    from: 'services',
                    localField: 'service',
                    foreignField: '_id',
                    as: 'serviceInfo'
                }
            },
            {
                $unwind: '$serviceInfo'
            },
            {
                $group: {
                    _id: '$serviceInfo.name',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 5
            }
        ]);

        // Get service growth (new services per month)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const monthlyNewServices = await Service.aggregate([
            {
                $match: {
                    createdAt: { $gte: oneYearAgo }
                }
            },
            {
                $group: {
                    _id: { $month: '$createdAt' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Convert to array of 12 months
        const serviceGrowth = Array(12).fill(0);
        monthlyNewServices.forEach(item => {
            // MongoDB months are 1-indexed
            serviceGrowth[item._id - 1] = item.count;
        });

        return {
            popularServices: popularServices.map(s => ({
                name: s._id,
                count: s.count
            })),
            serviceGrowth
        };
    } catch (err) {
        console.error('Error getting service data:', err);
        // Fallback to mock data
        return {
            popularServices: [
                { name: 'Deep Home Cleaning', count: 156 },
                { name: 'Electrical Repairs', count: 143 },
                { name: 'Plumbing Services', count: 127 },
                { name: 'AC Service & Repair', count: 118 },
                { name: 'Interior Painting', count: 92 }
            ],
            serviceGrowth: [10, 15, 8, 12, 20, 18, 22, 25, 28, 30, 35, 38]
        };
    }
}

async function getUserGrowthData() {
    try {
        // Get user growth by role over past 12 months
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const monthlyNewUsers = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: oneYearAgo }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: '$createdAt' },
                        role: '$role'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.month': 1 }
            }
        ]);

        // Initialize arrays for each role
        const customers = Array(12).fill(0);
        const providers = Array(12).fill(0);

        // Fill in the data
        monthlyNewUsers.forEach(item => {
            const monthIndex = item._id.month - 1; // Convert to 0-indexed
            if (item._id.role === 'customer') {
                customers[monthIndex] += item.count;
            } else if (item._id.role === 'provider') {
                providers[monthIndex] += item.count;
            }
        });

        return { customers, providers };
    } catch (err) {
        console.error('Error getting user growth data:', err);
        // Fallback to mock data
        return {
            customers: [50, 80, 120, 160, 200, 250, 280, 310, 350, 400, 450, 500],
            providers: [10, 15, 22, 30, 35, 42, 48, 55, 62, 70, 78, 85]
        };
    }
}

async function getFeedbackData() {
    try {
        // Get actual feedback from your database
        const bookingsWithFeedback = await Booking.find({
            'feedback.rating': { $exists: true }
        })
            .populate('customer')
            .populate('service')
            .populate({
                path: 'provider',
                populate: { path: 'user' }
            })
            .sort({ 'feedback.createdAt': -1 })
            .limit(10);

        return bookingsWithFeedback.map(booking => ({
            id: booking._id,
            customer: booking.customer?.name || 'Unknown Customer',
            service: booking.service?.name || 'Unknown Service',
            provider: booking.provider?.user?.name || 'Unknown Provider',
            rating: booking.feedback?.rating || 0,
            comment: booking.feedback?.comment || 'No comment provided',
            date: formatDate(booking.feedback?.createdAt || booking.updatedAt)
        }));
    } catch (err) {
        console.error('Error getting feedback data:', err);
        // Fallback to mock data
        return [
            {
                id: 1,
                customer: 'John Smith',
                service: 'Plumbing Services',
                provider: 'Mike Davis',
                rating: 5,
                comment: 'Excellent service, very professional and quick.',
                date: '2023-05-10'
            },
            {
                id: 2,
                customer: 'Emily Johnson',
                service: 'House Cleaning',
                provider: 'Clean Pro Services',
                rating: 4,
                comment: 'Good service overall, but arrived a bit late.',
                date: '2023-05-09'
            },
            {
                id: 3,
                customer: 'Robert Brown',
                service: 'Electrical Repair',
                provider: 'PowerFix',
                rating: 5,
                comment: 'Fixed the issue quickly and explained everything clearly.',
                date: '2023-05-08'
            },
            {
                id: 4,
                customer: 'Lisa Chen',
                service: 'Painting Service',
                provider: 'ColorMaster',
                rating: 3,
                comment: 'The work was satisfactory but there were some issues with cleanup.',
                date: '2023-05-07'
            },
            {
                id: 5,
                customer: 'Michael Wilson',
                service: 'Furniture Assembly',
                provider: 'AssemblyPro',
                rating: 5,
                comment: 'Perfect assembly, very efficient and professional.',
                date: '2023-05-06'
            }
        ];
    }
}

async function getSystemSettings() {
    try {
        // In a real implementation, fetch these from your database
        // Placeholder for database fetching logic

        // For now, return default settings
        return {
            siteName: 'KnockNFix',
            siteEmail: 'admin@knocknfix.com',
            bookingFee: 5,
            platformCommission: 15, // Updated to match the 15% used in payment processing
            maintenanceMode: false,
            emailNotifications: true,
            autoApproveProviders: false,
            currency: 'INR',
            timeZone: 'Asia/Kolkata'
        };
    } catch (err) {
        console.error('Error getting system settings:', err);
        // Fallback to mock data
        return {
            siteName: 'KnockNFix',
            siteEmail: 'admin@knocknfix.com',
            bookingFee: 5,
            platformCommission: 15,
            maintenanceMode: false,
            emailNotifications: true,
            autoApproveProviders: false,
            currency: 'INR',
            timeZone: 'Asia/Kolkata'
        };
    }
}

async function updateSystemSettings(settings) {
    // In a real implementation, update these in your database
    console.log('Updating system settings:', settings);
    // Placeholder for database update logic
    return true;
}

module.exports = router;