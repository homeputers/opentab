const { validate } = require('./language-service');

function validateText(text) {
  return validate(text);
}

module.exports = {
  validateText,
};
