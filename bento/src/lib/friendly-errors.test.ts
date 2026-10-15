import { describe, expect, it } from "vitest";
import { authErrorMessage, dbErrorMessage } from "./friendly-errors";

describe("authErrorMessage", () => {
  it("maps known Supabase auth codes", () => {
    expect(authErrorMessage({ code: "user_already_exists" })).toMatch(/already an account/);
    expect(authErrorMessage({ code: "same_password" })).toMatch(/current password/);
    expect(authErrorMessage({ code: "email_not_confirmed" })).toMatch(/Confirm your email/);
  });

  it("treats any 429 as a rate limit", () => {
    expect(authErrorMessage({ status: 429, code: "something_new" })).toMatch(/Too many attempts/);
  });

  it("never echoes an unknown raw message", () => {
    const msg = authErrorMessage({ code: "unexpected_failure", message: "AuthApiError: relation auth.users xyz" });
    expect(msg).not.toMatch(/AuthApiError|relation/);
  });
});

describe("dbErrorMessage", () => {
  it("names the action and hides the database text", () => {
    const msg = dbErrorMessage({ code: "XX000", message: "duplicate key value violates unique constraint" }, "save the trip");
    expect(msg).toBe("Couldn't save the trip. Try again in a moment.");
  });

  it("explains a refused row and invalid input", () => {
    expect(dbErrorMessage({ code: "42501" }, "save the booking")).toMatch(/don't have access/);
    expect(dbErrorMessage({ code: "22007" }, "save the trip")).toMatch(/isn't valid/);
  });
});
