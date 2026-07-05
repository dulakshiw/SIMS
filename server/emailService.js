import nodemailer from "nodemailer";

const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASSWORD = String(process.env.SMTP_PASSWORD || "");
const MAIL_FROM = String(process.env.MAIL_FROM || "SIMS <noreply@sims.lk>").trim();
const APP_NAME = String(process.env.APP_NAME || "SIMS Inventory Management System").trim();
const CLIENT_ORIGIN = String(process.env.CLIENT_ORIGIN || "http://localhost:5173").trim();

let cachedTransporter = null;

export const isEmailConfigured = () => Boolean(SMTP_HOST);

export const isDevOtpFallbackEnabled = () => {
  const explicit = String(process.env.EMAIL_DEV_MODE || "").trim().toLowerCase();
  if (explicit === "false") {
    return false;
  }
  if (explicit === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
};

const getTransporter = () => {
  if (!SMTP_HOST) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    });
  }

  return cachedTransporter;
};

const sendEmail = async ({ to, subject, text, html, logLabel }) => {
  const recipientEmail = String(to || "").trim().toLowerCase();

  if (!recipientEmail) {
    return { sent: false, reason: "missing_email" };
  }

  const transporter = getTransporter();

  if (!transporter) {
    console.info(`[email] SMTP not configured. ${logLabel} skipped for ${recipientEmail}`);
    console.info(`[email] Subject: ${subject}`);
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to: recipientEmail,
      subject,
      text,
      html,
    });

    console.info(`[email] ${logLabel} sent to ${recipientEmail}`);
    return { sent: true };
  } catch (error) {
    console.error(`[email] Failed to send ${logLabel} to ${recipientEmail}:`, error.message);
    return { sent: false, reason: error.message };
  }
};

const buildActivationEmailContent = ({ email, name }) => {
  const recipientEmail = String(email || "").trim().toLowerCase();
  const recipientName = String(name || "").trim() || recipientEmail;
  const subject = `Your ${APP_NAME} account is now active`;

  const text = [
    `Dear ${recipientName},`,
    "",
    `Your account registered with ${recipientEmail} has been activated.`,
    "You can now sign in to the system using this email address.",
    "",
    `Login: ${CLIENT_ORIGIN}`,
    "",
    "If you did not request this account, please contact your system administrator.",
    "",
    "This is an automated message. Please do not reply.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="color: #1e3a5f;">Account activated</h2>
      <p>Dear ${recipientName},</p>
      <p>
        Your account registered with <strong>${recipientEmail}</strong> has been activated.
        You can now sign in using this email address.
      </p>
      <p>
        <a href="${CLIENT_ORIGIN}" style="display: inline-block; padding: 10px 16px; background: #1e3a5f; color: #ffffff; text-decoration: none; border-radius: 6px;">
          Sign in to ${APP_NAME}
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">
        If you did not request this account, please contact your system administrator.
      </p>
      <p style="font-size: 12px; color: #9ca3af;">This is an automated message. Please do not reply.</p>
    </div>
  `;

  return { recipientEmail, subject, text, html };
};

const buildDeactivationEmailContent = ({ email, name }) => {
  const recipientEmail = String(email || "").trim().toLowerCase();
  const recipientName = String(name || "").trim() || recipientEmail;
  const subject = `Your ${APP_NAME} account has been deactivated`;

  const text = [
    `Dear ${recipientName},`,
    "",
    `Your account registered with ${recipientEmail} has been deactivated.`,
    "You will no longer be able to sign in until an administrator reactivates your account.",
    "",
    "If you believe this was done in error, please contact your system administrator.",
    "",
    "This is an automated message. Please do not reply.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="color: #1e3a5f;">Account deactivated</h2>
      <p>Dear ${recipientName},</p>
      <p>
        Your account registered with <strong>${recipientEmail}</strong> has been deactivated.
        You will no longer be able to sign in until an administrator reactivates your account.
      </p>
      <p style="font-size: 13px; color: #6b7280;">
        If you believe this was done in error, please contact your system administrator.
      </p>
      <p style="font-size: 12px; color: #9ca3af;">This is an automated message. Please do not reply.</p>
    </div>
  `;

  return { recipientEmail, subject, text, html };
};

const buildPasswordResetOtpEmailContent = ({ email, name, otp, expiresMinutes = 5 }) => {
  const recipientEmail = String(email || "").trim().toLowerCase();
  const recipientName = String(name || "").trim() || recipientEmail;
  const subject = `${APP_NAME} password reset code`;

  const text = [
    `Dear ${recipientName},`,
    "",
    "We received a request to reset the password for your account.",
    `Your verification code is: ${otp}`,
    "",
    `This code expires in ${expiresMinutes} minutes.`,
    "If you did not request a password reset, you can ignore this email.",
    "",
    "This is an automated message. Please do not reply.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="color: #1e3a5f;">Password reset verification</h2>
      <p>Dear ${recipientName},</p>
      <p>We received a request to reset the password for <strong>${recipientEmail}</strong>.</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #1e3a5f;">${otp}</p>
      <p>This code expires in <strong>${expiresMinutes} minutes</strong>.</p>
      <p style="font-size: 13px; color: #6b7280;">
        If you did not request a password reset, you can ignore this email.
      </p>
      <p style="font-size: 12px; color: #9ca3af;">This is an automated message. Please do not reply.</p>
    </div>
  `;

  return { recipientEmail, subject, text, html };
};

export const sendAccountActivationEmail = async ({ email, name }) => {
  const { recipientEmail, subject, text, html } = buildActivationEmailContent({ email, name });
  return sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
    logLabel: "Account activation email",
  });
};

export const sendAccountDeactivationEmail = async ({ email, name }) => {
  const { recipientEmail, subject, text, html } = buildDeactivationEmailContent({ email, name });
  return sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
    logLabel: "Account deactivation email",
  });
};

export const sendPasswordResetOtpEmail = async ({ email, name, otp, expiresMinutes = 5 }) => {
  const { recipientEmail, subject, text, html } = buildPasswordResetOtpEmailContent({
    email,
    name,
    otp,
    expiresMinutes,
  });
  return sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
    logLabel: "Password reset OTP email",
  });
};
