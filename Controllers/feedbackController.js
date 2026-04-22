const Booking = require("../models/Booking");

exports.showFeedbackPage = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate("service")
      .populate({
        path: "provider",
        populate: { path: "user" },
      });

    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/dashboard");
    }

    // Ownership check — only the booking's customer can view their feedback page
    if (booking.customer.toString() !== req.user._id.toString()) {
      req.flash("error", "You are not authorized to view this feedback page.");
      return res.status(403).redirect("/booking/mybookings");
    }

    return res.render("pages/feedback", {
      booking,
      service: booking.service,
      provider: booking.provider,
    });
  } catch (error) {
    console.error("Error loading feedback page:", error);
    req.flash("error", "Failed to load feedback page");
    return res.redirect("/dashboard");
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    booking.feedback = {
      rating: parseInt(rating, 10),
      comment,
      submittedAt: new Date(),
      submittedBy: req.user._id,
    };

    await booking.save();

    return res.json({
      success: true,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to submit feedback",
    });
  }
};
