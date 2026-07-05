import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export const isPasswordHashed = (value) => {
  const stored = String(value ?? "");
  return stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$");
};

export const hashPassword = async (plainPassword) => {
  return bcrypt.hash(String(plainPassword), SALT_ROUNDS);
};

export const hashPasswordForStorage = async (value) => {
  const stored = String(value ?? "");
  if (!stored) {
    return stored;
  }

  if (isPasswordHashed(stored)) {
    return stored;
  }

  return hashPassword(stored);
};

export const verifyPassword = async (plainPassword, storedValue) => {
  const plain = String(plainPassword ?? "");
  const stored = String(storedValue ?? "");

  if (!plain || !stored) {
    return false;
  }

  if (isPasswordHashed(stored)) {
    return bcrypt.compare(plain, stored);
  }

  return plain === stored;
};
