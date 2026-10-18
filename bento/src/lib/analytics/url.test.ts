import { describe, expect, it } from "vitest";
import { isSharedPath, pathOnly } from "./url";

describe("pathOnly", () => {
  it("drops the query and hash from an address", () => {
    expect(pathOnly("https://bento.test/trips/abc?ask=Where%20should%20we%20stay#bento-man")).toBe("https://bento.test/trips/abc");
    expect(pathOnly("http://localhost:3123/trips/x/vault?add=activity&title=Ghibli")).toBe("http://localhost:3123/trips/x/vault");
  });

  it("leaves anything that isn't an address alone", () => {
    expect(pathOnly("plan_days")).toBe("plan_days");
    expect(pathOnly("/trips?x=1")).toBe("/trips?x=1");
  });

  it("never lets a shared plan's key out, in an address or a path", () => {
    const key = "0123456789abcdef0123456789abcdef";
    expect(pathOnly(`https://bento.test/shared/${key}?x=1`)).toBe("https://bento.test/shared/link");
    expect(pathOnly(`/shared/${key}`)).toBe("/shared/link");
    expect(pathOnly(`came from https://bento.test/shared/${key} and /shared/${key}/`)).not.toContain(key);
  });
});

describe("isSharedPath", () => {
  it("knows a shared plan's page", () => {
    expect(isSharedPath("/shared/0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isSharedPath("/trips/abc")).toBe(false);
    expect(isSharedPath(null)).toBe(false);
  });
});
