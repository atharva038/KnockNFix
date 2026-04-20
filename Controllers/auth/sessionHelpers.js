function clearRegistrationSession(req) {
  delete req.session.verificationPhone;
  delete req.session.userRole;
  delete req.session.otpSessionId;
}

function clearLoginSession(req) {
  delete req.session.loginPhone;
  delete req.session.loginOTP;
  delete req.session.loginSessionId;
  delete req.session.loginUserId;
}

function clearAllOtpSession(req) {
  clearRegistrationSession(req);
  clearLoginSession(req);
}

module.exports = {
  clearRegistrationSession,
  clearLoginSession,
  clearAllOtpSession,
};
