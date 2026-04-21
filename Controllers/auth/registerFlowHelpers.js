const crypto = require("crypto");
const User = require("../../models/User");
const ServiceProvider = require("../../models/ServiceProvider");
const { notifyAdminNewProvider } = require("../../utils/adminNotifications");

const OTP_ENCRYPTION_ALGO = "aes-256-gcm";
const OTP_ENCRYPTION_IV_LENGTH = 12;

function getOtpEncryptionKey() {
  const keyMaterial =
    process.env.OTP_DATA_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    "knocknfix-otp-key-fallback";

  return crypto.createHash("sha256").update(keyMaterial).digest();
}

function encryptOtpPayload(payload) {
  if (!payload) {
    return null;
  }

  const iv = crypto.randomBytes(OTP_ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv(
    OTP_ENCRYPTION_ALGO,
    getOtpEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decryptOtpPayload(encryptedPayload) {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    return null;
  }

  const parts = encryptedPayload.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted OTP payload");
  }

  const [ivBase64, authTagBase64, dataBase64] = parts;
  const decipher = crypto.createDecipheriv(
    OTP_ENCRYPTION_ALGO,
    getOtpEncryptionKey(),
    Buffer.from(ivBase64, "base64")
  );

  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataBase64, "base64")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

function buildOtpRegistrationData(userData) {
  const otpData = {
    name: userData.name,
    username: userData.username,
    phone: userData.phone,
    role: userData.role,
    profileImage: userData.profileImage,
    addresses: userData.addresses || [],
  };

  if (userData.email) {
    otpData.email = userData.email;
  }

  if (userData.role === "provider" && userData.providerData) {
    otpData.encryptedProviderData = encryptOtpPayload(userData.providerData);
  }

  return otpData;
}

function resolveProviderData(userData) {
  if (!userData) {
    return null;
  }

  if (userData.providerData) {
    return userData.providerData;
  }

  if (userData.encryptedProviderData) {
    return decryptOtpPayload(userData.encryptedProviderData);
  }

  return null;
}

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
    const providerData = resolveProviderData(userData);

    if (!providerData) {
      throw new Error(missingProviderDataMessage);
    }

    if (
      !allowMissingProviderImages &&
      (!providerData.aadharImage || !providerData.panImage)
    ) {
      throw new Error(missingProviderImagesMessage);
    }

    if (!providerData.aadharCard || !providerData.panCard) {
      throw new Error(missingProviderDataMessage);
    }

    const newProvider = new ServiceProvider({
      user: registeredUser._id,
      servicesOffered: [],
      portfolio: [],
      aadharCard: providerData.aadharCard,
      panCard: providerData.panCard,
      aadharImage: providerData.aadharImage || null,
      panImage: providerData.panImage || null,
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
  buildOtpRegistrationData,
  createVerifiedUserFromOtp,
};
