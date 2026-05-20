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

const buildActivationEmailContent = ({ email, name }) => {
  const recipientEmail = String(email || "").trim().toLowerCase();
  const recipientName = String(name || "").trim() || recipientEmail;
  const subject = `Your ${APP_NAME} account is now active`;

  const text = [
    `Dear ${recipientName},`,
    "",
    `Your account registered with ${recipientEmail} has been activated by the administrator.`,
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
        Your account registered with <strong>${recipientEmail}</strong> has been activated
        by the administrator. You can now sign in using this email address.
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

  return { recipientEmail, recipientName, subject, text, html };
};

export const sendAccountActivationEmail = async ({ email, name }) => {
  const { recipientEmail, subject, text, html } = buildActivationEmailContent({ email, name });

  if (!recipientEmail) {
    return { sent: false, reason: "missing_email" };
  }

  const transporter = getTransporter();

  if (!transporter) {
    console.info(`[email] SMTP not configured. Activation email skipped for ${recipientEmail}`);
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

    console.info(`[email] Account activation email sent to ${recipientEmail}`);
    return { sent: true };
  } catch (error) {
    console.error(`[email] Failed to send activation email to ${recipientEmail}:`, error.message);
    return { sent: false, reason: error.message };
  }
};
