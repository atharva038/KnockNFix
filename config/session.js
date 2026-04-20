const session = require("express-session");
const flash = require("connect-flash");

function configureSession(app) {
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
}

module.exports = configureSession;
