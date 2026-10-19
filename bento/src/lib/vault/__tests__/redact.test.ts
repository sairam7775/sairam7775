import { describe, expect, it } from "vitest";
import { redactConfirmation } from "../redact";

describe("redactConfirmation", () => {
  it("removes a labelled booking reference and keeps it for the form", () => {
    const r = redactConfirmation("Booking reference: ABC123\nFlight NH 846 Tokyo → Osaka on 2026-11-20 at 10:30");
    expect(r.reference).toBe("ABC123");
    expect(r.text).not.toContain("ABC123");
    expect(r.text).toContain("NH 846");
    expect(r.text).toContain("2026-11-20");
    expect(r.text).toContain("10:30");
  });

  it.each([
    ["Confirmation number 4821-993-117", "4821-993-117"],
    ["PNR: XK7Q2M", "XK7Q2M"],
    ["Record locator - QWERTY", "QWERTY"],
    ["Reservation No. HTL-88231", "HTL-88231"],
    ["予約番号：R0098812", "R0098812"],
    ["Your booking ID is 98123376", "98123376"],
    ["E-ticket number 2052412345678", "2052412345678"],
  ])("recognises %s", (text, ref) => {
    const r = redactConfirmation(`Thank you.\n${text}\nCheck-in 2026-11-20`);
    expect(r.reference).toBe(ref);
    expect(r.text).not.toContain(ref);
    expect(r.text).toContain("Check-in 2026-11-20");
  });

  it.each([
    ["Reference number: ABC123", "ABC123"],
    ["Reference: ZX81-4402", "ZX81-4402"],
    ["Ref. 99812733", "99812733"],
  ])("recognises a reference labelled on its own: %s", (text, ref) => {
    const r = redactConfirmation(`${text}\nArrive 2026-11-20`);
    expect(r.reference).toBe(ref);
    expect(r.text).not.toContain(ref);
  });

  it.each([
    ["Confirmation number: ABC 123 456", "ABC 123 456"],
    ["Booking reference: AB/12345", "AB/12345"],
    ["Order number: ORD_88_2041", "ORD_88_2041"],
  ])("takes a reference with spaces, slashes or underscores out whole: %s", (text, ref) => {
    const r = redactConfirmation(`${text} for your stay\nArrive 2026-11-20`);
    expect(r.reference).toBe(ref);
    expect(r.text).not.toMatch(/123 456|12345|2041/);
    expect(r.text).toContain("for your stay");
  });

  it("takes a lowercase reference that stands alone at the end of its line", () => {
    const r = redactConfirmation("Booking reference: abcdef\nArrive 2026-11-20");
    expect(r.reference).toBe("abcdef");
    expect(r.text).not.toContain("abcdef");
  });

  it("leaves an ordinary lowercase word after a label in a sentence", () => {
    const r = redactConfirmation("Booking reference: please see the attached PDF.");
    expect(r.reference).toBeNull();
    expect(r.text).toContain("please see the attached PDF.");
  });

  it("doesn't read a word that only contains a label, such as Preference", () => {
    const r = redactConfirmation("Preference: 2 single beds, room 1204");
    expect(r.reference).toBeNull();
  });

  it("takes a long reference out whole, and only keeps one that fits the form", () => {
    const long = "ORD-2026-11-20-KYOTO-4F7A9C21B";
    const r = redactConfirmation(`Order number: ${long}\nArrive 2026-11-20`);
    expect(r.reference).toBe(long);
    expect(r.text).not.toContain("4F7A9C21B");

    const tooLong = `ORD-${"A1".repeat(40)}`;
    const t = redactConfirmation(`Order number: ${tooLong}`);
    expect(t.text).not.toContain("A1A1");
    // Longer than the form's 60 characters: taken out, but not offered.
    expect(t.reference).toBeNull();
  });

  it("never takes the next line along with a phone number", () => {
    const r = redactConfirmation("Tel: +81 75 123 4567\n2026-11-20\nCheck-in 15:00");
    expect(r.text).not.toContain("123 4567");
    expect(r.text).toContain("\n2026-11-20\nCheck-in 15:00");
  });

  it("doesn't take an ordinary word after a label for a reference", () => {
    const r = redactConfirmation("Confirmation of your booking at Hotel Kanra Kyoto");
    expect(r.reference).toBeNull();
    expect(r.text).toBe("Confirmation of your booking at Hotel Kanra Kyoto");
  });

  it("removes email addresses and labelled or international phone numbers", () => {
    const r = redactConfirmation("Contact: sai.r@example.com, Tel: 03-1234-5678, or +81 75 123 4567 from abroad.");
    expect(r.text).not.toMatch(/example\.com|1234-5678|123 4567/);
    expect(r.text).toContain("Contact:");
    expect(r.text).toContain("from abroad.");
  });

  it("removes long card and ticket numbers but keeps dates, times, prices and flight numbers", () => {
    const r = redactConfirmation("Card 4111 1111 1111 1111 charged ¥12,000 for JL 123 on 2026-11-20 10:30–12:05.");
    expect(r.text).not.toContain("4111");
    expect(r.text).toContain("¥12,000");
    expect(r.text).toContain("JL 123");
    expect(r.text).toContain("2026-11-20 10:30–12:05");
  });

  it("leaves a confirmation with nothing to remove as it was", () => {
    const text = "Hotel Kanra Kyoto, 2 nights from 20 November 2026, check-in from 15:00.";
    expect(redactConfirmation(text)).toEqual({ text, reference: null });
  });
});
