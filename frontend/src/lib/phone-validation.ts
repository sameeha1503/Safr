export function normalizePhone(raw: string): string {
  return raw
    .trim()
    .replace(/[\s.()-]/g, "")
    .replace(/^\+/, "");
}

export function validatePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "Please enter your phone number.";
  }
  if (!/^\d+$/.test(trimmed)) {
    return "Phone number must contain digits only.";
  }
  if (trimmed.length < 7 || trimmed.length > 15) {
    return "Phone number must be between 7 and 15 digits.";
  }
  return null;
}

export function validateOptionalPhone(raw: string): string | null {
  const normalized = normalizePhone(raw);
  if (!normalized) return null;
  return validatePhone(normalized);
}
