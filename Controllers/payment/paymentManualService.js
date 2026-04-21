const Payment = require("../../models/Payment");
const Booking = require("../../models/Booking");
const ServiceProvider = require("../../models/ServiceProvider");
const { razorpay } = require("../../config/razorpay");
const { transitionBookingStatus } = require("../../utils/bookingPolicy");
const { verifyPaymentSignature, processProviderPayout } = require("./paymentHelpers");

exports.createOrder = async (req, res) => {
  try {
    const { amount, bookingId, paymentType = "final" } = req.body;

    const booking = await Booking.findById(bookingId).populate("service").populate("customer");
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });
    if (booking.customer._id.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, error: "Access denied" });
    if (paymentType === "final" && booking.status !== "confirmed") return res.status(400).json({ success: false, error: "Provider must confirm the booking before final payment" });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `${paymentType}_${bookingId}_${Date.now()}`,
      notes: { booking_id: bookingId, payment_type: paymentType, service_name: booking.service.name },
    });

    return res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID, prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone } });
  } catch (error) {
    console.error("Error creating payment order:", error);
    return res.status(500).json({ success: false, error: "Failed to create payment order" });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId, paymentType = "final" } = req.body;

    if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ success: false, error: "Invalid payment signature" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });
    if (booking.customer.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, error: "Access denied" });

    if (paymentType === "advance") {
      const advanceAmount = Math.round(booking.totalCost * 0.15);
      booking.advancePayment = { paid: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id, amount: advanceAmount, date: new Date() };
      booking.paymentStatus = "partially_paid";
      booking.status = "pending";
    } else if (paymentType === "final") {
      if (booking.status !== "confirmed") return res.status(400).json({ success: false, error: "Provider must confirm booking before final payment" });

      const remainingAmount = booking.totalCost - (booking.advancePayment?.amount || 0);
      booking.finalPayment = { paid: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id, amount: remainingAmount, date: new Date() };

      const transition = transitionBookingStatus(booking, "completed", {
        setPaymentCompleted: true,
      });

      if (!transition.ok) {
        return res.status(400).json({ success: false, error: transition.error });
      }

      try {
        await processProviderPayout(booking);
      } catch (payoutError) {
        console.error("Provider payout failed:", payoutError);
      }
    }

    await booking.save();

    const payment = new Payment({
      booking: booking._id,
      orderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      amount: paymentType === "advance" ? Math.round(booking.totalCost * 0.15) : booking.totalCost - (booking.advancePayment?.amount || 0),
      status: "completed",
      paymentType,
      customer: req.user._id,
    });

    await payment.save();

    return res.json({ success: true, message: "Payment verified successfully", booking: { id: booking._id, status: booking.status, paymentStatus: booking.paymentStatus } });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({ success: false, error: "Payment verification failed: " + error.message });
  }
};

exports.showPaymentSuccess = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate("service")
      .populate({ path: "provider", populate: { path: "user" } });

    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/dashboard");
    }

    const payment = await Payment.findOne({ booking: booking._id, status: "completed" }).sort({ createdAt: -1 });

    return res.render("pages/success", { booking, service: booking.service, provider: booking.provider, payment, title: "Payment Successful", user: req.user });
  } catch (error) {
    console.error("Error displaying payment success:", error);
    req.flash("error", "Error loading payment details");
    return res.redirect("/dashboard");
  }
};

exports.initiateCompletePayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("customer").populate("service");
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });
    if (booking.customer._id.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, error: "Not authorized to complete payment for this booking" });
    if (booking.status !== "confirmed") return res.status(400).json({ success: false, error: "Can only complete payment for confirmed bookings" });

    const amount = Math.round(booking.cost * 0.85);
    const automation = { splitOnCompletion: true, autoProviderPayout: true, commissionDeduction: 10, transferDelay: 0 };
    const splitDetails = {
      totalAmount: amount,
      platformCommission: Math.round(amount * 0.1),
      providerAmount: Math.round(amount * 0.9),
      providerId: booking.provider,
      autoTransferEnabled: true,
    };

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `final_${booking._id}`,
      notes: { bookingId: booking._id.toString(), serviceName: booking.service.name, paymentType: "final_payment" },
    });

    const paymentRecord = new Payment({ booking: booking._id, orderId: order.id, razorpayOrderId: order.id, amount, paymentType: "final", status: "created", automation, splitDetails });
    await paymentRecord.save();

    return res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID, booking: { id: booking._id, service: booking.service.name, amount, customer: { name: req.user.name, email: req.user.email, phone: req.user.phone } }, automation });
  } catch (error) {
    console.error("Error initiating payment:", error);
    return res.status(500).json({ success: false, error: "Failed to initiate payment" });
  }
};

