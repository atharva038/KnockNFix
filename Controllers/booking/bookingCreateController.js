const Booking = require("../../models/Booking");
const Service = require("../../models/Service");
const User = require("../../models/User");
const ServiceProvider = require("../../models/ServiceProvider");

// Create booking after payment confirmation
exports.createBooking = async (req, res) => {
    try {
        const {
            serviceId,
            providerId,
            date,
            detailedAddress,
            notes,
            cost,
            paymentId,
            latitude,
            longitude
        } = req.body;

        console.log('Creating booking with data:', req.body);

        // Verify service and provider exist
        const [service, provider] = await Promise.all([
            Service.findById(serviceId),
            ServiceProvider.findById(providerId).populate('user')
        ]);

        if (!service || !provider) {
            return res.status(404).json({
                success: false,
                error: "Service or provider not found"
            });
        }

        // Create the booking
        const booking = new Booking({
            customer: req.user._id,
            service: serviceId,
            provider: providerId,
            providerUserId: provider.user._id,
            date: new Date(date),
            location: {
                type: 'Point',
                coordinates: [
                    parseFloat(longitude) || 0,
                    parseFloat(latitude) || 0
                ]
            },
            address: detailedAddress,
            notes: notes || "",
            cost: parseFloat(cost),
            totalCost: parseFloat(cost),
            status: 'pending',
            paymentStatus: 'partially_paid',
            advancePayment: {
                paid: true,
                paymentId: paymentId,
                amount: Math.round(cost * 0.15)
            },
            finalPayment: {
                paid: false,
                amount: cost - Math.round(cost * 0.15)
            }
        });

        await booking.save();

        console.log('Booking created successfully:', booking._id);

        res.json({
            success: true,
            bookingId: booking._id,
            message: "Booking created successfully"
        });

    } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).json({
            success: false,
            error: "Server error. Please try again later."
        });
    }
};

// Booking confirmation page (before payment)
exports.confirmBooking = async (req, res) => {
    try {
        const {
            serviceId,
            providerId,
            date,
            addressId,
            latitude,
            longitude,
            detailedAddress,
            notes
        } = req.body;

        console.log('Confirming booking with data:', req.body);

        // Get service and provider details
        const [service, provider] = await Promise.all([
            Service.findById(serviceId),
            ServiceProvider.findById(providerId)
                .populate('user')
                .populate('servicesOffered')
        ]);

        if (!service || !provider) {
            req.flash('error', 'Service or provider not found');
            return res.redirect('/services');
        }

        // Get user addresses
        const user = await User.findById(req.user._id);
        let coordinates = { latitude, longitude };

        // Handle saved addresses
        if (addressId && addressId !== 'new' && user.addresses) {
            const addressIndex = parseInt(addressId);
            if (user.addresses[addressIndex] && user.addresses[addressIndex].coordinates) {
                coordinates = {
                    latitude: user.addresses[addressIndex].coordinates.latitude,
                    longitude: user.addresses[addressIndex].coordinates.longitude
                };
            }
        }

        // Find service details from provider's offerings
        let serviceDetails = null;
        for (const category of provider.servicesOffered) {
            if (category.services && Array.isArray(category.services)) {
                const foundService = category.services.find(s =>
                    s.service && s.service.toString() === serviceId
                );
                if (foundService) {
                    serviceDetails = foundService;
                    break;
                }
            }
        }

        if (!serviceDetails) {
            req.flash('error', 'Service details not found');
            return res.redirect('/services');
        }

        // Validate booking date
        const bookingDate = new Date(date);
        if (isNaN(bookingDate.getTime()) || bookingDate <= new Date()) {
            req.flash('error', 'Please select a valid future date');
            return res.redirect('back');
        }

        // Create booking data object
        const bookingData = {
            serviceId,
            providerId,
            date: bookingDate,
            location: {
                type: 'Point',
                coordinates: [
                    parseFloat(coordinates.longitude) || 0,
                    parseFloat(coordinates.latitude) || 0
                ]
            },
            detailedAddress,
            notes: notes || '',
            customerId: req.user._id,
            cost: serviceDetails.customCost
        };

        console.log('Booking data prepared:', bookingData);

        // Render confirmation page
        res.render('pages/booking/confirm', {
            service,
            provider,
            bookingData,
            serviceDetails,
            user: req.user,
            title: 'Confirm Booking'
        });

    } catch (err) {
        console.error('Booking confirmation error:', err);
        req.flash('error', 'Something went wrong');
        res.redirect('/services');
    }
};