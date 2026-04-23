const Booking = require("../../models/Booking");
const Payment = require("../../models/Payment");

// Get customer bookings
exports.getMyBookings = async (req, res) => {
    try {
        console.log('Fetching bookings for user:', req.user._id);

        const bookings = await Booking.find({ customer: req.user._id })
            .populate("service")
            .populate("provider")
            .populate("providerUserId", "name email phone")
            .sort({ createdAt: -1 });

        console.log(`Found ${bookings.length} bookings for user`);

        res.render("pages/booking/my-bookings", {
            bookings,
            user: req.user,
            title: "My Bookings"
        });
    } catch (err) {
        console.error("Error fetching bookings:", err);
        req.flash('error', 'Unable to fetch bookings');
        res.redirect('/dashboard');
    }
};

// Get booking details
exports.getBookingDetails = async (req, res) => {
    try {
        const bookingId = req.params.id;

        console.log('Fetching booking details for:', bookingId);

        const booking = await Booking.findById(bookingId)
            .populate('service')
            .populate('provider')
            .populate('customer', 'name email phone')
            .populate('providerUserId', 'name email phone');

        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/booking/mybookings');
        }

        // Check if user has access to this booking
        const hasAccess = booking.customer._id.toString() === req.user._id.toString() ||
            (booking.provider.user && booking.provider.user.toString() === req.user._id.toString());

        if (!hasAccess) {
            req.flash('error', 'Unauthorized access');
            return res.redirect('/booking/mybookings');
        }

        console.log('Booking details loaded successfully');

        res.render('pages/booking/details', {
            booking,
            user: req.user,
            title: 'Booking Details'
        });

    } catch (error) {
        console.error("Error fetching booking details:", error);
        req.flash('error', 'Unable to fetch booking details');
        res.redirect('/booking/mybookings');
    }
};

// Booking success page
exports.getBookingSuccess = async (req, res) => {
    try {
        console.log('Loading booking success page for user:', req.user._id);

        let booking = null;
        let payment = null;

        // BUG-023: Include 'pending' — new bookings start as pending, not confirmed
        booking = await Booking.findOne({
            customer: req.user._id,
            status: { $in: ['pending', 'confirmed', 'completed'] }
        })
            .populate('service')
            .populate({
                path: 'provider',
                populate: {
                    path: 'user'
                }
            })
            .sort({ createdAt: -1 });

        if (booking) {
            // Get the most recent payment for this booking
            payment = await Payment.findOne({
                booking: booking._id,
                status: 'completed'
            }).sort({ createdAt: -1 });

            console.log('Found booking and payment for success page');
        } else {
            // BUG-009: Always scope the fallback payment query to this user's bookings
            const userBookingIds = await Booking
                .find({ customer: req.user._id })
                .distinct('_id');

            payment = await Payment.findOne({
                status: 'completed',
                paymentType: 'advance',
                booking: { $in: userBookingIds }
            })
                .populate({
                    path: 'booking',
                    populate: [
                        { path: 'service' },
                        {
                            path: 'provider',
                            populate: { path: 'user' }
                        }
                    ]
                })
                .sort({ createdAt: -1 });

            if (payment && payment.booking) {
                booking = payment.booking;
            }
        }

        // If still no booking/payment found, show a generic success message
        if (!booking && !payment) {
            console.log('No booking or payment found for user:', req.user._id);
        }

        res.render('pages/payment/success', {
            booking: booking || null,
            service: booking ? booking.service : null,
            provider: booking ? booking.provider : null,
            payment: payment || null,
            title: 'Payment Successful',
            user: req.user
        });

    } catch (error) {
        console.error('Error displaying booking success:', error);
        req.flash('error', 'Failed to load booking details');
        res.redirect('/dashboard');
    }
};
