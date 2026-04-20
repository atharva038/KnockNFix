// Controllers/paymentController.js
// Extracted from routes/payment.js for structural clarity

const crypto = require("crypto");
const Razorpay = require("razorpay");
const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const ServiceProvider = require("../models/ServiceProvider");
const { razorpay } = require("../config/razorpay");
const { processDepositAutomation, setupProviderPayoutAutomation } = require("../utils/paymentAutomation");

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function verifyPaymentSignature(orderId, paymentId, signature) {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return generatedSignature === signature;
}

function buildGatewayErrorResponse(error, fallbackMessage) {
  const gatewayDescription =
    error?.error?.description || error?.message || fallbackMessage;

  const isAuthFailure =
    error?.statusCode === 401 ||
    /authentication failed/i.test(gatewayDescription);

  if (isAuthFailure) {
    return {
      statusCode: 502,
      body: {
        success: false,
        code: "RAZORPAY_AUTH_FAILED",
        error:
          "Payment gateway authentication failed. Please verify Razorpay key id and key secret in server environment.",
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      success: false,
      error: `${fallbackMessage}: ${gatewayDescription}`,
    },
  };
}

async function processProviderPayout(booking, paymentId) {
  try {
    const provider = await ServiceProvider.findById(booking.provider);
    if (!provider) {
      console.error("Provider not found for payout");
      return { success: false, error: "Provider not found" };
    }

    const totalAmount = booking.totalCost;
    const commission = Math.round(totalAmount * 0.1); // 10% platform commission
    const providerAmount = totalAmount - commission;

    booking.commission = commission;

    if (provider.bankDetails?.accountNumber) {
      booking.providerPayout = { status: "pending", amount: providerAmount, processingAt: new Date() };
      provider.pendingPayouts += providerAmount;
      await provider.save();
      console.log(`Provider payout of ₹${providerAmount} scheduled for provider ${provider._id}`);
      return { success: true, commission, providerAmount, provider: provider._id, hasBankDetails: true };
    } else {
      provider.pendingPayouts += providerAmount;
      await provider.save();
      booking.providerPayout = { status: "bank_details_required", amount: providerAmount, processingAt: new Date() };
      console.log(`Provider ${provider._id} missing bank details, marked for manual payout`);
      return { success: true, commission, providerAmount, provider: provider._id, hasBankDetails: false };
    }
  } catch (error) {
    console.error("Error processing provider payout:", error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// EXPORTED CONTROLLER METHODS
// =============================================================================

exports.createAdvanceOrder = async (req, res) => {
  try {
    console.log("Received create-advance-order request:", req.body);
    const { amount, automation, bookingData, platformConfig } = req.body;

    if (!razorpay || !razorpay.orders || typeof razorpay.orders.create !== "function") {
      return res.status(500).json({
        success: false,
        code: "RAZORPAY_NOT_INITIALIZED",
        error: "Payment gateway is not initialized. Please check Razorpay server configuration.",
      });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `advance_${Date.now()}`,
      notes: { payment_type: "advance", automation_enabled: "true", deposit_to_platform: "true", service_id: bookingData.serviceId, provider_id: bookingData.providerId },
    });

    const paymentRecord = new Payment({
      orderId: order.id,
      razorpayOrderId: order.id,
      amount,
      paymentType: "advance",
      status: "created",
      automation,
      platformAccount: platformConfig?.accountId || "default_platform_account",
      bookingData: {
        serviceId: bookingData.serviceId,
        providerId: bookingData.providerId,
        date: new Date(bookingData.date),
        address: bookingData.address || bookingData.detailedAddress,
        detailedAddress: bookingData.detailedAddress,
        notes: bookingData.notes || "",
        cost: parseFloat(bookingData.cost),
        estimatedRange: bookingData.estimatedRange || "",
      },
    });

    await paymentRecord.save();
    console.log("Payment record saved:", paymentRecord._id);

    res.json({ success: true, orderId: order.id, bookingId: null, automation });
  } catch (error) {
    console.error("Create advance order error:", error);
    const gatewayError = buildGatewayErrorResponse(
      error,
      "Failed to create automated advance order"
    );
    res.status(gatewayError.statusCode).json(gatewayError.body);
  }
};

exports.createFinalOrder = async (req, res) => {
  try {
    console.log("Received create-final-order request:", req.body);
    const { amount, automation, splitDetails, platformConfig } = req.body;

    if (!razorpay || !razorpay.orders || typeof razorpay.orders.create !== "function") {
      return res.status(500).json({
        success: false,
        code: "RAZORPAY_NOT_INITIALIZED",
        error: "Payment gateway is not initialized. Please check Razorpay server configuration.",
      });
    }

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `final_${Date.now()}`,
      notes: { payment_type: "final", automation_enabled: "true", auto_split: "true", provider_id: splitDetails.providerId },
    });

    const paymentRecord = new Payment({
      orderId: order.id,
      razorpayOrderId: order.id,
      amount,
      paymentType: "final",
      status: "created",
      automation,
      splitDetails,
      platformAccount: platformConfig?.accountId || "default_platform_account",
    });

    await paymentRecord.save();
    res.json({ success: true, orderId: order.id, automation, splitDetails });
  } catch (error) {
    console.error("Create final order error:", error);
    const gatewayError = buildGatewayErrorResponse(
      error,
      "Failed to create automated final order"
    );
    res.status(gatewayError.statusCode).json(gatewayError.body);
  }
};

exports.verifyAutomatedPayment = async (req, res) => {
  try {
    console.log("Received verify-automated request:", req.body);
    const { orderId, razorpay_payment_id, razorpay_signature } = req.body;

    if (!verifyPaymentSignature(orderId, razorpay_payment_id, razorpay_signature))
      return res.status(400).json({ success: false, error: "Invalid payment signature" });

    const payment = await Payment.findOne({ $or: [{ orderId }, { razorpayOrderId: orderId }] });
    if (!payment) return res.status(404).json({ success: false, error: "Payment record not found" });

    payment.status = "completed";
    payment.razorpayPaymentId = razorpay_payment_id;

    if (payment.paymentType === "advance") {
      const bookingData = payment.bookingData;

      if (bookingData) {
        console.log("Creating booking with data:", bookingData);
        const newBooking = new Booking({
          customer: req.user._id,
          service: bookingData.serviceId,
          provider: bookingData.providerId,
          date: new Date(bookingData.date),
          bookingDate: new Date(bookingData.date),
          address: bookingData.detailedAddress || bookingData.address,
          notes: bookingData.notes || "",
          totalCost: parseFloat(bookingData.cost),
          cost: parseFloat(bookingData.cost),
          status: "confirmed",
          paymentStatus: "partially_paid",
          advancePayment: { paid: true, paymentId: razorpay_payment_id, amount: payment.amount },
          finalPayment: { paid: false, amount: parseFloat(bookingData.cost) - payment.amount },
          location: { type: "Point", coordinates: [0, 0] },
        });

        await newBooking.save();
        console.log("✅ Booking created successfully:", newBooking._id);
        payment.booking = newBooking._id;

        await processDepositAutomation(payment, razorpay_payment_id);
        await payment.save();

        return res.json({
          success: true,
          redirectUrl: "/booking/success",
          bookingId: newBooking._id,
          depositDetails: { amount: payment.amount, platformAccount: payment.platformAccount, status: "deposited" },
        });
      } else {
        console.error("No booking data found in payment record");
        await payment.save();
        return res.json({ success: true, redirectUrl: "/booking/success", error: "Booking data missing but payment processed" });
      }
    } else if (payment.paymentType === "final") {
      if (payment.booking) {
        const booking = await Booking.findById(payment.booking);
        if (booking) {
          booking.status = "completed";
          booking.paymentStatus = "completed";
          booking.finalPayment = { paid: true, paymentId: razorpay_payment_id, amount: payment.amount };
          await booking.save();
          console.log("✅ Booking updated for final payment:", booking._id);
        }
      }

      await setupProviderPayoutAutomation(payment, razorpay_payment_id);
      await payment.save();

      return res.json({
        success: true,
        redirectUrl: "/booking/success",
        automationSetup: {
          totalAmount: payment.amount,
          platformCommission: payment.splitDetails?.platformCommission || 0,
          providerAmount: payment.splitDetails?.providerAmount || 0,
          autoTransferScheduled: true,
        },
      });
    }
  } catch (error) {
    console.error("Verify automated payment error:", error);
    res.status(500).json({ success: false, error: "Automated payment verification failed: " + error.message });
  }
};

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

    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID, prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone } });
  } catch (error) {
    console.error("Error creating payment order:", error);
    res.status(500).json({ success: false, error: "Failed to create payment order" });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId, paymentType = "final" } = req.body;

    console.log("Manual payment verification:", { razorpay_order_id, razorpay_payment_id, bookingId, paymentType });

    if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature))
      return res.status(400).json({ success: false, error: "Invalid payment signature" });

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
      booking.paymentStatus = "completed";
      booking.status = "completed";
      booking.completedAt = new Date();

      try {
        await processProviderPayout(booking, razorpay_payment_id);
        console.log(`✅ Automated payout triggered for booking ${bookingId}`);
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

    res.json({ success: true, message: "Payment verified successfully", booking: { id: booking._id, status: booking.status, paymentStatus: booking.paymentStatus } });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ success: false, error: "Payment verification failed: " + error.message });
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

    res.render("pages/success", { booking, service: booking.service, provider: booking.provider, payment, title: "Payment Successful", user: req.user });
  } catch (error) {
    console.error("Error displaying payment success:", error);
    req.flash("error", "Error loading payment details");
    res.redirect("/dashboard");
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

    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID, booking: { id: booking._id, service: booking.service.name, amount, customer: { name: req.user.name, email: req.user.email, phone: req.user.phone } }, automation });
  } catch (error) {
    console.error("Error initiating payment:", error);
    res.status(500).json({ success: false, error: "Failed to initiate payment" });
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

    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID, booking: { id: booking._id, service: booking.service.name, amount, customer: { name: req.user.name, email: req.user.email, phone: req.user.phone } }, automation });
  } catch (error) {
    console.error("Error initiating advance payment:", error);
    res.status(500).json({ success: false, error: "Failed to initiate advance payment" });
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

    const paymentKind = payment.paymentType || payment.type;

    if (paymentKind === "advance") {
      booking.status = "confirmed";
      booking.advancePayment = { paid: true, amount: payment.amount, paymentId: razorpay_payment_id };
    } else if (paymentKind === "final") {
      booking.status = "completed";
      booking.finalPayment = { paid: true, amount: payment.amount, paymentId: razorpay_payment_id };
      await processProviderPayout(booking, razorpay_payment_id);
    }

    await booking.save();
    req.flash("success", "Payment successful! Booking confirmed.");
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Payment success handling failed:", error);
    req.flash("error", "Failed to process payment");
    res.redirect("/dashboard");
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

    res.json({ success: true, recentPayouts });
  } catch (error) {
    console.error("Error fetching payout history:", error);
    res.status(500).json({ success: false, error: "Failed to fetch payout history" });
  }
};
