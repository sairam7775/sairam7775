/** Whether a submit that asks first should go ahead. A form with a field
 *  still empty goes straight on to the browser's own "fill this in", which
 *  stops it, so the warning comes only once there's something to confirm.
 *  A plain module, so it can be tested without a browser. */
export function confirmSubmit(form: { checkValidity(): boolean } | null, ask: () => boolean): boolean {
  if (form && !form.checkValidity()) return true;
  return ask();
}
