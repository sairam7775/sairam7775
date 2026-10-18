import { SubmitButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { CHALLENGES, NOTE_MAX, OUTCOMES, type TripReview } from "@/lib/trips/review";
import { copy } from "@/copy";
import { saveTripReview } from "./actions";

const r = copy.review;
const choice = "flex min-h-10 cursor-pointer items-center gap-2.5 text-[0.92rem]";
const legend = `${fieldLabel} mb-1`;

/** "How did the plan hold up?" — on the trip page once the trip has
 *  ended. Unanswered, the form is open; answered, it folds away behind
 *  "Change your answer". */
export function TripReviewCard({ tripId, review, days }: { tripId: string; review: TripReview | null; days: { date: string; label: string }[] }) {
  const form = (
    <form action={saveTripReview} className="mt-4 flex flex-col gap-5">
      <input type="hidden" name="tripId" value={tripId} />
      <fieldset className="flex flex-col">
        <legend className={legend}>{r.outcomeLabel}</legend>
        {OUTCOMES.map((o) => (
          <label key={o} className={choice}>
            <input type="radio" name="outcome" value={o} required defaultChecked={review?.outcome === o} className="size-4 shrink-0 accent-accent" />
            {r.outcomes[o]}
          </label>
        ))}
      </fieldset>
      <fieldset className="grid sm:grid-cols-2 sm:gap-x-6">
        <legend className={legend}>{r.challengesLabel}</legend>
        {CHALLENGES.map((c) => (
          <label key={c} className={choice}>
            <input type="checkbox" name="challenge" value={c} defaultChecked={review?.challenges.includes(c)} className="size-4 shrink-0 accent-accent" />
            {r.challenges[c]}
          </label>
        ))}
      </fieldset>
      {days.length > 0 && (
        <fieldset className="grid sm:grid-cols-2 sm:gap-x-6">
          <legend className={legend}>{r.hardDaysLabel}</legend>
          {days.map((d) => (
            <label key={d.date} className={choice}>
              <input type="checkbox" name="hardDay" value={d.date} defaultChecked={review?.hardDays.includes(d.date)} className="size-4 shrink-0 accent-accent" />
              {d.label}
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-note" className={fieldLabel}>{r.noteLabel}</label>
        <textarea id="review-note" name="note" rows={4} maxLength={NOTE_MAX} defaultValue={review?.note ?? ""} placeholder={r.notePlaceholder} className={fieldInput} />
      </div>
      <p className="text-[0.82rem] text-ink-3">{r.privacy}</p>
      <SubmitButton pending={r.sending} className="min-h-10 self-start rounded-full bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-deep">
        {review ? r.update : r.send}
      </SubmitButton>
    </form>
  );

  return (
    <section id="review" aria-labelledby="review-heading" className="tile up mt-4 scroll-mt-4 p-5" style={{ animationDelay: ".06s" }}>
      <h2 id="review-heading" className="text-[1.2rem] font-bold">{r.heading}</h2>
      {review ? (
        <>
          <p className="mt-1.5 text-[0.92rem] text-ink-2">{r.thanks(r.outcomes[review.outcome])}</p>
          <details className="group mt-2">
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border border-rule px-4 text-[0.88rem] text-ink-2 hover:bg-sunk [&::-webkit-details-marker]:hidden">
              {r.change}
              <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
            </summary>
            {form}
          </details>
        </>
      ) : (
        <>
          <p className="mt-1.5 max-w-[62ch] text-[0.92rem] leading-relaxed text-ink-2">{r.intro}</p>
          {form}
        </>
      )}
    </section>
  );
}
