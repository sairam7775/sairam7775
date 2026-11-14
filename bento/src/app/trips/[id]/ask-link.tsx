"use client";

import type { ReactNode } from "react";
import { askBentoMan } from "./ask-event";

/** A link that asks Bento Man on this page. Without JavaScript (or opened
 *  in a new tab) the address does the same job: `?ask=` fills the box. */
export function AskLink({ href, question, className, children }: { href: string; question: string; className: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        askBentoMan(question);
      }}
    >
      {children}
    </a>
  );
}
