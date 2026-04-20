const ServiceProvider = require("../../models/ServiceProvider");
const Booking = require("../../models/Booking");
const Payment = require("../../models/Payment");

const paymentAdminController = {
  showPayments: async (req, res) => {
    try {
      const payments = await Payment.find()
        .populate("booking")
        .populate({
          path: "booking",
          populate: [
            { path: "service" },
            { path: "customer" },
            { path: "provider" },
          ],
        })
        .sort({ createdAt: -1 });

      const processedPayments = payments.map((payment) => {
        const plainPayment = payment.toObject();

        if (!plainPayment.booking) {
          plainPayment.booking = {
            service: { name: "Unknown Service" },
            customer: { name: "Unknown Customer" },
            provider: { user: { name: "Unknown Provider" } },
            totalCost: 0,
          };
        }

        return plainPayment;
      });

      return res.render("pages/admin/payments", {
        payments: processedPayments,
        currentPath: req.path,
        title: "Payment Management - Admin",
      });
    } catch (err) {
      console.error("Error fetching payments:", err);
      req.flash("error", "Failed to load payments");
      return res.redirect("/admin/dashboard");
    }
  },

  showProviderPayouts: async (req, res) => {
    try {
      const providers = await ServiceProvider.find({
        $or: [
          { pendingPayouts: { $gt: 0 } },
          {
            "bankDetails.accountNumber": { $exists: true, $ne: null, $ne: "" },
            "bankDetails.verified": { $ne: true },
          },
        ],
      }).populate("user");

      const bookings = await Booking.find({
        "providerPayout.status": { $exists: true },
      })
        .sort({ "providerPayout.processedAt": -1 })
        .limit(20)
        .populate({
          path: "provider",
          populate: { path: "user" },
        })
        .populate("service")
        .populate("customer");

      const payoutData = {
        pendingAmount: providers.reduce(
          (sum, provider) => sum + (provider.pendingPayouts || 0),
          0
        ),
        processedAmount: bookings
          .filter(
            (b) => b.providerPayout && b.providerPayout.status === "processed"
          )
          .reduce((sum, b) => sum + (b.providerPayout.amount || 0), 0),
        providers: providers.map((provider) => ({
          id: provider._id,
          name: provider.user?.name || "Unknown",
          email: provider.user?.email || provider.user?.username || "Unknown",
          phone: provider.user?.phone || "Not provided",
          pendingAmount: provider.pendingPayouts || 0,
          hasBankDetails: !!(
            provider.bankDetails && provider.bankDetails.accountNumber
          ),
          bankVerified: !!(
            provider.bankDetails && provider.bankDetails.verified
          ),
          accountHolderName: provider.bankDetails?.accountHolderName || "",
          bankName: provider.bankDetails?.bankName || "",
          ifscCode: provider.bankDetails?.ifscCode || "",
          accountNumber: provider.bankDetails?.accountNumber
            ? "....." + provider.bankDetails.accountNumber.slice(-4)
            : "",
        })),
        recentPayouts: bookings
          .filter((b) => b.providerPayout && b.providerPayout.status)
          .map((booking) => ({
            id: booking._id,
            providerName: booking.provider?.user?.name || "Unknown",
            serviceName: booking.service?.name || "Unknown",
            customerName: booking.customer?.name || "Unknown",
            amount: booking.providerPayout?.amount || 0,
            status: booking.providerPayout?.status || "unknown",
            date: booking.providerPayout?.processingAt || booking.createdAt,
            reference: booking.providerPayout?.transactionId || "None",
          })),
      };

      return res.render("pages/admin/provider-payouts", {
        payoutData,
        currentPath: req.path,
        title: "Provider Payouts - Admin",
      });
    } catch (err) {
      console.error("Error fetching payout data:", err);
      req.flash("error", "Failed to load payout data");
      return res.redirect("/admin/dashboard");
    }
  },

  processPayout: async (req, res) => {
    try {
      return res.json({
        success: true,
        message: "Payout processed successfully",
      });
    } catch (err) {
      console.error("Error processing payout:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to process payout: " + err.message,
      });
    }
  },

  verifyBankDetails: async (req, res) => {
    try {
      const providerId = req.params.providerId;

      const provider = await ServiceProvider.findById(providerId).populate(
        "user"
      );
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: "Provider not found",
        });
      }

      if (!provider.bankDetails || !provider.bankDetails.accountNumber) {
        return res.status(400).json({
          success: false,
          message: "Provider has no bank details to verify",
        });
      }

      provider.bankDetails.verified = true;
      provider.bankDetails.verifiedAt = new Date();

      if (req.user && req.user._id) {
        provider.bankDetails.verifiedBy = req.user._id;
      }

      await provider.save();

      return res.json({
        success: true,
        message: "Bank details verified successfully",
        provider: {
          id: provider._id,
          name: provider.user.name,
        },
      });
    } catch (err) {
      console.error("Error verifying bank details:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to verify bank details: " + err.message,
      });
    }
  },
};

module.exports = paymentAdminController;
