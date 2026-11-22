"use client";

import { useActionState } from "react";
import { ErrorNote } from "@/app/(auth)/ui";
import { DateRangeInputs, SubmitButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { copy } from "@/copy";
import { createTrip, type NewTripState } from "../actions";

const t = copy.trips.new;

/** The Blank trip tab: a name, the dates and the party, all optional, then
 *  straight into the new trip. The ids carry `blank-` because the form tab
 *  is on the same page. */
export function BlankTripForm() {
  const [state, action] = useActionState<NewTripState, FormData>(createTrip, null);
  // After a refusal React resets the uncontrolled fields to their defaults,
  // so the defaults are what was sent. The dates are held by DateRangeInputs.
  const sent = state?.values;

  return (
    <form action={action} className="mt-5 flex flex-col gap-4">
      <ErrorNote message={state?.error ?? null} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="blank-title" className={fieldLabel}>{t.name}</label>
        <input id="blank-title" name="title" type="text" placeholder={t.namePlaceholder} defaultValue={sent?.title ?? ""} className={fieldInput} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <DateRangeInputs idPrefix="blank-" startLabel={t.arrive} endLabel={t.leave} labelClass={fieldLabel} inputClass={fieldInput} />
        <div className="flex flex-col gap-1.5 sm:col-start-3 sm:row-start-1">
          <label htmlFor="blank-partySize" className={fieldLabel}>{t.people}</label>
          <input id="blank-partySize" name="partySize" type="number" min={1} max={20} defaultValue={sent?.partySize || 1} className={fieldInput} />
        </div>
      </div>

      <SubmitButton pending={t.pending} className="mt-1 self-start rounded-full border border-rule bg-surface px-5 py-2.5 text-sm font-medium hover:bg-sunk">
        {t.submit}
      </SubmitButton>
    </form>
  );
}
