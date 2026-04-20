const express = require("express");

const otpUtils = require("../utils/otp");
const adminNotifications = require("../utils/adminNotifications");
const User = require("../models/User");
const OTP = require("../models/OTP");
const ServiceProvider = require("../models/ServiceProvider");

const {
  registerValidation,
  apiRegisterValidation,
  loginValidation,
  otpVerificationValidation,
  loginOtpVerificationValidation,
  handleValidationErrors,
  handleAPIValidationErrors,
} = require("../middleware/validation");

const originalSendSmsOtp = otpUtils.sendSmsOTP;
const originalVerifyOtpWithProvider = otpUtils.verifyOTPWithProvider;
const originalResendOtp = otpUtils.resendOTP;
const originalNotifyAdminNewProvider = adminNotifications.notifyAdminNewProvider;

const originalUserFindOne = User.findOne;
const originalUserFindById = User.findById;
const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
const originalUserRegister = User.register;

const originalOtpFindOne = OTP.findOne;
const originalOtpDeleteMany = OTP.deleteMany;
const originalOtpDeleteOne = OTP.deleteOne;
const originalOtpSave = OTP.prototype.save;

const originalServiceProviderFindOne = ServiceProvider.findOne;

const usersById = new Map();
const usersByPhone = new Map();
const usersByEmail = new Map();
const otpByPhone = new Map();

let userCounter = 1;

function nextUserId() {
  const id = userCounter.toString(16).padStart(24, "0");
  userCounter += 1;
  return id;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function attachOtpSave(doc) {
  doc.save = async function saveOtp() {
    otpByPhone.set(this.phone, this);
    return this;
  };
  return doc;
}

function createOtpDoc(data) {
  return attachOtpSave({
    ...clone(data),
    createdAt: data.createdAt || new Date().toISOString(),
  });
}

function installAuthMocks() {
  otpUtils.sendSmsOTP = async (phone) => {
    const normalizedPhone = String(phone || "").trim();
    return {
      success: true,
      dev_mode: true,
      otp: "123456",
      sessionId: `dev_session_${normalizedPhone}`,
    };
  };

  otpUtils.verifyOTPWithProvider = async (_sessionId, otp) => {
    return { success: String(otp) === "123456" };
  };

  otpUtils.resendOTP = async (phone) => {
    const normalizedPhone = String(phone || "").trim();
    return {
      success: true,
      dev_mode: true,
      otp: "123456",
      sessionId: `dev_session_${normalizedPhone}_resend`,
      fallback: false,
    };
  };

  adminNotifications.notifyAdminNewProvider = async () => {
    return true;
  };

  User.findOne = async (query = {}) => {
    if (query.phone) {
      return usersByPhone.get(String(query.phone)) || null;
    }

    if (query.email) {
      return usersByEmail.get(String(query.email).trim().toLowerCase()) || null;
    }

    return null;
  };

  User.findById = async (id) => {
    return usersById.get(String(id)) || null;
  };

  User.findByIdAndUpdate = async (id, update = {}) => {
    const user = usersById.get(String(id));
    if (!user) {
      return null;
    }

    Object.assign(user, clone(update));

    if (user.phone) {
      usersByPhone.set(String(user.phone), user);
    }

    if (user.email) {
      usersByEmail.set(String(user.email).trim().toLowerCase(), user);
    }

    return user;
  };

  User.register = async (newUser) => {
    const source = typeof newUser.toObject === "function" ? newUser.toObject() : newUser;
    const plainUser = {
      _id: source._id ? String(source._id) : nextUserId(),
      name: source.name,
      username: source.username,
      phone: source.phone,
      role: source.role,
      status: source.status || "unverified",
      email: source.email || null,
      profileImage: source.profileImage || null,
      addresses: source.addresses || [],
      isPhoneVerified: Boolean(source.isPhoneVerified),
      approvalStatus: source.approvalStatus || null,
      lastLogin: source.lastLogin || null,
    };

    usersById.set(String(plainUser._id), plainUser);
    usersByPhone.set(String(plainUser.phone), plainUser);

    if (plainUser.email) {
      usersByEmail.set(String(plainUser.email).trim().toLowerCase(), plainUser);
    }

    return plainUser;
  };

  OTP.findOne = async (query = {}) => {
    if (!query.phone) {
      return null;
    }

    const doc = otpByPhone.get(String(query.phone));
    if (!doc) {
      return null;
    }

    return attachOtpSave(doc);
  };

  OTP.deleteMany = async (query = {}) => {
    if (query.phone) {
      otpByPhone.delete(String(query.phone));
      return { deletedCount: 1 };
    }

    otpByPhone.clear();
    return { deletedCount: 0 };
  };

  OTP.deleteOne = async (query = {}) => {
    if (query.phone) {
      otpByPhone.delete(String(query.phone));
      return { deletedCount: 1 };
    }

    return { deletedCount: 0 };
  };

  OTP.prototype.save = async function mockOtpSave() {
    const doc = createOtpDoc(this.toObject ? this.toObject() : this);
    otpByPhone.set(String(doc.phone), doc);
    return doc;
  };

  ServiceProvider.findOne = async () => null;
}

function restoreAuthMocks() {
  otpUtils.sendSmsOTP = originalSendSmsOtp;
  otpUtils.verifyOTPWithProvider = originalVerifyOtpWithProvider;
  otpUtils.resendOTP = originalResendOtp;
  adminNotifications.notifyAdminNewProvider = originalNotifyAdminNewProvider;

  User.findOne = originalUserFindOne;
  User.findById = originalUserFindById;
  User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
  User.register = originalUserRegister;

  OTP.findOne = originalOtpFindOne;
  OTP.deleteMany = originalOtpDeleteMany;
  OTP.deleteOne = originalOtpDeleteOne;
  OTP.prototype.save = originalOtpSave;

  ServiceProvider.findOne = originalServiceProviderFindOne;
}

installAuthMocks();
const authController = require("../Controllers/authController");

const sessions = new Map();

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const sessionId = req.headers["x-session-id"] || "default";
  const id = Array.isArray(sessionId) ? sessionId[0] : String(sessionId);

  if (!sessions.has(id)) {
    sessions.set(id, {});
  }

  req.session = sessions.get(id);
  req.flash = () => {};
  req.isAuthenticated = () => Boolean(req.session.userId);
  req.user = req.session.user || null;

  req.login = (user, callback) => {
    req.session.userId = String(user._id);
    req.session.user = user;
    callback(null);
  };

  req.logout = (callback) => {
    delete req.session.userId;
    delete req.session.user;
    callback(null);
  };

  next();
});

