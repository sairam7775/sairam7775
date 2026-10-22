/** What a failed code check means for the admin: a wrong code is typed
 *  again; a setup that no longer exists (it expired, or a newer one was
 *  started in another tab) can only be started again; anything else keeps
 *  the setup and asks them to try again in a moment. */
export function afterVerifyError(code: string | undefined, factorStillThere: boolean): "wrong" | "restart" | "retry" {
  if (code === "mfa_verification_failed") return "wrong";
  return factorStillThere ? "retry" : "restart";
}
