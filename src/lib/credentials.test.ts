import { expect, it } from "vitest";
import { credentials, normalizeName } from "./credentials";

it("derives stable, distinct logins per player", async () => {
  const a = await credentials("alice");
  expect(await credentials("alice")).toEqual(a);
  expect((await credentials("bob")).email).not.toBe(a.email);
  expect(a.email).toMatch(/^[0-9a-f]{32}@players\.reidle\.app$/);
  expect(a.password.length).toBeGreaterThanOrEqual(6);
});

it("normalizes names like the legacy sign-in", () => {
  expect(normalizeName("  Al Ice  ")).toBe("alice");
  expect(normalizeName("averyveryverylongname")).toHaveLength(15);
});
