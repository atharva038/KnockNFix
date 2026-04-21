function setFlashAndCurrentUser(req, res, next) {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  return next();
}

function setCurrentRoleUser(req, res, next) {
  if (req.isAuthenticated()) {
    if (req.user.role === "provider") {
      res.locals.currProvider = req.user;
    } else if (req.user.role === "customer") {
      res.locals.currCustomer = req.user;
    }
  }
  return next();
}

module.exports = {
  setFlashAndCurrentUser,
  setCurrentRoleUser,
};
