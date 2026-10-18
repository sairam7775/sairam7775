"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { copy } from "@/copy";

type Panel = "edit" | "share";

const pill = "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-rule px-4 text-[0.88rem] text-ink-2 hover:bg-sunk";

/** The trip's own actions in one row under its title (edit, download,
 *  share, and `children` after them), with the open one's panel below the
 *  whole row, one at a time. The panels are the server-rendered forms,
 *  passed in; closed ones stay in the page, hidden, so nothing typed in them
 *  is lost. */
export function TripActions({ editLabel, edit, downloadHref, share, shared, initial, children }: {
  editLabel: string;
  edit: ReactNode;
  downloadHref: string | null;
  share: ReactNode | null;
  shared: boolean;
  initial: Panel | null;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState<Panel | null>(initial);
  const toggle = (p: Panel) => setOpen((o) => (o === p ? null : p));

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-tour="edit-trip"
          aria-expanded={open === "edit"}
          aria-controls="trip-edit"
          onClick={() => toggle("edit")}
          className={`${pill} ${open === "edit" ? "bg-sunk text-ink" : ""}`}
        >
          {editLabel}
          <Chevron open={open === "edit"} />
        </button>
        {downloadHref && (
          <Link href={downloadHref} className={pill}>
            <span aria-hidden>↓</span>
            {copy.print.download}
          </Link>
        )}
        {share && (
          <button
            type="button"
            aria-expanded={open === "share"}
            aria-controls="share"
            onClick={() => toggle("share")}
            className={`${pill} ${open === "share" ? "bg-sunk text-ink" : ""}`}
          >
            {/* Green while a link is out: the one state worth seeing at a glance. */}
            {shared && <span aria-hidden className="size-2 rounded-full bg-edamame" />}
            {shared ? copy.share.openOn : copy.share.open}
            <Chevron open={open === "share"} />
          </button>
        )}
        {children}
      </div>
      <div id="trip-edit" hidden={open !== "edit"} className="mt-3 max-w-xl">
        {edit}
      </div>
      {share && (
        <div id="share" hidden={open !== "share"} className="mt-3 max-w-xl scroll-mt-6">
          {share}
        </div>
      )}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return <span aria-hidden className={`text-[0.7rem] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>;
}
