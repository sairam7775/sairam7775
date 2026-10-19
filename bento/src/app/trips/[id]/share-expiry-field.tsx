import { copy } from "@/copy";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { shareExpiryOptions, type ShareExpiryOption } from "@/lib/trips/share-expiry";

const labels: Record<ShareExpiryOption, string> = {
  never: copy.share.expiry.never,
  "7-days": copy.share.expiry.sevenDays,
  "30-days": copy.share.expiry.thirtyDays,
  "trip-end": copy.share.expiry.tripEnd,
};

/** The browser submits a choice; the server derives its timestamp from the
 *  trip's stored end date and its own clock. */
export function ShareExpiryField({ endDate, id = "share-expiry" }: { endDate: string | null; id?: string }) {
  return (
    <label htmlFor={id} className={`block w-full max-w-xs ${fieldLabel}`}>
      {copy.share.expiry.label}
      <select id={id} name="expiryOption" defaultValue="never" className={`${fieldInput} mt-1`}>
        {shareExpiryOptions(endDate).map((option) => <option key={option} value={option}>{labels[option]}</option>)}
      </select>
    </label>
  );
}
