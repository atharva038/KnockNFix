const Booking = require("../../models/Booking");
const { processProviderPayout } = require("../../utils/paymentAutomation");
const { transitionBookingStatus } = require("../../utils/bookingPolicy");

// Complete booking (triggers provider payout)
exports.completeBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;

        console.log('Completing booking:', bookingId);

        // Find booking and verify ownership
        const booking = await Booking.findById(bookingId)
            .populate('customer')
            .populate('provider');

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: "Booking not found"
            });
        }

        // Check if user is the customer or provider
        const isCustomer = booking.customer._id.toString() === req.user._id.toString();
        const isProvider = booking.provider.user &&
            booking.provider.user.toString() === req.user._id.toString();

        if (!isCustomer && !isProvider) {
            return res.status(403).json({
                success: false,
                error: "Unauthorized to complete this booking"
            });
        }

        const transition = transitionBookingStatus(booking, 'completed', {
            setPaymentCompleted: true
        });

        // BUG-007: Verify final payment was received before completing + triggering payout
        if (!booking.finalPayment?.paid) {
            return res.status(400).json({
                success: false,
                error: 'Final payment must be completed before marking this booking as done.'
            });
        }

        if (!transition.ok) {
            return res.status(400).json({
                success: false,
                error: transition.error
            });
        }


        await booking.save();

        console.log('Booking status updated to completed');

        // Trigger automated provider payout
        try {
            await processProviderPayout(bookingId);
            console.log(`✅ Automated payout triggered for booking ${bookingId}`);
        } catch (payoutError) {
            console.error('Provider payout failed:', payoutError);
            // Don't fail the completion, just log the error
        }

        res.json({
            success: true,
            message: 'Booking completed and provider payout processed',
            automated: 'Provider payout processed automatically'
        });

    } catch (error) {
        console.error("Error completing booking:", error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete booking'
        });
    }
};

// Cancel booking
// Remove the time check completely
exports.cancelBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { reason } = req.body;

        console.log('Cancelling booking:', bookingId);

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: "Booking not found"
            });
        }

        // Check if user owns this booking
        if (booking.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: "Unauthorized"
            });
        }

        // No time restrictions - allow cancellation anytime.
        // A stricter cancellation window can be layered here later.
        const transition = transitionBookingStatus(booking, 'cancelled', {
            cancellationReason: reason || 'No reason provided'
        });

        if (!transition.ok) {
            return res.status(400).json({
                success: false,
                error: transition.error
            });
        }

        await booking.save();

        console.log('Booking cancelled successfully');

        res.json({
            success: true,
            message: "Booking cancelled successfully"
        });

    } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).json({
            success: false,
            error: "Failed to cancel booking"
        });
    }
};
