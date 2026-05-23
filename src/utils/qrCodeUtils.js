import QRCode from "qrcode";

/**
 * Generate a QR code as a data URL (works offline; reliable for print windows).
 */
export async function generateQrDataUrl(value, size = 200) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch {
    return null;
  }
}

/** @deprecated Prefer generateQrDataUrl for print; kept for simple previews. */
export function getExternalQrImageUrl(value, size = 200) {
  if (!value) {
    return null;
  }

  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
}
