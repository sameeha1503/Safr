/** Public messages never expose raw database errors, SQL, or credentials. */
export const TRACKING_SETUP_MESSAGE =
  "Reunite setup is incomplete on the server. Ask the administrator to finish the database and server configuration. Emergency call buttons still work.";

export function trackingFailureKind(
  error: unknown,
): "setup" | "trip" | "session" | "temporary" {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Reunite setup is incomplete")) return "setup";
  if (message.includes("Set up a trip first")) return "trip";
  if (message.startsWith("Unauthorized:")) return "session";
  return "temporary";
}

export function trackingDatabaseError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;
  if (
    ["PGRST205", "PGRST202", "42P01", "42703", "42883"].includes(String(code))
  ) {
    return TRACKING_SETUP_MESSAGE;
  }
  return "Family coordination is temporarily unavailable. Please retry. Emergency call buttons still work.";
}
