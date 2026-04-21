const Complaint = require("../models/Complaint");

exports.showComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .exec();

    return res.render("pages/complaints", {
      complaints,
      pageTitle: "My Complaints",
      user: req.user,
    });
  } catch (err) {
    console.error("Error fetching complaints:", err);
    req.flash("error", "Failed to load complaints. Please try again.");
    return res.redirect("/dashboard");
  }
};

exports.createComplaint = async (req, res) => {
  try {
    const { subject, description } = req.body;
    const attachments = req.files ? req.files.map((file) => file.path) : [];

    const complaint = new Complaint({
      user: req.user._id,
      subject,
      description,
      attachments,
    });

    await complaint.save();
    return res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Error submitting complaint");
  }
};
