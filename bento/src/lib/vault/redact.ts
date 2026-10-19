/** What a pasted confirmation loses before it goes to the model.
 *
 *  A booking reference plus a surname can change or cancel a booking, so
 *  the reader never needs to see one: references are recognised here, by
 *  their labels, kept for the form and replaced in the text. Email
 *  addresses, phone numbers and long card or ticket numbers go too; the
 *  model needs none of them to fill the form. Names are left: they can't be
 *  told apart from places and hotels reliably, and the privacy page says so.
 *
 *  The markers below are only ever read by the model, never shown. */

const REMOVED = {
  reference: "[reference removed]",
  email: "[email removed]",
  phone: "[phone removed]",
  number: "[number removed]",
};

// What comes before a reference in confirmations: English and Japanese.
const LABEL = String.raw`(?:booking|reservation)\s+(?:reference|ref\.?|number|no\.?|id|code)|confirmation(?:\s+(?:number|no\.?|code|#))?|pnr|record\s+locator|(?:e-?ticket|ticket|order|itinerary)\s+(?:number|no\.?|id)|予約確認番号|予約番号|確認番号|予約コード|予約ID`;
const REFERENCE = new RegExp(String.raw`(${LABEL})(\s*(?:is|:|：|#|-|–|no\.)?\s*)([A-Z0-9][A-Z0-9-]{3,24})`, "gi");

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// A phone number only where it is labelled, or written internationally:
// unlabelled digit runs are too often dates, times or prices.
const PHONE_LABELLED = /((?:tel|phone|telephone|mobile|電話|TEL)\.?\s*[:：]?\s*)(\+?\d[\d\s().-]{6,}\d)/gi;
const PHONE_INTERNATIONAL = /\+\d[\d\s().-]{7,}\d/g;
// Card and e-ticket numbers: 12 or more digits, in groups or not. Dates
// (2026-11-20) and times never get that far.
const LONG_NUMBER = /\b\d(?:[ -]?\d){11,18}\b/g;

/** A value after a label is a reference only if it looks like one: it has a
 *  digit, or it is a run of capitals (a PNR such as QWERTY). "Confirmation
 *  of your booking" has neither. */
function looksLikeReference(value: string): boolean {
  return /\d/.test(value) || /^[A-Z]{5,8}$/.test(value);
}

export function redactConfirmation(input: string): { text: string; reference: string | null } {
  let reference: string | null = null;
  let text = input.replace(REFERENCE, (whole, label: string, gap: string, value: string) => {
    if (!looksLikeReference(value)) return whole;
    reference ??= value;
    return `${label}${gap}${REMOVED.reference}`;
  });
  text = text
    .replace(EMAIL, REMOVED.email)
    .replace(PHONE_LABELLED, (_, label: string) => `${label}${REMOVED.phone}`)
    .replace(PHONE_INTERNATIONAL, REMOVED.phone)
    .replace(LONG_NUMBER, REMOVED.number);
  return { text, reference };
}
