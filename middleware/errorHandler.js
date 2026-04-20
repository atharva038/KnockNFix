function errorHandler(err, req, res, next) {
  console.error("❌ Application Error:", err);

  if (req.originalUrl.startsWith("/api/")) {
    const isDevelopment = process.env.NODE_ENV !== "production";
    return res.status(err.status || 500).json({
      success: false,
      error: isDevelopment ? err.message : "Internal Server Error",
      ...(isDevelopment && { stack: err.stack }),
    });
  }

  const isDevelopment = process.env.NODE_ENV !== "production";
  const errorMessage = isDevelopment
    ? `An error occurred: ${err.message}`
    : "Something went wrong. Please try again.";

  req.flash("error", errorMessage);
  return res.redirect("/");
}

module.exports = errorHandler;
