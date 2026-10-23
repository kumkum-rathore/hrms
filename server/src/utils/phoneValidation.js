function isValidOptionalPhone(value) {
  return value === undefined ||
    value === null ||
    value === '' ||
    (typeof value === 'string' && /^\d{10}$/.test(value));
}

module.exports = { isValidOptionalPhone };
