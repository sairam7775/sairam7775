import Link from "next/link";
import type { ReactNode } from "react";
import { BentoLogo } from "@/components/logo";
import { DateInput, PasswordInput, SubmitButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { copy } from "@/copy";

/** Sign-in and sign-up: the form on a frosted tile, and beside it (on wide
 *  screens) a lacquer panel saying what the account is for. */
export function AuthShell({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle: string;
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-8">
      <header className="up flex items-center justify-between">
        <Link href="/" className="inline-flex" aria-label={copy.common.homeLabel}>
          <BentoLogo />
        </Link>
        <Link href="/" className="min-h-10 rounded-full px-3 py-2 text-[0.88rem] text-ink-2 hover:bg-sunk hover:text-ink">
          {copy.common.homeBack}
        </Link>
      </header>

      <div className="mt-8 grid items-start gap-6 md:mt-12 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-stretch">
        <section className="tile up p-6 sm:p-8" style={{ animationDelay: ".05s" }}>
          <h1 className="text-[2rem] font-bold leading-tight">{title}</h1>
          <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-2">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </section>
        <aside className="box up hidden p-3 md:block" style={{ animationDelay: ".12s" }}>
          <div className="flex h-full flex-col justify-between gap-6 rounded-tile p-6 text-rice">{aside}</div>
        </aside>
      </div>
    </main>
  );
}

/** A point on the lacquer panel: a food-colour dot, a heading, a line. */
export function AsidePoint({ tone, title, children }: { tone: "accent" | "edamame" | "tamago" | "ume"; title: string; children: ReactNode }) {
  const dot = { accent: "bg-accent", edamame: "bg-edamame", tamago: "bg-tamago-bright", ume: "bg-ume" }[tone];
  return (
    <li className="flex gap-3">
      <span aria-hidden className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <div>
        <p className="disp text-[1.02rem] font-bold">{title}</p>
        <p className="mt-0.5 text-[0.9rem] leading-relaxed text-rice/75">{children}</p>
      </div>
    </li>
  );
}

export function Divider({ label = copy.common.or }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-rule" />
      <span className="text-[0.8rem] text-ink-3">{label}</span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}


export function Field({
  id,
  name,
  label,
  type,
  autoComplete,
  hint,
  placeholder,
  max,
  optional = false,
  maxLength,
}: {
  id: string;
  name: string;
  label: string;
  type: string;
  autoComplete?: string;
  hint?: string;
  placeholder?: string;
  max?: string;
  /** Not required; the hint should say so. */
  optional?: boolean;
  maxLength?: number;
}) {
  // The hint is read out with the field, not only seen under it.
  const described = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      {type === "password" ? (
        <PasswordInput id={id} name={name} required={!optional} autoComplete={autoComplete} placeholder={placeholder} aria-describedby={described} className={fieldInput} />
      ) : type === "date" ? (
        <DateInput id={id} name={name} required={!optional} max={max} autoComplete={autoComplete} aria-describedby={described} className={fieldInput} />
      ) : (
        <input id={id} name={name} type={type} required={!optional} maxLength={maxLength} autoComplete={autoComplete} placeholder={placeholder} aria-describedby={described} className={fieldInput} />
      )}
      {hint && <p id={described} className="text-[0.8rem] text-ink-3">{hint}</p>}
    </div>
  );
}

export function Submit({ label, pending }: { label: string; pending: string }) {
  return (
    <SubmitButton pending={pending} className="mt-2 min-h-11 rounded-full bg-accent px-5 text-[0.95rem] font-medium text-on-accent hover:bg-accent-deep">
      {label}
    </SubmitButton>
  );
}

export function GoogleButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full border border-rule bg-surface px-5 text-[0.95rem] font-medium hover:bg-sunk"
    >
      <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
      </svg>
      {label}
    </button>
  );
}

/** "By creating an account you agree to the terms of use and … the privacy
 *  policy." Wherever an account can be created: under sign-up, and under
 *  Continue with Google on sign-in, which creates one for a new address. */
export function AgreeNote({ start }: { start: string }) {
  const t = copy.auth.signUp.agree;
  const link = "font-medium underline underline-offset-2 hover:text-ink";
  return (
    <p className="mt-4 text-[0.85rem] leading-relaxed text-ink-2">
      {start} <Link href="/terms" className={link}>{t.terms}</Link>{" "}
      {t.middle} <Link href="/privacy" className={link}>{t.privacy}</Link>{t.end}
    </p>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-6 rounded-r-lg border-l-[3px] border-ume bg-ume-soft px-4 py-3 text-[0.9rem] text-ink-2">
      {message}
    </p>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mb-6 rounded-r-lg border-l-[3px] border-edamame bg-edamame-soft px-4 py-3 text-[0.9rem] text-ink-2">
      {children}
    </p>
  );
}
