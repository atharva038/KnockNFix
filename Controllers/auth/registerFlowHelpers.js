const crypto = require("crypto");
const User = require("../../models/User");
const ServiceProvider = require("../../models/ServiceProvider");
const { notifyAdminNewProvider } = require("../../utils/adminNotifications");

async function createVerifiedUserFromOtp(userData, options = {}) {
  const {
    allowMissingProviderImages = false,
    missingProviderDataMessage = "Required provider data missing. Please register again.",
    missingProviderImagesMessage = "Document images missing. Please register again.",
  } = options;

  const newUser = new User({
    name: userData.name,
    username: userData.username,
    phone: userData.phone,
    role: userData.role,
    profileImage: userData.profileImage,
    addresses: userData.addresses || [],
    isPhoneVerified: true,
  });

  if (userData.role === "provider" && userData.email) {
    newUser.email = userData.email;
  }

  const tempPassword = crypto.randomBytes(16).toString("hex");
  const registeredUser = await User.register(newUser, tempPassword);

  let userStatus = "active";
  if (userData.role === "provider") {
    userStatus = "pending_approval";
  }

  await User.findByIdAndUpdate(registeredUser._id, {
    status: userStatus,
    isPhoneVerified: true,
  });

  if (userData.role === "provider") {
    if (!userData.providerData) {
      throw new Error(missingProviderDataMessage);
    }

    if (
      !allowMissingProviderImages &&
      (!userData.providerData.aadharImage || !userData.providerData.panImage)
    ) {
      throw new Error(missingProviderImagesMessage);
    }

    if (!userData.providerData.aadharCard || !userData.providerData.panCard) {
      throw new Error(missingProviderDataMessage);
    }

    const newProvider = new ServiceProvider({
      user: registeredUser._id,
      servicesOffered: [],
      portfolio: [],
      aadharCard: userData.providerData.aadharCard,
      panCard: userData.providerData.panCard,
      aadharImage: userData.providerData.aadharImage || null,
      panImage: userData.providerData.panImage || null,
      verificationStatus: "pending",
      canRegisterServices: false,
      dashboardAccess: false,
      canReceiveBookings: false,
      canAccessPayouts: false,
      businessAddress: userData.addresses[0],
      documentVerification: {
        aadharVerified: false,
        panVerified: false,
        imagesVerified: false,
        allDocumentsVerified: false,
      },
      isVerified: false,
    });

    await newProvider.save();
    await notifyAdminNewProvider(registeredUser._id);
  }

  return {
    registeredUser,
    userStatus,
  };
}

module.exports = {
  createVerifiedUserFromOtp,
};
