import { describe, expect, it, vi } from "vitest";
import { confirmSubmit } from "./confirm-submit";

const form = (valid: boolean) => ({ checkValidity: () => valid });

describe("confirmSubmit", () => {
  it("lets an incomplete form through to the browser's own check, without the warning", () => {
    const ask = vi.fn(() => true);
    expect(confirmSubmit(form(false), ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks first when the form is complete, and goes ahead only on yes", () => {
    expect(confirmSubmit(form(true), () => true)).toBe(true);
    expect(confirmSubmit(form(true), () => false)).toBe(false);
  });

  it("asks when the button has no form", () => {
    const ask = vi.fn(() => false);
    expect(confirmSubmit(null, ask)).toBe(false);
    expect(ask).toHaveBeenCalledOnce();
  });
});
