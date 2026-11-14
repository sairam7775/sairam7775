import { describe, expect, it, vi } from "vitest";
import { askBentoMan, onAsk } from "./ask-event";

describe("asking Bento Man from a button on the page", () => {
  it("reaches the chat every time, even the same question twice", () => {
    const target = new EventTarget();
    const heard = vi.fn();
    onAsk(heard, target);
    askBentoMan("Where should we stay on 12 April?", target);
    askBentoMan("Where should we stay on 12 April?", target);
    expect(heard).toHaveBeenCalledTimes(2);
    expect(heard).toHaveBeenLastCalledWith("Where should we stay on 12 April?");
  });

  it("stops listening when told to", () => {
    const target = new EventTarget();
    const heard = vi.fn();
    const stop = onAsk(heard, target);
    stop();
    askBentoMan("Anything?", target);
    expect(heard).not.toHaveBeenCalled();
  });

  it("ignores an event that carries no question", () => {
    const target = new EventTarget();
    const heard = vi.fn();
    onAsk(heard, target);
    target.dispatchEvent(new CustomEvent("bento-man:ask", { detail: 42 }));
    expect(heard).not.toHaveBeenCalled();
  });
});
