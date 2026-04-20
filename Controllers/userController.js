const axios = require("axios");
const User = require("../models/User");

exports.addAddress = async (req, res) => {
  try {
    const { street, city, state, pincode, label, makeDefault } = req.body;

    if (!city || !state || !pincode) {
      req.flash("error", "City, state and pincode are required");
      return res.redirect("back");
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("back");
    }

    const newAddress = {
      street: street || "",
      city,
      state,
      pincode,
      label: label || "Home",
      isDefault: makeDefault === "true",
    };

    const coordinates = await geocodeAddress(newAddress);
    if (coordinates) {
      newAddress.coordinates = coordinates;
    }

    if (makeDefault === "true" || user.addresses.length === 0) {
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    user.addresses.push(newAddress);

    await user.save();

    req.flash("success", "Address added successfully");
    return res.redirect("back");
  } catch (error) {
    console.error("Error adding address:", error);
    req.flash("error", "Failed to add address");
    return res.redirect("back");
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const { street, city, state, pincode, label, makeDefault } = req.body;
    const addressIndex = parseInt(req.params.index, 10);

    if (!city || !state || !pincode || isNaN(addressIndex)) {
      req.flash("error", "Required fields missing or invalid address index");
      return res.redirect("back");
    }

    const user = await User.findById(req.user._id);

    if (!user || !user.addresses[addressIndex]) {
      req.flash("error", "Address not found");
      return res.redirect("back");
    }

    user.addresses[addressIndex].street = street || "";
    user.addresses[addressIndex].city = city;
    user.addresses[addressIndex].state = state;
    user.addresses[addressIndex].pincode = pincode;
    user.addresses[addressIndex].label = label || "Home";

    if (
      user.addresses[addressIndex].street !== street ||
      user.addresses[addressIndex].city !== city ||
      user.addresses[addressIndex].state !== state ||
      user.addresses[addressIndex].pincode !== pincode
    ) {
      const coordinates = await geocodeAddress({
        street,
        city,
        state,
        pincode,
      });

      if (coordinates) {
        user.addresses[addressIndex].coordinates = coordinates;
      }
    }

    if (makeDefault === "true") {
      user.addresses.forEach((address, i) => {
        address.isDefault = i === addressIndex;
      });
    }

    await user.save();

    req.flash("success", "Address updated successfully");
    return res.redirect("back");
  } catch (error) {
    console.error("Error updating address:", error);
    req.flash("error", "Failed to update address");
    return res.redirect("back");
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const addressIndex = parseInt(req.params.index, 10);

    if (isNaN(addressIndex)) {
      req.flash("error", "Invalid address index");
      return res.redirect("back");
    }

    const user = await User.findById(req.user._id);

    if (!user || !user.addresses[addressIndex]) {
      req.flash("error", "Address not found");
      return res.redirect("back");
    }

    const wasDefault = user.addresses[addressIndex].isDefault;

    user.addresses.splice(addressIndex, 1);

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    req.flash("success", "Address deleted successfully");
    return res.redirect("back");
  } catch (error) {
    console.error("Error deleting address:", error);
    req.flash("error", "Failed to delete address");
    return res.redirect("back");
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const addressIndex = parseInt(req.params.index, 10);

    if (isNaN(addressIndex)) {
      req.flash("error", "Invalid address index");
      return res.redirect("back");
    }

    const user = await User.findById(req.user._id);

    if (!user || !user.addresses[addressIndex]) {
      req.flash("error", "Address not found");
      return res.redirect("back");
    }

    user.addresses.forEach((address, i) => {
      address.isDefault = i === addressIndex;
    });

    await user.save();

    req.flash("success", "Default address updated");
    return res.redirect("back");
  } catch (error) {
    console.error("Error setting default address:", error);
    req.flash("error", "Failed to update default address");
    return res.redirect("back");
  }
};

exports.updateCurrentLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid coordinates provided" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    user.currentLocation = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      lastUpdated: new Date(),
    };

    await user.save();

    req.session.currentLocation = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    };

    return res.json({ success: true, message: "Location updated successfully" });
  } catch (error) {
    console.error("Error updating location:", error);
    return res
      .status(500)
      .json({ success: false, error: "Error updating location" });
  }
};

async function geocodeAddress(address) {
  try {
    const searchAddress = `${address.street}, ${address.city}, ${address.state}, ${address.pincode}, India`;
    const encodedAddress = encodeURIComponent(searchAddress);

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&addressdetails=1&limit=1`,
      {
        headers: {
          "User-Agent": "KnockNFix/1.0",
        },
      }
    );

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
      };
    }

    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}
