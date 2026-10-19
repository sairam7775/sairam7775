import type { ComponentType } from "react";

/** A loader for React.lazy that never rejects: if the component's code can't
 *  load (offline, or an old chunk gone after a deploy), it gives `fallback`.
 *  React.lazy remembers a rejection and rethrows it on every render, which
 *  inside the error and not-found pages would take the whole page down. */
export function withFallback<P>(load: () => Promise<ComponentType<P>>, fallback: ComponentType<P>): () => Promise<{ default: ComponentType<P> }> {
  return () => load().then((component) => ({ default: component }), () => ({ default: fallback }));
}
