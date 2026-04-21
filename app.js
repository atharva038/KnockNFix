const express = require("express");
const ejsMate = require("ejs-mate");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const {
  connectDatabase,
  isDatabaseConnected,
  getDatabaseStatus,
} = require("./config/database");
const configureSession = require("./config/session");
const configurePassport = require("./config/passport");
const dbCheck = require("./middleware/dbCheck");
const errorHandler = require("./middleware/errorHandler");
const { createCorsMiddleware } = require("./middleware/cors");
const { setFlashAndCurrentUser, setCurrentRoleUser } = require("./middleware/requestContext");
const { createAutoLoginMiddleware } = require("./middleware/autoLogin");
const { createSystemRoutes } = require("./routes/system");

const authorisationRoutes = require("./routes/auth.js");
const bookingRoutes = require("./routes/booking.js");
const servicesRoutes = require("./routes/services.js");
const aboutRoutes = require("./routes/about.js");
const dashboardRoutes = require("./routes/dashboard.js");
const adminRoutes = require("./routes/admin.js");
const locationRoutes = require("./routes/location");
const paymentRoutes = require("./routes/payment");
const profileRoutes = require("./routes/profile");
const providerRoutes = require("./routes/provider");
const bookingApiRoutes = require("./routes/api/bookings");
const addRoutes = require("./routes/admin/add.js");
const feedbackRoutes = require("./routes/feedback.js");
const chatRoutes = require("./routes/chat.js");
const complaintsRoutes = require("./routes/complaints.js");
const userRoutes = require("./routes/user");

const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ||
  (isProduction
    ? "https://knocknfix.live"
    : "http://localhost:3000,http://127.0.0.1:3000")
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

connectDatabase();

// Middleware setup (order is important!)
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.json());

// Template engine setup
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "/public")));

configureSession(app);

// CORS middleware
app.use(createCorsMiddleware(allowedOrigins));

// Method override for forms
app.use(methodOverride("_method"));

configurePassport(app);

// Global variables middleware
app.use(setFlashAndCurrentUser);

app.use(dbCheck);

app.use("/uploads", express.static("uploads"));


// Auto-login middleware using remember me cookies
app.use(createAutoLoginMiddleware({ isDatabaseConnected }));
app.use(setCurrentRoleUser);

// Passport configuration - Custom authentication strategy
// Routes

app.use(
  "/",
  createSystemRoutes({
    isDatabaseConnected,
    getDatabaseStatus,
  })
);

// API Routes (organize by prefix)
app.use("/", authorisationRoutes);
app.use("/services", servicesRoutes);
app.use("/", aboutRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/admin", adminRoutes);
app.use("/api/location", locationRoutes);
app.use("/booking", bookingRoutes);
app.use("/payment", paymentRoutes);
app.use("/profile", profileRoutes);
app.use("/provider", providerRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/api/bookings", bookingApiRoutes);
app.use("/complaints", complaintsRoutes);
app.use("/", chatRoutes);
app.use("/", addRoutes);
app.use("/user", userRoutes);

// 404 Error handler - Redirect to home with flash message
app.use("*", (req, res) => {
  console.log(`❌ 404 Error: ${req.method} ${req.originalUrl} not found`);

  // Check if it's an API request
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      error: "API endpoint not found",
      path: req.originalUrl,
    });
  }

  // For web requests, redirect to home with error message
  req.flash(
    "error",
    "Page not found. You have been redirected to the home page."
  );
  res.redirect("/");
});

// Global error handler - Redirect to home with flash message
app.use(errorHandler);

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 KnockNFix server running on port ${port}`);
  console.log(`🌐 Local: http://localhost:${port}`);
  console.log(`📱 Network: http://0.0.0.0:${port}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
  if (!isProduction) {
    console.log(`📊 Database Status: Visit http://localhost:${port}/db-status`);
  }
});
