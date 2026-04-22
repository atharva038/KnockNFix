// models/category.js — backward-compat shim
// All imports of models/category (lowercase) resolve here and are forwarded to Category.js.
// Do NOT define a schema here — Category.js is the canonical definition.
module.exports = require('./Category');
