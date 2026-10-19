"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNote } from "@/app/(auth)/ui";
import { DateRangeInputs, SubmitButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { INTEREST_TAGS } from "@/lib/types";
import { starterKey } from "@/lib/trips/guided-start";
import { copy } from "@/copy";
import { startGuidedTrip, type GuidedStartState } from "../actions";

const t = copy.trips.guided;
const PACES = ["relaxed", "standard", "packed"] as const;

// A pill that is really a radio or a checkbox: the input is hidden but
// keeps the keyboard and screen readers; the span shows its state.
const pill = "inline-flex min-h-10 cursor-pointer items-center rounded-full border border-rule px-4 text-[0.92rem] text-ink-2 peer-checked:border-accent peer-checked:bg-lacquer peer-checked:text-rice peer-focus-visible:ring-2 peer-focus-visible:ring-accent hover:bg-sunk";

export function GuidedForm({ months }: { months: { value: string; label: string }[] }) {
  const [state, action] = useActionState<GuidedStartState, FormData>(startGuidedTrip, null);
  const [when, setWhen] = useState<"dates" | "rough" | "unsure">("rough");
  const router = useRouter();

  // Started: leave the first message for the chat, and open it.
  useEffect(() => {
    if (!state?.ok) return;
    try {
      sessionStorage.setItem(starterKey(state.tripId), state.starter);
    } catch {
      // Storage can be off (private windows): the chat simply starts empty.
    }
    router.push(`/trips/${state.tripId}#bento-man`);
  }, [state, router]);

  return (
    <form action={action} className="mt-6 flex flex-col gap-7">
      {state && !state.ok && <ErrorNote message={state.error} />}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-[1.05rem] font-bold">{t.when.legend}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["dates", "rough", "unsure"] as const).map((w) => (
            <label key={w}>
              <input type="radio" name="when" value={w} checked={when === w} onChange={() => setWhen(w)} className="peer sr-only" />
              <span className={pill}>{t.when[w]}</span>
            </label>
          ))}
        </div>
        {when === "dates" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <DateRangeInputs startLabel={copy.trips.new.arrive} endLabel={copy.trips.new.leave} labelClass={fieldLabel} inputClass={fieldInput} />
          </div>
        )}
        {when === "rough" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="month" className={fieldLabel}>{t.when.month}</label>
              <select id="month" name="month" defaultValue={months[1]?.value ?? months[0]?.value} className={fieldInput}>
                {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nights" className={fieldLabel}>{t.when.nights}</label>
              <input id="nights" name="nights" type="number" min={1} max={30} inputMode="numeric" placeholder={t.when.nightsPlaceholder} className={fieldInput} />
            </div>
          </div>
        )}
      </fieldset>

      <div className="flex max-w-xs flex-col gap-1.5">
        <label htmlFor="people" className="text-[1.05rem] font-bold">{t.people}</label>
        <input id="people" name="people" type="number" min={1} max={20} defaultValue={1} className={fieldInput} />
      </div>

      <fieldset>
        <legend className="text-[1.05rem] font-bold">{t.pace.legend}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PACES.map((p) => (
            <label key={p}>
              <input type="radio" name="pace" value={p} className="peer sr-only" />
              <span className="flex h-full cursor-pointer flex-col rounded-tile border border-rule px-4 py-3 peer-checked:border-accent peer-checked:bg-lacquer peer-checked:text-rice peer-focus-visible:ring-2 peer-focus-visible:ring-accent hover:bg-sunk">
                <span className="font-medium">{t.pace[p]}</span>
                <span className="text-[0.84rem] opacity-80">{t.paceHints[p]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[1.05rem] font-bold">{t.interests}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTEREST_TAGS.map((tag) => (
            <label key={tag.id} title={tag.hint}>
              <input type="checkbox" name="interests" value={tag.id} className="peer sr-only" />
              <span className={pill}>{tag.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="places" className={fieldLabel}>{t.places}</label>
          <input id="places" name="places" maxLength={200} placeholder={t.placesPlaceholder} className={fieldInput} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="avoid" className={fieldLabel}>{t.avoid}</label>
          <input id="avoid" name="avoid" maxLength={200} placeholder={t.avoidPlaceholder} className={fieldInput} />
        </div>
      </div>

      <SubmitButton pending={t.pending} className="self-start rounded-full bg-accent px-6 py-3 text-[0.95rem] font-medium text-on-accent hover:bg-accent-deep">
        {t.submit}
      </SubmitButton>
    </form>
  );
}
