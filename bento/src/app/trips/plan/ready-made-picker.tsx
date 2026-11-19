"use client";

import { useActionState, useState } from "react";
import { ErrorNote } from "@/app/(auth)/ui";
import { DateInput, SubmitButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { copy } from "@/copy";
import { startReadyMadeTrip, type ReadyMadeStartState } from "../actions";

const t = copy.readyMade.picker;

export interface PickerTrip {
  id: string;
  days: number;
  title: string;
  summary: string;
}

const pill = "inline-flex min-h-10 cursor-pointer items-center rounded-full border border-rule px-4 text-[0.92rem] text-ink-2 peer-checked:border-accent peer-checked:bg-lacquer peer-checked:text-rice peer-focus-visible:ring-2 peer-focus-visible:ring-accent hover:bg-sunk";

/** Choose a length, then one of its trips, then the first day and the
 *  party. Only trips the server found startable are passed in; the action
 *  checks again. `today` is today's date in Japan. */
export function ReadyMadePicker({ trips, today }: { trips: PickerTrip[]; today: string }) {
  const [state, action] = useActionState<ReadyMadeStartState, FormData>(startReadyMadeTrip, null);
  const lengths = [...new Set(trips.map((x) => x.days))].sort((a, b) => a - b);
  const [length, setLength] = useState(lengths[0]);
  // A trip of the chosen length is always selected, so the form never
  // stops on an empty choice.
  const [chosen, setChosen] = useState(trips.find((x) => x.days === lengths[0])?.id ?? "");
  const shown = trips.filter((x) => x.days === length);
  const choose = (n: number) => {
    setLength(n);
    setChosen(trips.find((x) => x.days === n)?.id ?? "");
  };
  // After a refusal React resets the uncontrolled fields to their defaults,
  // so the defaults are what was sent.
  const sent = state?.values;

  return (
    <form action={action} className="mt-6 flex flex-col gap-7">
      {state && !state.ok && <ErrorNote message={state.error} />}

      <fieldset>
        <legend className="text-[1.05rem] font-bold">{t.length}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {lengths.map((n) => (
            <label key={n}>
              <input type="radio" name="length" value={n} checked={length === n} onChange={() => choose(n)} className="peer sr-only" />
              <span className={pill}>{t.days(n)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[1.05rem] font-bold">{t.trip}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {shown.map((x) => (
            <label key={x.id} className="group">
              <input type="radio" name="trip" value={x.id} checked={chosen === x.id} onChange={() => setChosen(x.id)} className="peer sr-only" />
              <span className="flex h-full cursor-pointer flex-col gap-1 rounded-tile border border-rule px-4 py-3 text-ink peer-checked:border-accent peer-checked:bg-lacquer peer-checked:text-rice peer-focus-visible:ring-2 peer-focus-visible:ring-accent hover:bg-sunk">
                <span className="font-medium">{x.title}</span>
                <span className="text-[0.84rem] text-ink-2 group-has-[:checked]:text-rice">{x.summary}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ready-start" className={fieldLabel}>{t.startDate}</label>
          <DateInput id="ready-start" name="startDate" required min={today} defaultValue={sent?.startDate ?? ""} aria-describedby="ready-start-hint" className={fieldInput} />
          <p id="ready-start-hint" className="text-[0.84rem] text-ink-3">{t.startHint}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ready-people" className={fieldLabel}>{t.people}</label>
          <input id="ready-people" name="people" type="number" min={1} max={20} step={1} defaultValue={sent?.people || 1} inputMode="numeric" className={fieldInput} />
        </div>
      </div>

      <SubmitButton pending={t.pending} className="self-start rounded-full bg-accent px-6 py-3 text-[0.95rem] font-medium text-on-accent hover:bg-accent-deep">
        {t.submit}
      </SubmitButton>
    </form>
  );
}
