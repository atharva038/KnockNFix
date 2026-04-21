const express = require("express");
const Booking = require("../models/Booking");
const ServiceProvider = require("../models/ServiceProvider");
const bookingApiRoutes = require("../routes/api/bookings");
const userRoutes = require("../routes/user");

const {
  validateBookingIdParam,
  validateCreateBookingPayload,
  validateConfirmBookingPayload,
  validateAdminStatusUpdatePayload,
  handleBookingAPIValidationErrors,
  handleBookingPageValidationErrors,
} = require("../middleware/bookingValidation");

const {
  validatePaymentSuccessBookingParam,
  validateCreateAdvanceOrderPayload,
  validateCreateFinalOrderPayload,
  validateVerifyAutomatedPaymentPayload,
  validateCreateOrderPayload,
  validateVerifyManualPaymentPayload,
  validatePaymentSuccessPayload,
  handlePaymentAPIValidationErrors,
  handlePaymentFormValidationErrors,
} = require("../middleware/paymentValidation");

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.flash = () => {};
  req.session = req.session || {};
  req.isAuthenticated = () => true;
  req.user = {
    _id: "507f1f77bcf86cd799439099",
    role: "provider",
  };
  next();
});

const originalServiceProviderFindOne = ServiceProvider.findOne;
const originalBookingFindOne = Booking.findOne;

ServiceProvider.findOne = async (query = {}) => {
  if (String(query.user) !== "507f1f77bcf86cd799439099") {
    return null;
  }

  return {
    _id: "507f1f77bcf86cd799439088",
    user: "507f1f77bcf86cd799439099",
  };
};

Booking.findOne = async (query = {}) => {
  const bookingId = String(query._id || "");

  if (String(query.provider) !== "507f1f77bcf86cd799439088") {
    return null;
  }

  // Simulate a non-pending booking to validate guard behavior.
  if (bookingId === "booking-already-processed") {
    return null;
  }

  if (bookingId !== "booking-pending-accept" && bookingId !== "booking-pending-reject") {
    return null;
  }

  if (query.status !== "pending") {
    return null;
  }

  return {
    _id: bookingId,
    provider: "507f1f77bcf86cd799439088",
    status: "pending",
    providerConfirmation: { status: "pending" },
    save: async function () {
      return this;
    },
  };
};

app.post(
  "/booking/create",
  validateCreateBookingPayload,
  handleBookingAPIValidationErrors,
  (_req, res) => res.json({ ok: true })
);

app.post(
  "/booking/confirm",
  validateConfirmBookingPayload,
  handleBookingPageValidationErrors,
  (_req, res) => res.status(200).send("ok")
);

app.patch(
  "/booking/admin/:id/status",
  validateBookingIdParam,
  validateAdminStatusUpdatePayload,
  handleBookingAPIValidationErrors,
  (_req, res) => res.json({ ok: true })
);

app.post(
  "/payment/create-advance-order",
  validateCreateAdvanceOrderPayload,
  handlePaymentAPIValidationErrors,
  (_req, res) => res.json({ ok: true })
);

app.post(
  "/payment/create-final-order",
  validateCreateFinalOrderPayload,
  handlePaymentAPIValidationErrors,
  (_req, res) => res.json({ ok: true })
);

app.post(
  "/payment/verify-automated",
  validateVerifyAutomatedPaymentPayload,
  handlePaymentAPIValidationErrors,
  (_req, res) => res.json({ ok: true })
);

app.post(
  "/payment/create-order",
  validateCreateOrderPayload,
  handlePaymentAPIValidationErrors,
  (_req, res) => res.json({ ok: true })
);

app.post(
  "/payment/verify-payment",
  validateVerifyManualPaymentPayload,
  handlePaymentAPIValidationErrors,
  (_req, res) => res.json({ ok: true })
);

app.post(
  "/payment/payment-success",
  validatePaymentSuccessPayload,
  handlePaymentFormValidationErrors,
  (_req, res) => res.status(200).send("ok")
);

app.get(
  "/payment/success/:bookingId",
  validatePaymentSuccessBookingParam,
  handlePaymentFormValidationErrors,
  (_req, res) => res.status(200).send("ok")
);

app.use("/api/bookings", bookingApiRoutes);
app.use("/user", userRoutes);

