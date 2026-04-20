const cloudinary = require("cloudinary").v2;

const isDevelopment = () => {
  return (
    process.env.NODE_ENV === "development" || process.env.SKIP_OTP === "true"
  );
};

const extractValue = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) {
    const nonEmpty = value.filter((v) => v && v.toString().trim() !== "");
    return nonEmpty.length > 0 ? nonEmpty[0].toString().trim() : "";
  }
  return value.toString().trim();
};

const cleanupUploadedFiles = async (files) => {
  if (!files) {
    return;
  }

  for (const fieldname in files) {
    const fieldFiles = files[fieldname];
    for (const file of fieldFiles) {
      try {
        await cloudinary.uploader.destroy(file.filename);
      } catch (cleanupError) {
        // Silent cleanup to avoid masking primary errors
      }
    }
  }
};

const wantsJson = (req) => {
  return req.headers.accept && req.headers.accept.includes("application/json");
};

module.exports = {
  isDevelopment,
  extractValue,
  cleanupUploadedFiles,
  wantsJson,
};
