const passport = require("passport");
const LocalStrategy = require("passport-local");

const User = require("../models/User");

function configurePassport(app) {
  passport.use(
    new LocalStrategy(
      {
        usernameField: "username",
        passwordField: "password",
      },
      async (username, password, done) => {
        try {
          console.log(`🔐 Login attempt for: ${username}`);

          let user;
          if (username.includes("@")) {
            user = await User.findOne({ email: username });
            console.log(`📧 Email login attempt: ${username}`);
          } else {
            const cleanPhone = username.replace(/\D/g, "");
            user = await User.findOne({ phone: cleanPhone });
            console.log(`📱 Phone login attempt: ${cleanPhone}`);
          }

          if (!user) {
            console.log(`❌ User not found: ${username}`);
            return done(null, false, {
              message: "Phone number or email not registered.",
            });
          }

          if (user.status !== "active") {
            console.log(`❌ Account not active: ${username}`);
            return done(null, false, {
              message: "Account is not active. Please contact support.",
            });
          }

          user.authenticate(password, (err, result) => {
            if (err) {
              console.log(`❌ Authentication error: ${err}`);
              return done(err);
            }
            if (!result) {
              console.log(`❌ Incorrect password for: ${username}`);
              return done(null, false, { message: "Incorrect password." });
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

  app.use(passport.initialize());
  app.use(passport.session());
}

module.exports = configurePassport;