const tests = [
  {
    name: "booking create invalid payload -> 400",
    method: "POST",
    path: "/booking/create",
    body: {},
    expected: 400,
  },
  {
    name: "booking create valid payload -> 200",
    method: "POST",
    path: "/booking/create",
    body: {
      serviceId: "507f1f77bcf86cd799439011",
      providerId: "507f1f77bcf86cd799439012",
      date: new Date(Date.now() + 86400000).toISOString(),
      detailedAddress: "221B Baker Street, London",
      cost: 1000,
    },
    expected: 200,
  },
  {
    name: "booking confirm invalid addressId -> 302",
    method: "POST",
    path: "/booking/confirm",
    body: {
      serviceId: "507f1f77bcf86cd799439011",
      providerId: "507f1f77bcf86cd799439012",
      date: new Date(Date.now() + 86400000).toISOString(),
      detailedAddress: "Some full address",
      addressId: "bad-index",
    },
    expected: 302,
  },
  {
    name: "booking admin status invalid id -> 400",
    method: "PATCH",
    path: "/booking/admin/not-id/status",
    body: { status: "completed" },
    expected: 400,
  },
  {
    name: "booking admin status valid payload -> 200",
    method: "PATCH",
    path: "/booking/admin/507f1f77bcf86cd799439011/status",
    body: {
      status: "cancelled",
      cancellationReason: "Customer requested cancellation",
    },
    expected: 200,
  },
  {
    name: "payment create-advance invalid payload -> 400",
    method: "POST",
    path: "/payment/create-advance-order",
    body: { amount: 100 },
    expected: 400,
  },
  {
    name: "payment create-advance valid payload -> 200",
    method: "POST",
    path: "/payment/create-advance-order",
    body: {
      amount: 100,
      automation: { depositToPlatform: true },
      bookingData: {
        serviceId: "507f1f77bcf86cd799439011",
        providerId: "507f1f77bcf86cd799439012",
        date: new Date(Date.now() + 86400000).toISOString(),
        cost: 1000,
        detailedAddress: "Street 123",
      },
    },
    expected: 200,
  },
  {
    name: "payment create-final invalid payload -> 400",
    method: "POST",
    path: "/payment/create-final-order",
    body: { amount: 1200, automation: {} },
    expected: 400,
  },
  {
    name: "payment create-final valid payload -> 200",
    method: "POST",
    path: "/payment/create-final-order",
    body: {
      amount: 1200,
      automation: { splitOnCompletion: true },
      splitDetails: {
        providerId: "507f1f77bcf86cd799439012",
      },
    },
    expected: 200,
  },
  {
    name: "payment verify-automated invalid payload -> 400",
    method: "POST",
    path: "/payment/verify-automated",
    body: { orderId: "" },
    expected: 400,
  },
  {
    name: "payment verify-automated valid payload -> 200",
    method: "POST",
    path: "/payment/verify-automated",
    body: {
      orderId: "order_123",
      razorpay_payment_id: "pay_123",
      razorpay_signature: "sig_123",
    },
    expected: 200,
  },
  {
    name: "payment success param invalid -> 302",
    method: "GET",
    path: "/payment/success/not-id",
    expected: 302,
  },
  {
    name: "payment success body invalid -> 302",
    method: "POST",
    path: "/payment/payment-success",
    body: { bookingId: "bad" },
    expected: 302,
  },
  {
    name: "payment verify manual valid payload -> 200",
    method: "POST",
    path: "/payment/verify-payment",
    body: {
      bookingId: "507f1f77bcf86cd799439011",
      razorpay_order_id: "order_123",
      razorpay_payment_id: "pay_123",
      razorpay_signature: "sig_123",
      paymentType: "final",
    },
    expected: 200,
  },
  {
    name: "payment create order invalid paymentType -> 400",
    method: "POST",
    path: "/payment/create-order",
    body: {
      amount: 100,
      bookingId: "507f1f77bcf86cd799439011",
      paymentType: "weird",
    },
    expected: 400,
  },
  {
    name: "provider accept pending booking -> 200",
    method: "POST",
    path: "/api/bookings/booking-pending-accept/accept",
    body: {},
    expected: 200,
  },
  {
    name: "provider reject pending booking -> 200",
    method: "POST",
    path: "/api/bookings/booking-pending-reject/reject",
    body: {
      reason: "Not available at selected time",
    },
    expected: 200,
  },
  {
    name: "provider accept already processed booking -> 404",
    method: "POST",
    path: "/api/bookings/booking-already-processed/accept",
    body: {},
    expected: 404,
  },
  {
    name: "user add-address missing required fields -> 302",
    method: "POST",
    path: "/user/add-address",
    body: {},
    expected: 302,
  },
  {
    name: "user update-address invalid index -> 302",
    method: "POST",
    path: "/user/update-address/not-a-number",
    body: {
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    },
    expected: 302,
  },
  {
    name: "user update-location invalid latitude -> 400",
    method: "POST",
    path: "/user/update-location",
    body: {
      latitude: 123,
      longitude: 72.88,
    },
    expected: 400,
  },
];

const server = app.listen(0, async () => {
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  let passed = 0;

  try {
    for (const test of tests) {
      const options = {
        method: test.method,
        headers: { "Content-Type": "application/json" },
        redirect: "manual",
      };

      if (test.body !== undefined) {
        options.body = JSON.stringify(test.body);
      }

      const response = await fetch(base + test.path, options);
      const ok = response.status === test.expected;
      if (ok) {
        passed += 1;
      }

      console.log(
        `${ok ? "PASS" : "FAIL"} | ${test.name} | expected ${test.expected}, got ${response.status}`
      );
    }

    console.log(`\nResult: ${passed}/${tests.length} checks passed`);

    if (passed !== tests.length) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Harness error:", error);
    process.exitCode = 1;
  } finally {
    ServiceProvider.findOne = originalServiceProviderFindOne;
    Booking.findOne = originalBookingFindOne;
    server.close();
  }
});
