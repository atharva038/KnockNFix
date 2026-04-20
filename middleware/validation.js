const authValidation = require("./authValidation");
const validationHandlers = require("./validationHandlers");

module.exports = {
  ...authValidation,
  ...validationHandlers,
};
