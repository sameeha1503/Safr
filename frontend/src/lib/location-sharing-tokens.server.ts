import { randomBytes, createHash } from "node:crypto";
import { tokenSchema } from "./companion-tracking";
export function makeInviteToken() {
  return randomBytes(32).toString("hex");
}
export function hashInviteToken(token: string) {
  return createHash("sha256").update(tokenSchema.parse(token)).digest("hex");
}
