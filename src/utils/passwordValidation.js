export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 12;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be 8-12 characters and include at least one uppercase letter, one number, and one symbol.";

export const getPasswordStrength = (password = "") => {
  const pwd = String(password);
  let score = 0;
  if (pwd.length >= PASSWORD_MIN_LENGTH && pwd.length <= PASSWORD_MAX_LENGTH) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
};

export const isPasswordValid = (password = "") => getPasswordStrength(password) === 4;

export const getPasswordStrengthLabel = (strength) => {
  if (strength <= 1) return "Weak";
  if (strength <= 2) return "Fair";
  if (strength === 3) return "Good";
  return "Strong";
};

export const getPasswordStrengthColorClass = (strength) => {
  if (strength <= 1) return "bg-danger";
  if (strength <= 2) return "bg-warning";
  return "bg-success";
};
