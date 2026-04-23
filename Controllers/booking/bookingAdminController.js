const Booking = require("../../models/Booking");
const { transitionBookingStatus } = require("../../utils/bookingPolicy");

// Get all bookings (admin view)
exports.getAllBookings = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        console.log('Admin fetching all bookings, page:', page);

        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        const bookings = await Booking.find(query)
            .populate('customer', 'name email phone')
            .populate('service', 'name')
            .populate({
                path: 'provider',
                populate: {
                    path: 'user',
                    select: 'name email phone'
                }
            })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalBookings = await Booking.countDocuments(query);
        const totalPages = Math.ceil(totalBookings / limit);

        console.log(`Found ${bookings.length} bookings out of ${totalBookings} total`);

        res.render('pages/admin/bookings', {
            bookings,
            currentPage: parseInt(page),
            totalPages,
            totalBookings,
            selectedStatus: status || 'all',
            title: 'All Bookings - Admin'
        });

    } catch (error) {
        console.error('Error fetching all bookings:', error);
        req.flash('error', 'Failed to load bookings');
        res.redirect('/admin');
    }
};

// Update booking status (admin)
exports.updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, reason, cancellationReason } = req.body;

        console.log(`Admin updating booking ${id} status to:`, status);

        const adminNote = notes || reason;
        const cancelReason = cancellationReason || reason;

        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        const transition = transitionBookingStatus(booking, status, {
            cancellationReason: status === 'cancelled' ? cancelReason : undefined,
            setPaymentCompleted: status === 'completed'
        });

        if (!transition.ok) {
            return res.status(400).json({
                success: false,
                error: transition.error
            });
        }

        if (adminNote) {
            booking.adminNotes = adminNote;
        }

        await booking.save();

        console.log('Booking status updated successfully');

        res.json({
            success: true,
            message: 'Booking status updated successfully',
            booking
        });

    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update booking status'
        });
    }
};