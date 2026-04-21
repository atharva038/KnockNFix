const User = require("../models/User.js");

function createAutoLoginMiddleware({ isDatabaseConnected }) {
  return async (req, res, next) => {
    if (!req.isAuthenticated() && req.cookies && isDatabaseConnected()) {
      const username = req.cookies.username;
      const rememberToken = req.cookies.rememberToken;
      const rememberMe = req.cookies.rememberMe;

      if (username && rememberToken && rememberMe === "true") {
        try {
          const user = await User.findOne({
            username: decodeURIComponent(username),
            rememberToken: rememberToken,
            rememberTokenExpires: { $gt: Date.now() },
          });

          if (user) {
            return req.login(user, (err) => {
              if (err) {
                console.error("Auto-login error:", err);
                return next();
              }

              req.session.userId = user._id;
              console.log(`Auto-login successful for user: ${user.username}`);
              return next();
            });
          }

          res.clearCookie("username");
          res.clearCookie("rememberToken");
          res.clearCookie("rememberMe");
          return next();
        } catch (err) {
          console.error("Auto-login error:", err);
          return next();
        }
      }

      return next();
    }

    return next();
  };
}

module.exports = {
  createAutoLoginMiddleware,
};
