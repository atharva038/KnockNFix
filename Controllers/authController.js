const registerController = require("./auth/registerController");
const loginController = require("./auth/loginController");
const sessionController = require("./auth/sessionController");
const {extractValue} = require("./auth/helpers");

module.exports = {
  extractValue,
  ...registerController,
  ...loginController,
  ...sessionController,
};
