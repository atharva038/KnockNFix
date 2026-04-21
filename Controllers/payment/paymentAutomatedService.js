const Payment = require("../../models/Payment");
const Booking = require("../../models/Booking");
const { razorpay } = require("../../config/razorpay");
const { processDepositAutomation, setupProviderPayoutAutomation } = require("../../utils/paymentAutomation");
const { transitionBookingStatus } = require("../../utils/bookingPolicy");
const { verifyPaymentSignature, buildGatewayErrorResponse } = require("./paymentHelpers");

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
      notes: {
        payment_type: "advance",
        automation_enabled: "true",
        deposit_to_platform: "true",
        service_id: bookingData.serviceId,
        provider_id: bookingData.providerId,
      },
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

    return res.json({ success: true, orderId: order.id, bookingId: null, automation });
  } catch (error) {
    console.error("Create advance order error:", error);
    const gatewayError = buildGatewayErrorResponse(error, "Failed to create automated advance order");
    return res.status(gatewayError.statusCode).json(gatewayError.body);
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
    return res.json({ success: true, orderId: order.id, automation, splitDetails });
  } catch (error) {
    console.error("Create final order error:", error);
    const gatewayError = buildGatewayErrorResponse(error, "Failed to create automated final order");
    return res.status(gatewayError.statusCode).json(gatewayError.body);
  }
};

exports.verifyAutomatedPayment = async (req, res) => {
  try {
    console.log("Received verify-automated request:", req.body);
    const { orderId, razorpay_payment_id, razorpay_signature } = req.body;

    if (!verifyPaymentSignature(orderId, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ success: false, error: "Invalid payment signature" });
    }

    const payment = await Payment.findOne({ $or: [{ orderId }, { razorpayOrderId: orderId }] });
    if (!payment) return res.status(404).json({ success: false, error: "Payment record not found" });

    payment.status = "completed";
    payment.razorpayPaymentId = razorpay_payment_id;

    if (payment.paymentType === "advance") {
      const bookingData = payment.bookingData;

      if (bookingData) {
        const newBooking = new Booking({
          customer: req.user._id,
          service: bookingData.serviceId,
          provider: bookingData.providerId,
          date: new Date(bookingData.date),
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
        payment.booking = newBooking._id;

        await processDepositAutomation(payment, razorpay_payment_id);
        await payment.save();

        return res.json({
          success: true,
          redirectUrl: "/booking/success",
          bookingId: newBooking._id,
          depositDetails: { amount: payment.amount, platformAccount: payment.platformAccount, status: "deposited" },
        });
      }

      await payment.save();
      return res.json({ success: true, redirectUrl: "/booking/success", error: "Booking data missing but payment processed" });
    }

    if (payment.paymentType === "final") {
      if (payment.booking) {
        const booking = await Booking.findById(payment.booking);
        if (booking) {
          booking.finalPayment = { paid: true, paymentId: razorpay_payment_id, amount: payment.amount };

          const transition = transitionBookingStatus(booking, "completed", {
            setPaymentCompleted: true,
          });

          if (!transition.ok) {
            return res.status(400).json({ success: false, error: transition.error });
          }

          await booking.save();
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

    return res.json({ success: true, redirectUrl: "/booking/success" });
  } catch (error) {
    console.error("Verify automated payment error:", error);
    return res.status(500).json({ success: false, error: "Automated payment verification failed: " + error.message });
  }
};
