import { hashPassword, verifyPassword } from "./passwordHashing.js";

export const PASSWORD_RESET_OTP_EXPIRY_MINUTES = 5;

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export const ensurePasswordResetOtpsTable = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NULL,
      email VARCHAR(255) NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_password_reset_otps_email (email),
      INDEX idx_password_reset_otps_expires (expires_at),
      INDEX idx_password_reset_otps_user_id (user_id)
    )
  `);

  const [columns] = await pool.query("SHOW COLUMNS FROM password_reset_otps LIKE 'user_id'");
  if (columns.length === 0) {
    await pool.query("ALTER TABLE password_reset_otps ADD COLUMN user_id INT NULL");
  }
};

export const issuePasswordResetOtp = async (pool, email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const otp = generateOtp();
  const otpHash = await hashPassword(otp);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_EXPIRY_MINUTES * 60 * 1000);

  let userId = null;
  try {
    const [userRows] = await pool.execute(
      `SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(?) LIMIT 1`,
      [normalizedEmail]
    );
    userId = userRows[0]?.id ?? null;
  } catch {
    userId = null;
  }

  await pool.execute(`DELETE FROM password_reset_otps WHERE LOWER(email) = ?`, [normalizedEmail]);
  await pool.execute(
    `
      INSERT INTO password_reset_otps (user_id, email, otp_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `,
    [userId, normalizedEmail, otpHash, expiresAt]
  );

  return { otp, expiresAt };
};

export const verifyPasswordResetOtp = async (pool, email, otp) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedOtp = String(otp || "").trim();

  if (!normalizedEmail || normalizedOtp.length !== 6) {
    return { valid: false, reason: "invalid_input" };
  }

  const [rows] = await pool.execute(
    `
      SELECT id, otp_hash, expires_at, used_at
      FROM password_reset_otps
      WHERE LOWER(email) = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [normalizedEmail]
  );

  if (rows.length === 0) {
    return { valid: false, reason: "not_found" };
  }

  const record = rows[0];

  if (record.used_at) {
    return { valid: false, reason: "already_used" };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: "expired" };
  }

  const matches = await verifyPassword(normalizedOtp, record.otp_hash);
  if (!matches) {
    return { valid: false, reason: "invalid_otp" };
  }

  return { valid: true, otpId: record.id };
};

export const consumePasswordResetOtp = async (pool, email, otp) => {
  const verification = await verifyPasswordResetOtp(pool, email, otp);
  if (!verification.valid) {
    return verification;
  }

  await pool.execute(`UPDATE password_reset_otps SET used_at = CURRENT_TIMESTAMP WHERE id = ?`, [
    verification.otpId,
  ]);

  return { valid: true };
};
