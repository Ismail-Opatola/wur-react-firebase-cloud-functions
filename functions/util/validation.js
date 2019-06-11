const EMPTY_DATA = "Must not be empty";
const INVALID_EMAIL_ADDRESS = "Must be a valid email address";
const INVALID_PASSWORD = "Must not be less than 6 characters";

const isEmail = email => {
  const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  if (email.match(regEx)) return true;
  else return false;
};

const isEmpty = string => {
  if (string.trim() === "") return true;
  else return false;
};

exports.validateSignupData = data => {
  let errors = {};

  if (isEmpty(data.email)) {
    errors.email = EMPTY_DATA;
  } else if (!isEmail(data.email)) {
    errors.email = INVALID_EMAIL_ADDRESS;
  }

  if (isEmpty(data.password)) errors.password = EMPTY_DATA;
  if (data.password.length < 6) errors.password = INVALID_PASSWORD;
  if (isEmpty(data.firstName)) errors.firstName = EMPTY_DATA;
  if (isEmpty(data.lastName)) errors.lastName = EMPTY_DATA;

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false
  };
};

exports.validateLoginData = data => {
  let errors = {};

  if (isEmpty(data.email)) {
    errors.email = EMPTY_DATA;
  } else if (!isEmail(data.email)) {
    errors.email = INVALID_EMAIL_ADDRESS;
  }
  if (isEmpty(data.password)) errors.password = EMPTY_DATA;

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false
  };
};
