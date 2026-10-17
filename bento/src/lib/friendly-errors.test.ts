import { describe, expect, it } from "vitest";
import { authErrorMessage, dbErrorMessage } from "./friendly-errors";
import { copy } from "@/copy";

describe("authErrorMessage", () => {
  it("maps known Supabase auth codes", () => {
    expect(authErrorMessage({ code: "user_already_exists" })).toBe(copy.auth.supabase.user_already_exists);
    expect(authErrorMessage({ code: "same_password" })).toBe(copy.auth.supabase.same_password);
    expect(authErrorMessage({ code: "email_not_confirmed" })).toBe(copy.auth.supabase.email_not_confirmed);
  });

  it("treats any 429 as a rate limit", () => {
    expect(authErrorMessage({ status: 429, code: "something_new" })).toBe(copy.auth.supabase.over_request_rate_limit);
  });

  it("ignores inherited keys", () => {
    expect(authErrorMessage({ code: "constructor" })).toBe(copy.auth.serverError);
  });

  it("never echoes an unknown raw message", () => {
    const msg = authErrorMessage({ code: "unexpected_failure", message: "AuthApiError: relation auth.users xyz" });
    expect(msg).not.toMatch(/AuthApiError|relation/);
  });
});

describe("dbErrorMessage", () => {
  it("names the action and hides the database text", () => {
    const msg = dbErrorMessage({ code: "XX000", message: "duplicate key value violates unique constraint" }, "save the trip");
    expect(msg).toBe(copy.db.failed("save the trip"));
  });

  it("explains a refused row and invalid input", () => {
    expect(dbErrorMessage({ code: "42501" }, "save the booking")).toBe(copy.db.noAccess("save the booking"));
    expect(dbErrorMessage({ code: "22007" }, "save the trip")).toBe(copy.db.invalid("save the trip"));
  });
});
