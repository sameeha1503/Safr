/**
 * SafeTag notification channels (Twilio WhatsApp and SMS).
 * Default channel: whatsapp (SMS is paid and fails on unpaid Twilio accounts).
 */

import { notificationReadiness } from "./notification-config";

export type NotificationChannel = "whatsapp" | "sms";

export type DeliveryStatus = {
  status: "sent" | "failed" | "mocked" | "skipped";
  error?: string;
  timestamp: string;
};

export type NotificationResult = Record<NotificationChannel, DeliveryStatus>;

export type SafeTagAlertParams = {
  childName: string;
  code: string;
  locationText?: string | null;
  finderContact?: string | null;
  lat?: number | null;
  lng?: number | null;
  guardianPhone: string;
  timeIst: string;
};

export function getNotifyChannels(): string[] {
  const envVal = process.env["NOTIFY_CHANNELS"];
  if (!envVal || envVal.trim() === "") {
    return ["whatsapp"];
  }
  return envVal
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Mask all digits except prefix/suffix for privacy and audit safety.
 * Example: "+919876543210" -> "+9******10"
 */
export function maskPhone(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, "");
  if (clean.length <= 4) return "****";
  const start = clean.slice(0, 2);
  const end = clean.slice(-2);
  return `${start}******${end}`;
}

export const maskPhoneNumber = maskPhone;

export function normalizeE164(phone: string): string | null {
  if (!phone) return null;
  // Strip spaces, dashes, brackets, and non-digit/non-plus chars
  let cleaned = phone.replace(/[\s\-()]/g, "").replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  let candidate: string;

  // 1. Keep numbers starting with "+"
  if (cleaned.startsWith("+")) {
    candidate = cleaned;
  }
  // 2. Convert a "00" prefix to "+"
  else if (cleaned.startsWith("00")) {
    candidate = "+" + cleaned.slice(2);
  }
  // 3. Drop one leading "0"
  else if (cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
    if (cleaned.length === 10) {
      candidate = `+91${cleaned}`;
    } else if (cleaned.length > 10) {
      candidate = `+${cleaned}`;
    } else {
      return null;
    }
  }
  // 4. 10 digits becomes "+91" + digits
  else if (cleaned.length === 10) {
    candidate = `+91${cleaned}`;
  }
  // 5. 12 digits starting with 91 becomes "+" + digits
  else if (cleaned.length === 12 && cleaned.startsWith("91")) {
    candidate = `+${cleaned}`;
  }
  // 6. Anything longer than 10 digits becomes "+" + digits
  else if (cleaned.length > 10) {
    candidate = `+${cleaned}`;
  }
  // 7. Less than 10 digits
  else {
    return null;
  }

  // Indian mobile validation: must be +91 followed by 10 digits starting with 6-9
  if (candidate.startsWith("+91")) {
    if (!/^\+91[6-9]\d{9}$/.test(candidate)) {
      return null;
    }
    return candidate;
  }

  // General E.164 format: + followed by 7-15 digits
  if (!/^\+[1-9]\d{6,14}$/.test(candidate)) {
    return null;
  }

  return candidate;
}

function removeLinksAndCollapseWhitespace(
  text: string | null | undefined,
): string | null {
  if (!text) return null;
  const sanitized = text
    .replace(/(?:https?:\/\/|www\.)[^\s]+/gi, "[link removed]")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || null;
}

export function formatAlertMessage(params: SafeTagAlertParams): string {
  const { childName, code, locationText, finderContact, lat, lng, timeIst } =
    params;
  const cleanLocation = removeLinksAndCollapseWhitespace(locationText);
  const cleanContact = removeLinksAndCollapseWhitespace(finderContact);

  const mapsLink =
    lat != null && lng != null && !isNaN(lat) && !isNaN(lng)
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : null;

  const lines = [
    `SafeTag ALERT: ${childName} (tag ${code}) has been found.`,
    `Location: ${cleanLocation || "not provided"}.`,
  ];
  if (mapsLink) {
    lines.push(`Map: ${mapsLink}`);
  }
  lines.push(`Finder contact: ${cleanContact || "not provided"}.`);
  lines.push(`Time: ${timeIst}.`);

  return lines.join("\n");
}

