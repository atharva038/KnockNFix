const crypto = require("crypto");
const ServiceProvider = require("../../models/ServiceProvider");

function verifyPaymentSignature(orderId, paymentId, signature) {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return generatedSignature === signature;
}

function buildGatewayErrorResponse(error, fallbackMessage) {
  const gatewayDescription = error?.error?.description || error?.message || fallbackMessage;

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

async function processProviderPayout(booking) {
  try {
    const provider = await ServiceProvider.findById(booking.provider);
    if (!provider) {
      console.error("Provider not found for payout");
      return { success: false, error: "Provider not found" };
    }

    const totalAmount = booking.totalCost;
    const commission = Math.round(totalAmount * 0.1);
    const providerAmount = totalAmount - commission;

    booking.commission = commission;

    if (provider.bankDetails?.accountNumber) {
      booking.providerPayout = { status: "pending", amount: providerAmount, processingAt: new Date() };
      provider.pendingPayouts += providerAmount;
      await provider.save();
      console.log(`Provider payout of INR ${providerAmount} scheduled for provider ${provider._id}`);
      return { success: true, commission, providerAmount, provider: provider._id, hasBankDetails: true };
    }

    provider.pendingPayouts += providerAmount;
    await provider.save();
    booking.providerPayout = { status: "bank_details_required", amount: providerAmount, processingAt: new Date() };
    console.log(`Provider ${provider._id} missing bank details, marked for manual payout`);
    return { success: true, commission, providerAmount, provider: provider._id, hasBankDetails: false };
  } catch (error) {
    console.error("Error processing provider payout:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  verifyPaymentSignature,
  buildGatewayErrorResponse,
  processProviderPayout,
};
