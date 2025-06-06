const express = require("express");
const ejsMate = require("ejs-mate");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const methodOverride = require('method-override');

const cookieParser = require('cookie-parser');
const LocalStrategy = require("passport-local");

require("dotenv").config();

const User = require("./models/User.js");
const authorisationRoutes = require("./routes/auth.js");
const bookingRoutes = require("./routes/booking.js");
const providerRoutes = require("./routes/provider.js");
const servicesRoutes = require("./routes/services.js");
const aboutRoutes = require("./routes/about.js");
const dashboardRoutes = require("./routes/dashboard.js");
const adminRoutes = require('./routes/admin.js');
const locationRoutes = require('./routes/location');
const paymentRoutes = require('./routes/payment');
const profileRoutes = require('./routes/profile');
const bookingApiRoutes = require('./routes/api/bookings');
const addRoutes = require("./routes/admin/add.js");
const feedbackRoutes = require('./routes/feedback.js');
const chatRoutes = require('./routes/chat.js');
const complaintsRoutes = require('./routes/complaints.js');
const userRoutes = require('./routes/user');

const port = process.env.PORT || 3000;

// Database connection

// Update the database connection section
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB Atlas");
  } catch (error) {
    console.error("MongoDB Atlas connection error:", error);
    process.exit(1); // Exit if unable to connect to database
  }
}

main();
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

app.engine("ejs", ejsMate);
app.use(express.json());

app.use(express.static(path.join(__dirname, "/public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const sessionOptions = {
  secret: "mysupersecretcode",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

// app.get("/reg",(req,res)=>{
//   let{name = "atharva"} = req.query;
//   req.session.name = name;
//   req.flash("success","user registered")
// })
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'));
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// Add this middleware after your session setup

// Auto-login middleware using remember me cookies
app.use(async (req, res, next) => {
  // Only proceed if user is not already logged in and cookies exist
  if (!req.isAuthenticated() && req.cookies) {
    const username = req.cookies.username;
    const rememberToken = req.cookies.rememberToken;
    const rememberMe = req.cookies.rememberMe;

    // Check if we have stored credentials
    if (username && rememberToken && rememberMe === 'true') {
      try {
        // Find the user with valid remember token
        const user = await User.findOne({
          username: decodeURIComponent(username),
          rememberToken: rememberToken,
          rememberTokenExpires: { $gt: Date.now() }
        });

        if (user) {
          // Manually authenticate the user
          req.login(user, async (err) => {
            if (err) {
              console.error('Auto-login error:', err);
              return next();
            }

            // Set user ID in session
            req.session.userId = user._id;

            // Continue to the next middleware/route handler
            return next();
          });
        } else {
          // Invalid token or expired, clear cookies
          res.clearCookie('username');
          res.clearCookie('rememberToken');
          res.clearCookie('rememberMe');
          return next();
        }
      } catch (err) {
        console.error('Auto-login error:', err);
        return next();
      }
    } else {
      return next();
    }
  } else {
    // User is already authenticated
    return next();
  }
});

// Middleware to check if the current user is a provider
function setCurrentProvider(req, res, next) {
  if (req.isAuthenticated() && req.user.role === "provider") {
    // If the logged-in user is a provider, set res.locals.currProvider
    res.locals.currProvider = req.user;
  }
  if (req.isAuthenticated() && req.user.role === "customer") {
    // If the logged-in user is a provider, set res.locals.currProvider
    res.locals.currCustomer = req.user;
  }
  next();
}

// Apply this middleware globally in app.js (before routes)
app.use(setCurrentProvider);

// Add this custom authentication strategy

// Customize the authentication strategy to allow login with email or phone
passport.use(new LocalStrategy(
  async function (username, password, done) {
    try {
      // Check if username is an email or phone number
      let user;
      if (username.includes('@')) {
        // Login with email
        user = await User.findOne({ username: username });
      } else {
        // Login with phone number
        user = await User.findOne({ phone: username });
      }

      if (!user) {
        return done(null, false, { message: 'Incorrect username or password.' });
      }

      // Let passport-local-mongoose handle the password verification
      user.authenticate(password, function (err, result) {
        if (err) { return done(err); }
        if (!result) { return done(null, false, { message: 'Incorrect password.' }); }
        return done(null, user);
      });
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//Routes

app.get("/", (req, res) => {
  res.render("pages/home");
});
app.get('/chatbot', (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash('error', 'Please login first');
    return res.redirect('/login');
  }
  res.render('pages/chatbot', {
    title: 'Chat Assistant',
    currUser: req.user
  });
});
app.use("/", authorisationRoutes);
app.use("/services", servicesRoutes);
app.use("/", aboutRoutes);
app.use("/dashboard", dashboardRoutes);
// app.use("/", bookingRoutes);
app.use('/admin', adminRoutes);
app.use('/api/location', locationRoutes);
app.use('/booking', bookingRoutes);
app.use('/payment', paymentRoutes);
app.use('/profile', profileRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/api/bookings', bookingApiRoutes);
app.use('/complaints', complaintsRoutes);
app.use('/', chatRoutes);
app.use('/', addRoutes);
app.use('/user', userRoutes);
// Listen on port

app.listen(port, '0.0.0.0', () => {
  console.log(`KnockNFix server running on port ${port}`);
});
