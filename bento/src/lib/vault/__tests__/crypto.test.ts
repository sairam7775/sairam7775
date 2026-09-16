import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { BookingRefError, canEncrypt, decryptRef, encryptRef, maskRef } from "../crypto";

const KEY = randomBytes(32).toString("base64");
let saved: string | undefined;

beforeEach(() => {
  saved = process.env.BENTO_BOOKING_REF_KEY;
  process.env.BENTO_BOOKING_REF_KEY = KEY;
});
afterEach(() => {
  if (saved === undefined) delete process.env.BENTO_BOOKING_REF_KEY;
  else process.env.BENTO_BOOKING_REF_KEY = saved;
});

describe("booking references", () => {
  it("round-trips a PNR", () => {
    expect(decryptRef(encryptRef("ABC123"))).toBe("ABC123");
    expect(decryptRef(encryptRef("  HK-4471902  "))).toBe("HK-4471902");
  });

  it("never produces the same ciphertext twice", () => {
    const a = encryptRef("ABC123");
    const b = encryptRef("ABC123");
    expect(a).not.toBe(b);
    expect(a.split(".")[1]).not.toBe(b.split(".")[1]);
    expect(decryptRef(a)).toBe(decryptRef(b));
  });

  it("never contains the plaintext", () => {
    expect(encryptRef("ABC123")).not.toContain("ABC123");
  });

  it("refuses a tampered ciphertext rather than returning rubbish", () => {
    const stored = encryptRef("ABC123");
    const [v, nonce, body] = stored.split(".");
    const bytes = Buffer.from(body, "base64url");
    bytes[0] ^= 0xff;
    expect(() => decryptRef(`${v}.${nonce}.${bytes.toString("base64url")}`)).toThrow(BookingRefError);
  });

  it("says plainly when the key has changed", () => {
    const stored = encryptRef("ABC123");
    process.env.BENTO_BOOKING_REF_KEY = randomBytes(32).toString("base64");
    expect(() => decryptRef(stored)).toThrow(/encryption key has changed/);
  });

  it("refuses a missing or wrong-sized key instead of storing in the clear", () => {
    delete process.env.BENTO_BOOKING_REF_KEY;
    expect(canEncrypt()).toBe(false);
    expect(() => encryptRef("ABC123")).toThrow(/BENTO_BOOKING_REF_KEY is not set/);
    process.env.BENTO_BOOKING_REF_KEY = Buffer.from("too short").toString("base64");
    expect(canEncrypt()).toBe(false);
    expect(() => encryptRef("ABC123")).toThrow(/32 bytes/);
  });

  it("rejects a format it cannot read", () => {
    expect(() => decryptRef("nonsense")).toThrow(/not in a format/);
    expect(() => decryptRef("v1.abc.def")).toThrow(/malformed/);
  });

  it("masks to the last three characters, and never leaks a short one", () => {
    expect(maskRef("HK-4471902")).toBe("•••902");
    expect(maskRef("AB")).toBe("•••");
    expect(maskRef("ABCD")).toBe("•••BCD");
  });
});
