/** Validate settings without exposing credentials or contacting the provider. */
export function notificationReadiness(env: Record<string, string | undefined>) {
  const mode = (env["NOTIFY_MODE"] || "mock").trim().toLowerCase();
  const channels = [
    ...new Set(
      (env["NOTIFY_CHANNELS"]?.trim() || "whatsapp")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const issues: string[] = [];
  const valid = (value: string | undefined) =>
    Boolean(value?.trim() && !/YOUR_|your_auth_token/.test(value));
  if (mode !== "live" && mode !== "mock")
    issues.push("NOTIFY_MODE must be live or mock.");
  if (
    !channels.length ||
    channels.some((channel) => channel !== "sms" && channel !== "whatsapp")
  )
    issues.push("NOTIFY_CHANNELS must contain sms and/or whatsapp.");
  if (mode === "mock")
    issues.push(
      "Mock mode does not send real messages. Set NOTIFY_MODE=live after configuring Twilio.",
    );
  if (!valid(env["TWILIO_ACCOUNT_SID"]))
    issues.push("Configure TWILIO_ACCOUNT_SID.");
  if (!valid(env["TWILIO_AUTH_TOKEN"]))
    issues.push("Configure TWILIO_AUTH_TOKEN.");
  if (
    channels.includes("whatsapp") &&
    !valid(env["TWILIO_WHATSAPP_FROM"] || env["TWILIO_WHATSAPP_NUMBER"])
  )
    issues.push(
      "Configure TWILIO_WHATSAPP_FROM with an approved WhatsApp sender.",
    );
  if (
    channels.includes("sms") &&
    !valid(env["TWILIO_SMS_FROM"] || env["TWILIO_PHONE_NUMBER"])
  )
    issues.push("Configure TWILIO_SMS_FROM with an SMS-capable sender.");
  return {
    mode,
    channels,
    issues,
    ready: mode === "live" && issues.length === 0,
  };
}
