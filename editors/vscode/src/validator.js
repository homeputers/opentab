const { validate } = require('@opentab/language-service');

function validateText(text) {
  return validate(text);
}

module.exports = {
  validateText,
};