// Web-style auth routes
app.post(
  "/register",
  registerValidation,
  handleValidationErrors,
  authController.handleRegister
);
app.post(
  "/verify-otp",
  otpVerificationValidation,
  handleValidationErrors,
  authController.handleVerifyOTP
);
app.post(
  "/login",
  loginValidation,
  handleValidationErrors,
  authController.handleLogin
);
app.post(
  "/verify-login-otp",
  loginOtpVerificationValidation,
  handleValidationErrors,
  authController.handleVerifyLoginOTP
);

// API-style auth routes
app.post(
  "/api/register",
  apiRegisterValidation,
  handleAPIValidationErrors,
  authController.handleRegisterAPI
);
app.post(
  "/api/verify-otp",
  otpVerificationValidation,
  handleAPIValidationErrors,
  authController.handleVerifyOTPAPI
);
app.post(
  "/api/login",
  loginValidation,
  handleAPIValidationErrors,
  authController.handleLoginAPI
);
app.post(
  "/api/verify-login-otp",
  loginOtpVerificationValidation,
  handleAPIValidationErrors,
  authController.handleVerifyLoginOTPAPI
);

const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const tests = [
  {
    name: "web register invalid payload -> 302",
    method: "POST",
    path: "/register",
    sessionId: "web-user",
    body: {},
    expected: 302,
  },
  {
    name: "web register valid customer -> 302",
    method: "POST",
    path: "/register",
    sessionId: "web-user",
    body: {
      name: "Web Customer",
      phone: "9000000001",
      role: "customer",
      date: tomorrowIso,
    },
    expected: 302,
  },
  {
    name: "web verify otp valid -> 302",
    method: "POST",
    path: "/verify-otp",
    sessionId: "web-user",
    body: {
      phoneOTP: "123456",
    },
    expected: 302,
  },
  {
    name: "web login valid phone -> 302",
    method: "POST",
    path: "/login",
    sessionId: "web-user",
    body: {
      phone: "9000000001",
    },
    expected: 302,
  },
  {
    name: "web verify login otp valid -> 302",
    method: "POST",
    path: "/verify-login-otp",
    sessionId: "web-user",
    body: {
      phoneOTP: "123456",
    },
    expected: 302,
  },
  {
    name: "api register invalid payload -> 400",
    method: "POST",
    path: "/api/register",
    sessionId: "api-user",
    body: {
      name: "A",
      phone: "123",
      role: "customer",
    },
    expected: 400,
  },
  {
    name: "api register valid customer -> 200",
    method: "POST",
    path: "/api/register",
    sessionId: "api-user",
    body: {
      name: "API Customer",
      phone: "9000000002",
      role: "customer",
      date: tomorrowIso,
    },
    expected: 200,
  },
  {
    name: "api verify otp valid -> 200",
    method: "POST",
    path: "/api/verify-otp",
    sessionId: "api-user",
    body: {
      phoneOTP: "123456",
    },
    expected: 200,
  },
  {
    name: "api login invalid payload -> 400",
    method: "POST",
    path: "/api/login",
    sessionId: "api-user",
    body: {
      phone: "777",
    },
    expected: 400,
  },
  {
    name: "api login valid phone -> 200",
    method: "POST",
    path: "/api/login",
    sessionId: "api-user",
    body: {
      phone: "9000000002",
    },
    expected: 200,
  },
  {
    name: "api verify login otp valid -> 200",
    method: "POST",
    path: "/api/verify-login-otp",
    sessionId: "api-user",
    body: {
      phoneOTP: "123456",
    },
    expected: 200,
  },
];

const server = app.listen(0, async () => {
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  let passed = 0;

  try {
    for (const test of tests) {
      const options = {
        method: test.method,
        headers: {
          "Content-Type": "application/json",
          "x-session-id": test.sessionId,
        },
        redirect: "manual",
      };

      if (test.body !== undefined) {
        options.body = JSON.stringify(test.body);
      }

      const response = await fetch(base + test.path, options);
      const ok = response.status === test.expected;

      if (ok) {
        passed += 1;
      }

      console.log(
        `${ok ? "PASS" : "FAIL"} | ${test.name} | expected ${test.expected}, got ${response.status}`
      );
    }

    console.log(`\nResult: ${passed}/${tests.length} checks passed`);

    if (passed !== tests.length) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Harness error:", error);
    process.exitCode = 1;
  } finally {
    restoreAuthMocks();
    server.close();
  }
});