export async function sendTwilioMessage(
  toPhone: string,
  fromPhone: string,
  bodyText: string,
  isWhatsapp: boolean,
  accountSid: string,
  authToken: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const to = isWhatsapp
      ? toPhone.startsWith("whatsapp:")
        ? toPhone
        : `whatsapp:${toPhone}`
      : toPhone.replace(/^whatsapp:/, "");
    const from = isWhatsapp
      ? fromPhone.startsWith("whatsapp:")
        ? fromPhone
        : `whatsapp:${fromPhone}`
      : fromPhone.replace(/^whatsapp:/, "");

    const formData = new URLSearchParams();
    formData.append("To", to);
    formData.append("From", from);
    formData.append("Body", bodyText);

    const authHeader =
      "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader,
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(6000),
    });

    const data = (await response.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
      code?: number;
    };

    if (!response.ok) {
      const errMsg = data.message || `HTTP ${response.status}`;
      return { success: false, error: errMsg };
    }

    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Network error";
    return { success: false, error: errMsg };
  }
}

export async function sendSafeTagAlert(
  params: SafeTagAlertParams,
): Promise<NotificationResult> {
  return sendEmergencyMessage(params.guardianPhone, formatAlertMessage(params));
}

export async function sendEmergencyMessage(
  phone: string,
  message: string,
): Promise<NotificationResult> {
  const configuration = notificationReadiness(process.env);
  const mode = configuration.mode;
  const activeChannels = getNotifyChannels() as NotificationChannel[];

  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const whatsappFrom =
    process.env["TWILIO_WHATSAPP_FROM"] ||
    process.env["TWILIO_WHATSAPP_NUMBER"];
  const smsFrom =
    process.env["TWILIO_SMS_FROM"] || process.env["TWILIO_PHONE_NUMBER"];

  const results: NotificationResult = {
    whatsapp: { status: "skipped", timestamp: new Date().toISOString() },
    sms: { status: "skipped", timestamp: new Date().toISOString() },
  };

  const toE164 = normalizeE164(phone);
  if (!toE164) {
    const masked = maskPhone(phone || "");
    console.error(
      `[notifications] Invalid phone number provided: "${masked}". Normalization failed; skipping notification.`,
    );
    for (const channel of ["whatsapp", "sms"] as const) {
      if (activeChannels.includes(channel)) {
        results[channel] = {
          status: "failed",
          error: "Invalid phone number",
          timestamp: new Date().toISOString(),
        };
      }
    }
    return results;
  }
  const masked = maskPhone(toE164);

  if (
    !["mock", "live"].includes(mode) ||
    !configuration.channels.length ||
    configuration.channels.some(
      (channel) => channel !== "sms" && channel !== "whatsapp",
    )
  ) {
    for (const channel of ["whatsapp", "sms"] as const)
      results[channel] = {
        status: "failed",
        error: "Notification settings are invalid. Contact the administrator.",
        timestamp: new Date().toISOString(),
      };
    return results;
  }

  if (mode === "mock") {
    results.whatsapp = {
      status: "mocked",
      timestamp: new Date().toISOString(),
    };
    results.sms = { status: "mocked", timestamp: new Date().toISOString() };
    return results;
  }

  if (
    !accountSid ||
    !authToken ||
    accountSid.startsWith("AC_YOUR_") ||
    authToken === "your_auth_token"
  ) {
    for (const channel of ["whatsapp", "sms"] as const) {
      if (activeChannels.includes(channel))
        results[channel] = {
          status: "failed",
          error: "Notification service is not configured.",
          timestamp: new Date().toISOString(),
        };
    }
    return results;
  }

  // Live Mode: WhatsApp first, then SMS if configured
  if (activeChannels.includes("whatsapp")) {
    if (!whatsappFrom) {
      results.whatsapp = {
        status: "failed",
        error: "TWILIO_WHATSAPP_FROM missing",
        timestamp: new Date().toISOString(),
      };
    } else {
      const waResult = await sendTwilioMessage(
        toE164,
        whatsappFrom,
        message,
        true,
        accountSid,
        authToken,
      );
      if (waResult.success) {
        results.whatsapp = {
          status: "sent",
          timestamp: new Date().toISOString(),
        };
      } else {
        console.error(
          `[notifications] Twilio delivery failed for channel "whatsapp" (recipient: ${masked}, err: ${waResult.error})`,
        );
        results.whatsapp = {
          status: "failed",
          error: waResult.error || "WhatsApp delivery failed",
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  if (activeChannels.includes("sms")) {
    if (!smsFrom) {
      results.sms = {
        status: "skipped",
        timestamp: new Date().toISOString(),
      };
    } else {
      const smsResult = await sendTwilioMessage(
        toE164,
        smsFrom,
        message,
        false,
        accountSid,
        authToken,
      );
      if (smsResult.success) {
        results.sms = { status: "sent", timestamp: new Date().toISOString() };
      } else {
        console.error(
          `[notifications] Twilio delivery failed for channel "sms" (recipient: ${masked}, err: ${smsResult.error})`,
        );
        results.sms = {
          status: "failed",
          error: smsResult.error || "SMS delivery failed",
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  return results;
}
