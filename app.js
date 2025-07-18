const express = require("express");
const ejsMate = require("ejs-mate");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");
const LocalStrategy = require("passport-local");

require("dotenv").config();

const User = require("./models/User.js");
const authorisationRoutes = require("./routes/auth.js");
const bookingRoutes = require("./routes/booking.js");
const providerRoutes = require("./routes/provider.js");
const servicesRoutes = require("./routes/services.js");
const aboutRoutes = require("./routes/about.js");
const dashboardRoutes = require("./routes/dashboard.js");
const adminRoutes = require("./routes/admin.js");
const locationRoutes = require("./routes/location");
const paymentRoutes = require("./routes/payment");
const profileRoutes = require("./routes/profile");
const bookingApiRoutes = require("./routes/api/bookings");
const addRoutes = require("./routes/admin/add.js");
const feedbackRoutes = require("./routes/feedback.js");
const chatRoutes = require("./routes/chat.js");
const complaintsRoutes = require("./routes/complaints.js");
const userRoutes = require("./routes/user");

const port = process.env.PORT || 3000;

// Database connection with fixed options
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
    });
    console.log("✅ Connected to MongoDB Atlas");
  } catch (error) {
    console.error("❌ MongoDB Atlas connection error:", error.message);
    console.error("Full error:", error);
    console.error("Connection string exists:", !!process.env.MONGO_URI);

    if (process.env.NODE_ENV === "development") {
      console.log("⚠️ Continuing in development mode without database...");
      console.log(
        "⚠️ Database operations will fail until connection is restored"
      );
    } else {
      process.exit(1);
    }
  }
}

// Add connection event listeners
mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected to MongoDB Atlas");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ Mongoose disconnected from MongoDB Atlas");
});

mongoose.connection.on("reconnected", () => {
  console.log("✅ Mongoose reconnected to MongoDB Atlas");
});

// Handle process termination gracefully
process.on("SIGINT", async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("📴 MongoDB connection closed through app termination");
    }
    process.exit(0);
  } catch (err) {
    console.error("Error closing MongoDB connection:", err);
    process.exit(1);
  }
});

// Initialize database connection
main();

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

// Session configuration
const sessionOptions = {
  secret: process.env.SESSION_SECRET || "mysupersecretcode",
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  },
};

app.use(session(sessionOptions));
app.use(flash());

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// Method override for forms
app.use(methodOverride("_method"));

// Passport initialization (must be after session)
app.use(passport.initialize());
app.use(passport.session());

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// Database check middleware - provide helpful error messages
app.use((req, res, next) => {
  if (mongoose.connection.readyState === 0 && req.path !== "/") {
    // Database is disconnected
    req.flash("error", "Database connection is down. Please try again later.");
    return res.redirect("/");
  }
  next();
});

app.use('/uploads', express.static('uploads'));


// Auto-login middleware using remember me cookies
app.use(async (req, res, next) => {
  // Only proceed if user is not already logged in and cookies exist
  if (
    !req.isAuthenticated() &&
    req.cookies &&
    mongoose.connection.readyState === 1
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
passport.use(
  new LocalStrategy(
    {
      usernameField: "username",
      passwordField: "password",
    },
    async function (username, password, done) {
      try {
        console.log(`🔐 Login attempt for: ${username}`);

        // Check if username is an email or phone number
        let user;
        if (username.includes("@")) {
          // Login with email
          user = await User.findOne({email: username});
          console.log(`📧 Email login attempt: ${username}`);
        } else {
          // Login with phone number (remove any non-digits for consistency)
          const cleanPhone = username.replace(/\D/g, "");
          user = await User.findOne({phone: cleanPhone});
          console.log(`📱 Phone login attempt: ${cleanPhone}`);
        }

        if (!user) {
          console.log(`❌ User not found: ${username}`);
          return done(null, false, {
            message: "Phone number or email not registered.",
          });
        }

        // Check if account is active
        if (user.status !== "active") {
          console.log(`❌ Account not active: ${username}`);
          return done(null, false, {
            message: "Account is not active. Please contact support.",
          });
        }

        // Let passport-local-mongoose handle the password verification
        user.authenticate(password, function (err, result) {
          if (err) {
            console.log(`❌ Authentication error: ${err}`);
            return done(err);
          }
          if (!result) {
            console.log(`❌ Incorrect password for: ${username}`);
            return done(null, false, {message: "Incorrect password."});
          }

          console.log(`✅ Authentication successful for: ${username}`);
          return done(null, user);
        });
      } catch (err) {
        console.error(`❌ Login error: ${err}`);
        return done(err);
      }
    }
  )
);

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Routes

// Home route
app.get("/", (req, res) => {
  res.render("pages/home", {
    dbConnected: mongoose.connection.readyState === 1,
  });
});

// Database status route for debugging
app.get("/db-status", (req, res) => {
  const states = {
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
  };

  res.json({
    status: states[mongoose.connection.readyState],
    state: mongoose.connection.readyState,
    uri: process.env.MONGO_URI ? "URI configured" : "URI missing",
    timestamp: new Date().toISOString(),
  });
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
app.use((err, req, res, next) => {
  console.error("❌ Application Error:", err);

  // Check if it's an API request
  if (req.originalUrl.startsWith("/api/")) {
    const isDevelopment = process.env.NODE_ENV !== "production";
    return res.status(err.status || 500).json({
      success: false,
      error: isDevelopment ? err.message : "Internal Server Error",
      ...(isDevelopment && {stack: err.stack}),
    });
  }

  // For web requests, redirect to home with error message
  const isDevelopment = process.env.NODE_ENV !== "production";
  const errorMessage = isDevelopment
    ? `An error occurred: ${err.message}`
    : "Something went wrong. Please try again.";

  req.flash("error", errorMessage);
  res.redirect("/");
});

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 KnockNFix server running on port ${port}`);
  console.log(`🌐 Local: http://localhost:${port}`);
  console.log(`📱 Network: http://0.0.0.0:${port}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📊 Database Status: Visit http://localhost:${port}/db-status`);
});