exports.initiateAdvancePayment = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("customer").populate("service");
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });
    if (booking.customer._id.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, error: "Not authorized to make payment for this booking" });
    if (booking.status !== "pending") return res.status(400).json({ success: false, error: "Can only make advance payment for pending bookings" });

    const amount = Math.round(booking.cost * 0.15);
    const automation = { depositToPlatform: true, splitOnCompletion: false, autoProviderPayout: false, commissionDeduction: 0, transferDelay: 0 };

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `advance_${booking._id}`,
      notes: { bookingId: booking._id.toString(), serviceName: booking.service.name, paymentType: "advance_payment" },
    });

    const paymentRecord = new Payment({ booking: booking._id, orderId: order.id, razorpayOrderId: order.id, amount, paymentType: "advance", status: "created", automation });
    await paymentRecord.save();

    return res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID, booking: { id: booking._id, service: booking.service.name, amount, customer: { name: req.user.name, email: req.user.email, phone: req.user.phone } }, automation });
  } catch (error) {
    console.error("Error initiating advance payment:", error);
    return res.status(500).json({ success: false, error: "Failed to initiate advance payment" });
  }
};

exports.handlePaymentSuccess = async (req, res) => {
  try {
    const { bookingId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      req.flash("error", "Payment verification failed");
      return res.redirect("/dashboard");
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      req.flash("error", "Payment record not found");
      return res.redirect("/dashboard");
    }

    payment.status = "completed";
    payment.razorpayPaymentId = razorpay_payment_id;
    await payment.save();

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      req.flash("error", "Booking not found");
      return res.redirect("/dashboard");
    }

    const paymentKind = payment.paymentType;

    if (paymentKind === "advance") {
      booking.advancePayment = { paid: true, amount: payment.amount, paymentId: razorpay_payment_id };

      const transition = transitionBookingStatus(booking, "confirmed", {
        requireFinalPaymentForCompletion: false,
      });

      if (!transition.ok) {
        req.flash("error", transition.error);
        return res.redirect("/dashboard");
      }
    } else if (paymentKind === "final") {
      booking.finalPayment = { paid: true, amount: payment.amount, paymentId: razorpay_payment_id };

      const transition = transitionBookingStatus(booking, "completed", {
        setPaymentCompleted: true,
      });

      if (!transition.ok) {
        req.flash("error", transition.error);
        return res.redirect("/dashboard");
      }

      await processProviderPayout(booking);
    }

    await booking.save();
    req.flash("success", "Payment successful! Booking confirmed.");
    return res.redirect("/dashboard");
  } catch (error) {
    console.error("Payment success handling failed:", error);
    req.flash("error", "Failed to process payment");
    return res.redirect("/dashboard");
  }
};

exports.getProviderPayoutHistory = async (req, res) => {
  try {
    const provider = await ServiceProvider.findById(req.params.providerId);
    if (!provider || !provider.user.equals(req.user._id)) return res.status(403).json({ success: false, error: "Unauthorized access" });

    const bookings = await Booking.find({ provider: provider._id, "providerPayout.status": { $exists: true } })
      .sort({ "providerPayout.processedAt": -1 })
      .limit(20);

    const recentPayouts = bookings.map((booking) => ({
      date: booking.providerPayout.processedAt || booking.updatedAt,
      amount: booking.providerPayout.amount || 0,
      status: booking.providerPayout.status || "pending",
      bookingId: booking._id,
      reference: booking.providerPayout.transactionId || "",
    }));

    return res.json({ success: true, recentPayouts });
  } catch (error) {
    console.error("Error fetching payout history:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch payout history" });
  }
};
