import { describe, expect, it } from "vitest";
import { afterVerifyError } from "./verify-error";

describe("afterVerifyError", () => {
  it("asks for the code again when it was wrong", () => {
    expect(afterVerifyError("mfa_verification_failed", true)).toBe("wrong");
  });

  it("starts again when the setup being confirmed is gone", () => {
    expect(afterVerifyError("mfa_factor_not_found", false)).toBe("restart");
    expect(afterVerifyError(undefined, false)).toBe("restart");
  });

  it("keeps the setup and asks to try again when it is still there", () => {
    expect(afterVerifyError("over_request_rate_limit", true)).toBe("retry");
    expect(afterVerifyError(undefined, true)).toBe("retry");
  });
});
