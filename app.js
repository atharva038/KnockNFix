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

const User = require("./models/User.js");
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
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);

  if (isAllowedOrigin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    if (origin && !isAllowedOrigin) {
      return res.status(403).json({
        success: false,
        error: "CORS origin not allowed",
      });
    }
    return res.sendStatus(204);
  }

  next();
});

// Method override for forms
app.use(methodOverride("_method"));

configurePassport(app);

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

app.use(dbCheck);

app.use("/uploads", express.static("uploads"));


// Auto-login middleware using remember me cookies
app.use(async (req, res, next) => {
  // Only proceed if user is not already logged in and cookies exist
  if (
    !req.isAuthenticated() &&
    req.cookies &&
    isDatabaseConnected()
  ) {
    const username = req.cookies.username;
    const rememberToken = req.cookies.rememberToken;
    const rememberMe = req.cookies.rememberMe;

    // Check if we have stored credentials
    if (username && rememberToken && rememberMe === "true") {
      try {
        // Find the user with valid remember token
        const user = await User.findOne({
          username: decodeURIComponent(username),
          rememberToken: rememberToken,
          rememberTokenExpires: {$gt: Date.now()},
        });

        if (user) {
          // Manually authenticate the user
          req.login(user, async (err) => {
            if (err) {
              console.error("Auto-login error:", err);
              return next();
            }

            // Set user ID in session
            req.session.userId = user._id;
            console.log(`✅ Auto-login successful for user: ${user.username}`);

            // Continue to the next middleware/route handler
            return next();
          });
        } else {
          // Invalid token or expired, clear cookies
          res.clearCookie("username");
          res.clearCookie("rememberToken");
          res.clearCookie("rememberMe");
          return next();
        }
      } catch (err) {
        console.error("Auto-login error:", err);
        return next();
      }
    } else {
      return next();
    }
  } else {
    // User is already authenticated or no cookies or no database
    return next();
  }
});

// Middleware to set current provider/customer
function setCurrentProvider(req, res, next) {
  if (req.isAuthenticated()) {
    if (req.user.role === "provider") {
      res.locals.currProvider = req.user;
    } else if (req.user.role === "customer") {
      res.locals.currCustomer = req.user;
    }
  }
  next();
}

// Apply provider middleware globally
app.use(setCurrentProvider);

// Passport configuration - Custom authentication strategy
// Routes

// Home route
app.get("/", (req, res) => {
  res.render("pages/home", {
    dbConnected: isDatabaseConnected(),
  });
});

// Database status route for debugging
app.get("/db-status", (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({
      success: false,
      error: "Not found",
    });
  }
  res.json(getDatabaseStatus());
});

// Chatbot route with authentication
app.get("/chatbot", (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash("error", "Please login first");
    return res.redirect("/login");
  }
  res.render("pages/chatbot", {
    title: "Chat Assistant",
    currUser: req.user,
  });
});

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
