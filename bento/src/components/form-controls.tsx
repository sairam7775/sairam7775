"use client";

import { useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { copy } from "@/copy";
import { summariseDateRange } from "@/lib/trips/date-range-summary";
import { confirmSubmit } from "./confirm-submit";

/** Opens the browser's calendar on a click anywhere in the field, not just
 *  on the small icon (Chrome only opens it from the icon). */
function openPicker(e: MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // showPicker throws without a user gesture or in a cross-origin frame;
    // the field still works by typing.
  }
}

export function DateInput(props: Omit<ComponentProps<"input">, "type"> & { type?: "date" | "datetime-local" }) {
  return <input type="date" {...props} onClick={(e) => { openPicker(e); props.onClick?.(e); }} />;
}

/** Arrive and leave, where leave can't be picked before arrive. */
export function DateRangeInputs({
  startName = "startDate",
  endName = "endDate",
  startLabel,
  endLabel,
  defaultStart,
  defaultEnd,
  labelClass,
  inputClass,
}: {
  startName?: string;
  endName?: string;
  startLabel: ReactNode;
  endLabel: ReactNode;
  defaultStart?: string | null;
  defaultEnd?: string | null;
  labelClass: string;
  inputClass: string;
}) {
  const [start, setStart] = useState(defaultStart ?? "");
  const [end, setEnd] = useState(defaultEnd ?? "");
  const summary = summariseDateRange(start, end);
  const summaryId = `${startName}-date-words`;
  const summaryText = summary?.kind === "arrival"
    ? copy.trips.new.datesInWords.arrival(formatDateInWords(summary.date))
    : summary?.kind === "departure"
      ? copy.trips.new.datesInWords.departure(formatDateInWords(summary.date))
      : summary?.kind === "range"
        ? copy.trips.new.datesInWords.range(
          formatDateInWords(summary.start),
          formatDateInWords(summary.end),
          summary.nights,
        )
        : summary?.kind === "endBeforeStart"
          ? copy.trips.errors.endBeforeStart
          : "";
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={startName} className={labelClass}>{startLabel}</label>
        <DateInput
          id={startName}
          name={startName}
          value={start}
          aria-describedby={summaryId}
          onChange={(e) => setStart(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={endName} className={labelClass}>{endLabel}</label>
        <DateInput id={endName} name={endName} value={end} min={start || undefined} aria-describedby={summaryId} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
      </div>
      <p
        id={summaryId}
        aria-live="polite"
        hidden={!summaryText}
        className={`col-span-full text-[0.85rem] ${summary?.kind === "endBeforeStart" ? "text-ume" : "text-ink-2"}`}
      >
        {summaryText}
      </p>
    </>
  );
}

function formatDateInWords(date: string) {
  return new Intl.DateTimeFormat(copy.locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .formatToParts(new Date(`${date}T00:00:00Z`))
    .filter((part) => part.type !== "literal")
    .map((part) => part.value)
    .join(" ");
}

/** A password field with a Show / Hide toggle, so a typo can be checked
 *  before it locks someone out. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? "text" : "password"} className={`${className ?? ""} pr-16`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-label={shown ? copy.form.hidePassword : copy.form.showPassword}
        className="absolute inset-y-1 right-1 rounded-lg px-3 text-[0.8rem] font-medium text-ink-2 hover:bg-sunk"
      >
        {shown ? copy.form.hide : copy.form.show}
      </button>
    </div>
  );
}

/** A submit button that says it's working and can't be pressed twice. */
export function SubmitButton({ children, pending: pendingLabel, className }: { children: ReactNode; pending: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** One option in a group of submit buttons that share a `name` (Settings →
 *  Theme, Background). While the form saves, every option is disabled and the
 *  one pressed says "Saving…". */
export function ChoiceButton({ name, value, pressed, className, children }: { name: string; value: string; pressed: boolean; className?: string; children: ReactNode }) {
  const { pending, data } = useFormStatus();
  const saving = pending && data?.get(name) === value;
  return (
    <button type="submit" name={name} value={value} aria-pressed={pressed} disabled={pending} aria-busy={saving} className={`${className ?? ""} disabled:cursor-wait`}>
      {saving ? copy.common.saving : children}
    </button>
  );
}

/** A submit button that asks first. For things that can't be undone. It asks
 *  only once the form is filled in (confirmSubmit). With `pending`, it says
 *  it's working once confirmed, like SubmitButton. */
export function ConfirmButton({ children, message, pending: pendingLabel, className, ...rest }: ComponentProps<"button"> & { message: string; pending?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...rest}
      disabled={pending || rest.disabled}
      aria-busy={pending}
      className={`${className ?? ""} disabled:opacity-50`}
      onClick={(e) => {
        if (!confirmSubmit(e.currentTarget.form, () => window.confirm(message))) e.preventDefault();
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
