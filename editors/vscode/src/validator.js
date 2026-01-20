const { validate } = require('./language-service/index.js');

function validateText(text) {
  return validate(text);
}

module.exports = {
  validateText,
};
