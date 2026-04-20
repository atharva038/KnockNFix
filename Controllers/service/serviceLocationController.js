const User = require("../../models/User");

// Update location route
exports.updateLocation = async (req, res) => {
  try {
    const {latitude, longitude} = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: "Invalid coordinates provided",
      });
    }

    // Store the coordinates in the user's session for non-logged-in users
    req.session.currentLocation = {latitude, longitude};

    // If user is logged in, update their profile too
    if (req.user) {
      const user = await User.findById(req.user._id);

      if (user) {
        user.currentLocation = {
          latitude,
          longitude,
          lastUpdated: new Date(),
        };
        await user.save();
      }
    }

    res.json({
      success: true,
      message: "Location updated successfully",
    });
  } catch (error) {
    console.error("Error updating user location:", error);
    res.status(500).json({
      success: false,
      error: "Error updating location",
    });
  }
};
