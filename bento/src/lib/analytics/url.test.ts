import { describe, expect, it } from "vitest";
import { pathOnly } from "./url";

describe("pathOnly", () => {
  it("drops the query and hash from an address", () => {
    expect(pathOnly("https://bento.test/trips/abc?ask=Where%20should%20we%20stay#bento-man")).toBe("https://bento.test/trips/abc");
    expect(pathOnly("http://localhost:3123/trips/x/vault?add=activity&title=Ghibli")).toBe("http://localhost:3123/trips/x/vault");
  });

  it("leaves anything that isn't an address alone", () => {
    expect(pathOnly("plan_days")).toBe("plan_days");
    expect(pathOnly("/trips?x=1")).toBe("/trips?x=1");
  });
});
