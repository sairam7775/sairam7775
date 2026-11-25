"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { addCustomStop, addPlaceToDay, placesForDay, type AddCustomResult, type AddPlaceResult, type DayPlaceOption } from "./day-actions";
import { copy } from "@/copy";
import { track } from "@/lib/analytics/client";
import { searchPlaces, simplifyName } from "@/lib/trips/place-search";
import { customStopKey } from "@/lib/bento-man/custom-stop";

const ad = copy.day.addPlace;
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const SHOWN = 8;
/** Lengths offered for a place Bento doesn't know; an hour unless changed. */
const LENGTHS = [30, 60, 90, 120, 180, 240];
const DEFAULT_LENGTH = 60;
/** As the action and the database take a name. */
const NAME_MAX = 80;

type Step =
  | { kind: "search" }
  | { kind: "checking"; name: string }
  | { kind: "result"; result: AddPlaceResult; placeId: string }
  | { kind: "custom"; name: string }
  | { kind: "customResult"; result: AddCustomResult };

/** "Add a place" on a planned day: search Bento's places in the day's city,
 *  pick one, and the server checks it against the day in the engine before
 *  it goes in (`addPlaceToDay`), or types a name Bento doesn't know and it
 *  goes in unchecked for the length given (`addCustomStop`). Every word
 *  comes from the server's result through `copy.day.addPlace`; this
 *  component decides nothing.
 *
 *  A native modal dialog: it keeps focus inside, closes on Escape and gives
 *  focus back to the button. On a phone it is a sheet from the bottom. */
