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
// A label's words stay on one line, so "Confirmation" over "November" never
// reads as "Confirmation No".
const LABEL = String.raw`(?:booking|reservation)(?:[ \t]+(?:reference|ref\.?|number|no\.?|id|code)|[ \t]*#)|confirmation(?:[ \t]+(?:number|no\.?|code|id)|[ \t]*#)?|reference(?:[ \t]+(?:number|no\.?|code|id)|[ \t]*#)?|ref\.?(?:[ \t]*#)?|pnr|record[ \t]+locator|(?:e-?ticket|ticket|order|itinerary)[ \t]+(?:number|no\.?|id)|予約確認番号|予約番号|確認番号|予約コード|予約ID`;
// The label must start and end a word ("Preference" isn't "reference", and
// "No" in "November" isn't "no"); lookarounds rather than \b, which doesn't
// see the edges of a Japanese label. The value
// is taken whole, so a long one never leaves its tail in the text: after a
// space, slash, dot, underscore or hyphen it goes on only while the next
// group has a digit ("ABC 123 456", "AB/12345"), so "ABC123 for your stay"
// stops at the reference.
const REFERENCE = new RegExp(String.raw`(?<![A-Za-z])(${LABEL})(?!(?<=[A-Za-z])[A-Za-z])(\s*(?:is|:|：|#|-|–|no\.)?\s*)([A-Z0-9][A-Z0-9_-]*(?:[ /._-][A-Z0-9_]*\d[A-Z0-9_]*)*)(?![A-Z0-9_-])`, "gi");
// The longest reference the booking form keeps (ParsedBookingSchema).
const REFERENCE_MAX = 60;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// A phone number only where it is labelled, or written internationally:
// unlabelled digit runs are too often dates, times or prices. Spaces only,
// never a line break, so the date on the next line stays.
const PHONE_LABELLED = /((?:tel|phone|telephone|mobile|電話|TEL)\.?[ \t]*[:：]?[ \t]*)(\+?\d[\d \t().-]{6,}\d)/gi;
const PHONE_INTERNATIONAL = /\+\d[\d \t().-]{7,}\d/g;
// Card and e-ticket numbers: 12 or more digits, in groups or not. Dates
// (2026-11-20) and times never get that far.
const LONG_NUMBER = /\b\d(?:[ -]?\d){11,18}\b/g;

/** A value after a label is a reference only if it looks like one: it has a
 *  digit, or it is a run of capitals (a PNR such as QWERTY), or it is a
 *  lowercase code standing alone at the end of its line ("abcdef"). An
 *  ordinary word mid-sentence ("please see below") is none of these, and
 *  neither is a date (2026-11-20, 20/11/2026, November 20), which the form
 *  needs: a value in groups starts with a group that has a digit or is all
 *  capitals. */
function looksLikeReference(value: string, endsLine: boolean): boolean {
  if (value.replace(/[^A-Z0-9]/gi, "").length < 4) return false;
  if (/^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/.test(value)) return false;
  const first = value.split(/[ /._]/)[0];
  if (first !== value && !/\d/.test(first) && !/^[A-Z]+$/.test(first)) return false;
  return /\d/.test(value) || /^[A-Z]{5,8}$/.test(value) || (endsLine && /^[a-z]{5,8}$/.test(value));
}

// A label of one word can be a heading ("CONFIRMATION" over "DETAILS"), so
// a value on the line under it counts only when it has a digit.
const BARE_LABEL = /^(?:confirmation|reference|ref\.?)$/i;

export function redactConfirmation(input: string): { text: string; reference: string | null } {
  let reference: string | null = null;
  let text = input.replace(REFERENCE, (whole, label: string, gap: string, value: string, at: number, all: string) => {
    const endsLine = /^[ \t.]*(\r?\n|$)/.test(all.slice(at + whole.length));
    if (BARE_LABEL.test(label) && /\n/.test(gap) && !/\d/.test(value)) return whole;
    if (!looksLikeReference(value, endsLine)) return whole;
    if (value.length <= REFERENCE_MAX) reference ??= value;
    return `${label}${gap}${REMOVED.reference}`;
  });
  text = text
    .replace(EMAIL, REMOVED.email)
    .replace(PHONE_LABELLED, (_, label: string) => `${label}${REMOVED.phone}`)
    .replace(PHONE_INTERNATIONAL, REMOVED.phone)
    .replace(LONG_NUMBER, REMOVED.number);
  return { text, reference };
}
