import { supabaseAdmin } from "../integrations/supabase/client.server";
import { sendSafeTagAlert, normalizeE164, maskPhone } from "./notifications.server";
import { resolvedCentre } from "./resolved-centre";
import {
  checkRateLimit,
  sanitizeCoordinates,
  sanitizeText,
} from "./rate-limit.server";

export async function handleTagAlertRequest(
  request: Request,
  code: string,
): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "127.0.0.1";

    const cleanCode = code.toUpperCase().trim();
    if (!cleanCode || cleanCode.length > 20) {
      return Response.json(
        { error: "Invalid tag code format." },
        { status: 400 },
      );
    }

    const rateCheck = checkRateLimit(clientIp, cleanCode);
    if (!rateCheck.allowed) {
      return Response.json(
        {
          error:
            "Too many alert requests. Please wait a few minutes before trying again.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfterSec || 60) },
        },
      );
    }

    let body: {
      location?: unknown;
      finderContact?: unknown;
      lat?: unknown;
      lng?: unknown;
    } = {};
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return Response.json(
          { error: "Invalid alert details." },
          { status: 400 },
        );
      }
      body = parsed;
    } catch {
      // Body can be empty if finder sent no notes
    }

    const locationText = sanitizeText(body.location, 500);
    const finderContact = sanitizeText(body.finderContact, 100);
    const coordinates = resolvedCentre(
      sanitizeCoordinates(body.lat),
      sanitizeCoordinates(body.lng),
    );
    const lat = coordinates?.lat ?? null;
    const lng = coordinates?.lng ?? null;

    if (
      !process.env["SUPABASE_URL"] ||
      !process.env["SUPABASE_SERVICE_ROLE_KEY"]
    ) {
      return Response.json(
        {
          error:
            "Alert delivery is temporarily unavailable. Please contact the guardian using another available method.",
        },
        { status: 503 },
      );
    }
    // Load tag and guardian details server-side ONLY
    const { data: tag, error: tagError } = await supabaseAdmin
      .from("safety_tags")
      .select("id, token, person_name, guardian_name, guardian_phone")
      .eq("token", cleanCode)
      .abortSignal(AbortSignal.timeout(6000))
      .maybeSingle();

    if (tagError || !tag) {
      return Response.json(
        { error: "Tag not found or inactive." },
        { status: 404 },
      );
    }

    const timeIst =
      new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }) + " IST";

    // Validate guardian phone number before attempting alert
    const normalizedGuardian = normalizeE164(tag.guardian_phone);
    if (!normalizedGuardian) {
      console.error(
        `[SafeTag Alert] Invalid guardian phone number on tag ${tag.token} (${maskPhone(tag.guardian_phone)}). Alert aborted.`,
      );
      return Response.json(
        { error: "Invalid guardian phone number on this SafeTag. Alert could not be sent." },
        { status: 400 },
      );
    }

    // Send notifications (WhatsApp then SMS)
    const deliveryStatus = await sendSafeTagAlert({
      childName: tag.person_name,
      code: tag.token,
      locationText,
      finderContact,
      lat,
      lng,
      guardianPhone: tag.guardian_phone,
      timeIst,
    });

    const notified = Object.values(deliveryStatus).some(
      (ch) => ch?.status === "sent" || ch?.status === "mocked",
    );

    if (!notified) {
      console.error(
        "[SafeTag Alert] Guardian notification failed across all channels:",
        deliveryStatus,
      );
    }

    // Save alert record in database
    const { error: scanError } = await supabaseAdmin
      .from("safety_tag_scans")
      .insert({
        safety_tag_id: tag.id,
        finder_note: locationText,
        finder_contact: finderContact,
        lat,
        lng,
        delivery_status: deliveryStatus,
      })
      .abortSignal(AbortSignal.timeout(6000));

    if (scanError) {
      console.error("[SafeTag Alert] Error saving scan record:", scanError);
    }

    // Return strictly sanitized response - zero guardian data leakage
    return Response.json({ success: true, notified }, { status: 200 });
  } catch (err) {
    console.error("[SafeTag Alert] Unhandled exception:", err);
    return Response.json(
      { error: "Could not send alert. Please try again." },
      { status: 500 },
    );
  }
}