export function AddPlace({ tripId, date, cityName }: { tripId: string; date: string; cityName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const hintId = useId();
  const [places, setPlaces] = useState<DayPlaceOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [pending, start] = useTransition();

  const matches = useMemo(() => searchPlaces(places ?? [], query).slice(0, SHOWN), [places, query]);

  function open() {
    setStep({ kind: "search" });
    setQuery("");
    dialog.current?.showModal();
    // The list is read each time it opens: the day may have changed.
    setLoadError(null);
    start(async () => {
      const r = await placesForDay({ tripId, date });
      if ("error" in r) setLoadError(r.error);
      else setPlaces(r.places);
    });
  }

  function close() {
    dialog.current?.close();
  }

  function backToSearch() {
    setStep({ kind: "search" });
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function add(place: { id: string; name: string }, anyway: boolean) {
    setStep({ kind: "checking", name: place.name });
    start(async () => {
      const result = await addPlaceToDay({ tripId, date, placeId: place.id, anyway });
      setStep({ kind: "result", result, placeId: place.id });
      track("place_added", {
        result: result.status === "added" ? (result.fits ? "fits" : "anyway") : result.status === "doesnt-fit" ? "doesnt_fit" : "error",
        problems: result.status === "error" ? 0 : result.problems.length,
      });
      // Say the outcome where focus is, so a screen reader reads it.
      requestAnimationFrame(() => resultRef.current?.focus());
    });
  }

  function addCustom(name: string, durationMin: number) {
    setStep({ kind: "checking", name });
    start(async () => {
      const result = await addCustomStop({ tripId, date, name, durationMin });
      setStep({ kind: "customResult", result });
      track("place_added", { result: result.status === "added" ? "custom" : "error", problems: result.status === "added" ? result.problems.length : 0 });
      requestAnimationFrame(() => resultRef.current?.focus());
    });
  }

  // A name Bento doesn't have: offered as the traveller's own stop, unless
  // it is one of the matches already.
  const typed = query.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  const offerCustom = places != null && typed !== "" && customStopKey(typed) != null
    && !matches.some((p) => simplifyName(p.name) === simplifyName(typed));

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="tile flex min-h-11 w-full items-center justify-center gap-2 border-2 border-dashed border-rice/40 bg-transparent px-4 text-[0.9rem] font-medium text-rice hover:border-rice/70"
      >
        <span aria-hidden>+</span>
        {ad.open}
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onClick={(e) => { if (e.target === dialog.current) close(); }}
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-paper p-0 text-ink shadow-tile backdrop:bg-ink/40 sm:m-auto sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex flex-col gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="disp text-[1.3rem] font-bold leading-tight">{ad.title}</h2>
            <button type="button" onClick={close} className="min-h-10 rounded-full px-3 text-[0.85rem] text-ink-2 hover:bg-sunk">{ad.close}</button>
          </div>
          <p id={hintId} className="text-[0.88rem] leading-snug text-ink-2">{ad.intro(cityName)}</p>

          {step.kind === "search" && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.82rem] font-medium text-ink-2">{ad.searchLabel}</span>
                <input
                  ref={searchRef}
                  type="search"
                  autoFocus
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={ad.searchHint(cityName)}
                  className="h-11 rounded-xl border border-rule bg-paper px-3 text-[1rem] text-ink"
                />
              </label>
              {loadError && <p role="alert" className="text-[0.86rem] text-ume">{loadError}</p>}
              {places == null && !loadError && <p className="text-[0.86rem] text-ink-3">{ad.loading}</p>}
              {places != null && (
                <>
                  <p aria-live="polite" className="sr-only">{query ? (matches.length ? ad.found(matches.length) : ad.noMatch(cityName)) : ""}</p>
                  {query && matches.length === 0 && <p className="text-[0.86rem] text-ink-2">{ad.noMatch(cityName)}</p>}
                  <ul className="flex flex-col gap-1.5">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={p.onDay || pending}
                          onClick={() => add(p, false)}
                          className="flex min-h-11 w-full items-baseline gap-2 rounded-xl bg-surface px-3 py-2 text-left shadow-tile hover:bg-sunk disabled:opacity-60"
                        >
                          <span className="font-medium">{p.name}</span>
                          {p.nameJa && <span lang="ja" className="text-[0.8rem] text-ink-3">{p.nameJa}</span>}
                          <span className="mono ml-auto shrink-0 text-[0.66rem] text-ink-3">{p.onDay ? ad.onDay : p.category}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {offerCustom && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setStep({ kind: "custom", name: typed })}
                      className="flex min-h-11 w-full flex-col items-start rounded-xl border border-dashed border-rule px-3 py-2 text-left hover:bg-sunk disabled:opacity-60"
                    >
                      <span className="font-medium">{ad.custom.offer(typed)}</span>
                      <span className="text-[0.78rem] text-ink-3">{ad.custom.offerNote}</span>
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {step.kind === "custom" && <CustomStop name={step.name} pending={pending} onAdd={addCustom} onBack={backToSearch} />}

          {step.kind === "customResult" && (
            <div ref={resultRef} tabIndex={-1} className="flex flex-col gap-3 outline-none">
              {step.result.status === "error" ? (
                <p role="alert" className="text-[0.92rem] text-ume">{step.result.error}</p>
              ) : (
                <>
                  <p role="status" className="text-[0.95rem] leading-snug">{ad.custom.added(step.result.name, step.result.startMin != null ? clock(step.result.startMin) : null)}</p>
                  {step.result.problems.length > 0 && (
                    <div className="text-[0.88rem]">
                      <p className="text-ink-2">{ad.custom.clockLabel}</p>
                      <Problems items={step.result.problems.map((p) => p.text)} />
                    </div>
                  )}
                  <Notes notes={step.result.notes} />
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={close} className="min-h-11 rounded-full bg-lacquer px-5 text-[0.9rem] font-medium text-rice">{ad.done}</button>
                <button type="button" onClick={backToSearch} className="min-h-11 rounded-full border border-rule bg-surface px-5 text-[0.9rem] text-ink-2">{ad.back}</button>
              </div>
            </div>
          )}

          {step.kind === "checking" && <p role="status" className="text-[0.9rem] text-ink-2">{ad.checking(step.name)}</p>}

          {step.kind === "result" && (
            <div ref={resultRef} tabIndex={-1} className="flex flex-col gap-3 outline-none">
              <Outcome result={step.result} />
              <div className="flex flex-wrap gap-2">
                {step.result.status === "doesnt-fit" ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => add({ id: step.placeId, name: (step.result as { name: string }).name }, true)}
                      className="min-h-11 rounded-full bg-accent px-5 text-[0.9rem] font-medium text-on-accent disabled:opacity-60"
                    >
                      {ad.addAnyway}
                    </button>
                    <button type="button" onClick={backToSearch} className="min-h-11 rounded-full border border-rule bg-surface px-5 text-[0.9rem] text-ink-2">{ad.notNow}</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={close} className="min-h-11 rounded-full bg-lacquer px-5 text-[0.9rem] font-medium text-rice">{ad.done}</button>
                    <button type="button" onClick={backToSearch} className="min-h-11 rounded-full border border-rule bg-surface px-5 text-[0.9rem] text-ink-2">{ad.back}</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

/** The engine's answer, in its own clauses. */
function Outcome({ result }: { result: AddPlaceResult }) {
  if (result.status === "error") return <p role="alert" className="text-[0.92rem] text-ume">{result.error}</p>;
  const notes = <Notes notes={result.notes} />;
  if (result.status === "added") {
    const at = result.startMin != null ? clock(result.startMin) : null;
    return (
      <>
        <p role="status" className="text-[0.95rem] leading-snug">
          {result.fits ? (at ? ad.fits(result.name, at, result.praise) : ad.fitsUntimed(result.name)) : ad.addedAnyway(result.name, at)}
        </p>
        {!result.fits && <Problems items={result.problems.map((p) => p.text)} />}
        {notes}
      </>
    );
  }
  return (
    <>
      <p className="text-[0.95rem] font-medium leading-snug">{ad.doesntFit(result.name)}</p>
      <Problems items={result.problems.map((p) => p.text)} />
      <p className="text-[0.88rem] text-ink-2">{ad.anywayNote}</p>
      {notes}
    </>
  );
}

/** What Bento can't check, said either way. */
function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div className="text-[0.82rem] text-ink-3">
      <p>{ad.notesLabel}</p>
      <ul className="mt-1 list-disc pl-5">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}

/** A place Bento doesn't know: said plainly, and a length to give it. */
function CustomStop({ name, pending, onAdd, onBack }: { name: string; pending: boolean; onAdd: (name: string, durationMin: number) => void; onBack: () => void }) {
  const [length, setLength] = useState(DEFAULT_LENGTH);
  const lengthId = useId();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.92rem] leading-snug">{ad.custom.cantCheck(name)}</p>
      <label htmlFor={lengthId} className="text-[0.82rem] font-medium text-ink-2">{ad.custom.lengthLabel}</label>
      <select
        id={lengthId}
        value={length}
        onChange={(e) => setLength(Number(e.target.value))}
        className="h-11 rounded-xl border border-rule bg-paper px-3 text-[1rem] text-ink"
      >
        {LENGTHS.map((m) => <option key={m} value={m}>{copy.time.duration(m)}</option>)}
      </select>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => onAdd(name, length)} className="min-h-11 rounded-full bg-accent px-5 text-[0.9rem] font-medium text-on-accent disabled:opacity-60">{ad.custom.add}</button>
        <button type="button" onClick={onBack} className="min-h-11 rounded-full border border-rule bg-surface px-5 text-[0.9rem] text-ink-2">{ad.back}</button>
      </div>
    </div>
  );
}

function Problems({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1 rounded-xl bg-tamago-soft px-4 py-3 text-[0.88rem] leading-snug text-ink">
      {items.map((t) => <li key={t}>{t.replace(/^./, (c) => c.toUpperCase())}</li>)}
    </ul>
  );
}
