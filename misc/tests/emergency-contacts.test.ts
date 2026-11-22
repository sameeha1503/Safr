import { test, describe } from "node:test";
import assert from "node:assert";
import { EMERGENCY_CONTACTS, EMERGENCY_NUMBERS } from "../../frontend/src/lib/emergency-contacts.ts";

describe("Emergency Contacts", () => {
  test("ids are unique", () => {
    const ids = EMERGENCY_CONTACTS.map((c) => c.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size);
  });

  test("every phone matches format", () => {
    const phoneRegex = /^\+?\d{3,15}$/;
    EMERGENCY_CONTACTS.forEach((c) => {
      const stripped = c.phone.replace(/\s+/g, "");
      assert.match(stripped, phoneRegex);
    });
  });

  test("no two verified contacts share the same name", () => {
    const verifiedContacts = EMERGENCY_CONTACTS.filter((c) => c.verified);
    const names = verifiedContacts.map((c) => c.name);
    const uniqueNames = new Set(names);
    assert.strictEqual(names.length, uniqueNames.size);
  });

  test("EMERGENCY_NUMBERS values exist as verified contacts", () => {
    const verifiedPhones = EMERGENCY_CONTACTS.filter((c) => c.verified).map((c) => c.phone);
    Object.values(EMERGENCY_NUMBERS).forEach((num) => {
      assert.ok(verifiedPhones.includes(num));
    });
  });
});
