const { cloudinary } = require("../../config/cloudinary");
const User = require("../../models/User");
const ServiceProvider = require("../../models/ServiceProvider");
const { createContact, isInitialized } = require("../../config/razorpay");

exports.updateProfile = async (req, res) => {
  try {
    console.log("Profile update request received");
    console.log("Request body:", req.body);
    console.log("File received:", req.file ? "Yes" : "No");

    const userId = req.user._id;
    const updateData = {
      name: req.body.name,
      phone: req.body.phone,
      address: req.body.address,
    };

    if (req.file) {
      updateData.profileImage = req.file.path;
      console.log("Setting profile image path:", req.file.path);
    }

    const oldUser = await User.findById(userId);

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (
      updatedUser &&
      req.file &&
      oldUser &&
      oldUser.profileImage &&
      oldUser.profileImage.includes("cloudinary")
    ) {
      try {
        const publicId = oldUser.profileImage
          .split("/")
          .slice(-1)[0]
          .split(".")[0];

        await cloudinary.uploader.destroy(`profile-images/${publicId}`);
      } catch (deleteErr) {
        console.error("Error deleting old image:", deleteErr);
      }
    }

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    return res.json({
      success: true,
      user: {
        name: updatedUser.name,
        address: updatedUser.address,
        phone: updatedUser.phone,
        profileImage: updatedUser.profileImage,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to update profile",
    });
  }
};

exports.updateTravelFee = async (req, res) => {
  try {
    const { enabled, amount } = req.body;

    if (enabled === undefined || (enabled && (isNaN(amount) || amount <= 0))) {
      return res.status(400).json({
        success: false,
        message: "Invalid travel fee settings",
      });
    }

    const provider = await ServiceProvider.findOne({ user: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider profile not found",
      });
    }

    provider.travelFeeEnabled = enabled;
    provider.travelFeeAmount = enabled ? amount : 0;
    await provider.save();

    return res.json({
      success: true,
      message: "Travel fee settings updated successfully",
      travelFeeEnabled: provider.travelFeeEnabled,
      travelFeeAmount: provider.travelFeeAmount,
    });
  } catch (error) {
    console.error("Error updating travel fee settings:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update travel fee settings",
    });
  }
};

exports.updateBankDetails = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id }).populate(
      "user"
    );

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider profile not found",
      });
    }

    const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;

    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const formattedIFSC = ifscCode.toUpperCase();

    try {
      if (isInitialized()) {
        const contactData = {
          name: provider.user.name,
          email: provider.user.email,
          contact: provider.user.phone,
          type: "vendor",
          reference_id: provider._id.toString(),
        };

        console.log("Creating Razorpay contact:", contactData);

        const contact = await createContact(contactData);

        if (contact && contact.id) {
          console.log("Razorpay contact created:", contact.id);
          provider.razorpayContactId = contact.id;
        } else {
          console.log("Contact creation returned without ID");
        }
      } else {
        console.log("Skipping Razorpay integration - not initialized");
      }
    } catch (razorpayError) {
      console.error("Failed to create Razorpay contact:", razorpayError);
    }

    provider.bankDetails = {
      accountHolderName,
      accountNumber,
      ifscCode: formattedIFSC,
      bankName,
      verified: false,
      updatedAt: new Date(),
    };

    await provider.save();

    const maskedNumber = "\u2022\u2022\u2022\u2022\u2022" + accountNumber.slice(-4);

    return res.json({
      success: true,
      message: "Bank details saved successfully",
      bankDetails: {
        accountHolderName,
        bankName,
        ifscCode: formattedIFSC,
        accountNumberMasked: maskedNumber,
        verified: false,
      },
    });
  } catch (error) {
    console.error("Error saving bank details:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save bank details",
    });
  }
};

exports.getBankDetails = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider profile not found",
      });
    }

    if (provider.bankDetails && provider.bankDetails.accountNumber) {
      return res.json({
        success: true,
        hasBankDetails: true,
        bankDetails: {
          accountHolderName: provider.bankDetails.accountHolderName,
          bankName: provider.bankDetails.bankName,
          ifscCode: provider.bankDetails.ifscCode,
          accountNumberMasked: "\u2022\u2022\u2022\u2022\u2022" + provider.bankDetails.accountNumber.slice(-4),
          verified: provider.bankDetails.verified,
        },
      });
    }

    return res.json({
      success: true,
      hasBankDetails: false,
    });
  } catch (error) {
    console.error("Error fetching bank details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bank details",
    });
  }
};

exports.getPayoutInfo = async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider profile not found",
      });
    }

    return res.json({
      success: true,
      pendingPayouts: provider.pendingPayouts || 0,
      hasBankDetails: !!(provider.bankDetails && provider.bankDetails.accountNumber),
      bankDetailsVerified: !!(provider.bankDetails && provider.bankDetails.verified),
    });
  } catch (error) {
    console.error("Error fetching payout information:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payout information",
    });
  }
};
