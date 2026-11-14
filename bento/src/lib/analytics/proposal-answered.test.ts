import { describe, expect, it, vi } from "vitest";
import { answeredRecorder } from "./proposal-answered";

const props = { answer: "accepted", proposal_id: "m1", route: true, dates: false, days: 3, verdict: "fine" } as const;

describe("proposal_answered is recorded once per answer", () => {
  it("drops the second report of the same answer, whichever part of the page sends it", () => {
    const send = vi.fn();
    const record = answeredRecorder(send);
    record(props); // the proposal card
    record(props); // Bookings' landing
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("proposal_answered", props);
  });

  it("still records a different proposal, or a different answer", () => {
    const send = vi.fn();
    const record = answeredRecorder(send);
    record(props);
    record({ ...props, proposal_id: "m2" });
    record({ ...props, answer: "rejected" });
    expect(send).toHaveBeenCalledTimes(3);
  });
});
