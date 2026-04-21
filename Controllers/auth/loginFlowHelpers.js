function buildLoginUserData(user, sessionType = "login") {
  return {
    userId: user._id,
    role: user.role,
    isLoginAttempt: true,
    timestamp: new Date(),
    sessionType,
  };
}

function getWebLoginStatusIssue(user) {
  if (user.status === "pending_approval") {
    return {
      message:
        "⏳ Your account is pending admin approval. Please wait for verification.",
    };
  }

  if (user.status === "rejected") {
    const reason =
      user.approvalStatus?.rejectionReason ||
      "Please contact support for details.";

    return {
      message: `❌ Your account has been rejected. Reason: ${reason}`,
    };
  }

  if (user.status === "suspended") {
    return {
      message: "🚫 Your account has been suspended. Please contact support.",
    };
  }

  if (user.status !== "active") {
    return {
      message: "Account is not active. Please contact support.",
    };
  }

  return null;
}

function getWebVerifyStatusIssue(user) {
  if (user.status === "pending_approval") {
    return {
      message: "⏳ Your account is still pending admin approval.",
    };
  }

  if (user.status === "rejected") {
    const reason =
      user.approvalStatus?.rejectionReason || "Please contact support.";

    return {
      message: `❌ Your account has been rejected. Reason: ${reason}`,
    };
  }

  if (user.status !== "active") {
    return {
      message: "Account is not active. Please contact support.",
    };
  }

  return null;
}

function getApiLoginStatusIssue(user) {
  if (user.status === "pending_approval") {
    return {
      statusCode: 403,
      body: {
        success: false,
        error:
          "⏳ Your account is pending admin approval. Please wait for verification.",
        status: "pending_approval",
      },
    };
  }

  if (user.status === "rejected") {
    const reason =
      user.approvalStatus?.rejectionReason ||
      "Please contact support for details.";

    return {
      statusCode: 403,
      body: {
        success: false,
        error: `❌ Your account has been rejected. Reason: ${reason}`,
        status: "rejected",
      },
    };
  }

  if (user.status === "suspended") {
    return {
      statusCode: 403,
      body: {
        success: false,
        error: "🚫 Your account has been suspended. Please contact support.",
        status: "suspended",
      },
    };
  }

  if (user.status !== "active") {
    return {
      statusCode: 403,
      body: {
        success: false,
        error: "Account is not active. Please contact support.",
        status: user.status,
      },
    };
  }

  return null;
}

function getApiVerifyStatusIssue(user) {
  if (user.status === "pending_approval") {
    return {
      statusCode: 403,
      body: {
        success: false,
        error: "⏳ Your account is still pending admin approval.",
        status: "pending_approval",
      },
    };
  }

  if (user.status === "rejected") {
    const reason =
      user.approvalStatus?.rejectionReason || "Please contact support.";

    return {
      statusCode: 403,
      body: {
        success: false,
        error: `❌ Your account has been rejected. Reason: ${reason}`,
        status: "rejected",
      },
    };
  }

  if (user.status !== "active") {
    return {
      statusCode: 403,
      body: {
        success: false,
        error: "Account is not active. Please contact support.",
        status: user.status,
      },
    };
  }

  return null;
}

function normalizeSixDigitOtp(rawOtp) {
  if (!rawOtp || rawOtp.trim() === "") {
    return { ok: false, error: "Please enter the 6-digit OTP" };
  }

  const cleanOtp = rawOtp.trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    return { ok: false, error: "Please enter a valid 6-digit OTP" };
  }

  return { ok: true, value: cleanOtp };
}

function resolvePostLoginRedirect(user, serviceProvider, options = {}) {
  const customerPath = options.customerPath || "/";

  if (user.role === "provider") {
    if (serviceProvider && serviceProvider.dashboardAccess) {
      return "/provider/dashboard";
    }

    return "/provider/pending-approval";
  }

  if (user.role === "admin") {
    return "/admin/dashboard";
  }

  if (user.role === "customer") {
    return customerPath;
  }

  return "/";
}

module.exports = {
  buildLoginUserData,
  getWebLoginStatusIssue,
  getWebVerifyStatusIssue,
  getApiLoginStatusIssue,
  getApiVerifyStatusIssue,
  normalizeSixDigitOtp,
  resolvePostLoginRedirect,
};
