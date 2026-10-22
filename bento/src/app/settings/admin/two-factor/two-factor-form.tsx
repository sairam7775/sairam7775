"use client";

import { useActionState } from "react";
import { ErrorNote } from "@/app/(auth)/ui";
import { SubmitButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { copy } from "@/copy";
import { startTwoFactorSetup, verifyTwoFactor, type TwoFactorState } from "./actions";

const t = copy.settings.twoFactor;

/** One state for the whole flow: the start button, then the QR code and key
 *  with the code box, or just the code box for an admin already set up
 *  (`factorId`). A correct code takes the admin on to Admin. */
export function TwoFactorForm({ factorId }: { factorId: string | null }) {
  const [state, action] = useActionState<TwoFactorState, FormData>(
    (prev, form) => (form.get("intent") === "start" ? startTwoFactorSetup() : verifyTwoFactor(prev, form)),
    factorId ? { step: "verify", factorId, qr: "", secret: "" } : null,
  );

  if (!state || state.step === "start") {
    return (
      <form action={action} className="mt-5 flex flex-col items-start gap-3">
        {state?.error && <ErrorNote message={state.error} />}
        <p className="text-[0.95rem] text-ink-2">{t.setupIntro}</p>
        <input type="hidden" name="intent" value="start" />
        <SubmitButton pending={t.starting} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-deep">
          {t.start}
        </SubmitButton>
      </form>
    );
  }

  return (
    <form action={action} className="mt-5 flex flex-col gap-4">
      {state.error && <ErrorNote message={state.error} />}
      {state.qr ? (
        <div className="flex flex-wrap items-start gap-5">
          {/* Supabase's QR code: an SVG data URL, drawn locally. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qr} alt={t.qrAlt} width={180} height={180} className="rounded-xl bg-white p-2" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className={fieldLabel}>{t.secretLabel}</span>
            <code className="mono break-all text-[0.9rem] text-ink">{state.secret}</code>
          </div>
        </div>
      ) : (
        <p className="text-[0.95rem] text-ink-2">{t.enterIntro}</p>
      )}
      <input type="hidden" name="intent" value="verify" />
      <input type="hidden" name="factorId" value={state.factorId} />
      <div className="flex max-w-xs flex-col gap-1.5">
        <label htmlFor="code" className={fieldLabel}>{t.code}</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className={fieldInput} />
      </div>
      <SubmitButton pending={t.verifying} className="self-start rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-deep">
        {t.verify}
      </SubmitButton>
    </form>
  );
}
