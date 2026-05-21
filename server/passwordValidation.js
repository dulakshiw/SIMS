export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 12;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be 8-12 characters and include at least one uppercase letter, one number, and one symbol.";

export const validatePassword = (password) => {
  const pwd = String(password ?? "");

  if (!pwd) {
    return { valid: false, message: "Password is required." };
  }

  if (pwd.length < PASSWORD_MIN_LENGTH || pwd.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, message: PASSWORD_REQUIREMENTS_MESSAGE };
  }

  if (!/[A-Z]/.test(pwd)) {
    return { valid: false, message: PASSWORD_REQUIREMENTS_MESSAGE };
  }

  if (!/[0-9]/.test(pwd)) {
    return { valid: false, message: PASSWORD_REQUIREMENTS_MESSAGE };
  }

  if (!/[^A-Za-z0-9]/.test(pwd)) {
    return { valid: false, message: PASSWORD_REQUIREMENTS_MESSAGE };
  }

  return { valid: true, message: "" };
};
