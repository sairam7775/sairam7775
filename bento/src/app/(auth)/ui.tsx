import Link from "next/link";
import type { ReactNode } from "react";
import { BentoLogo } from "@/components/logo";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-16">
      <Link href="/" className="inline-flex" aria-label="Bento home">
        <BentoLogo />
      </Link>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </main>
  );
}

export function Field({
  id,
  name,
  label,
  type,
  autoComplete,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  type: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="mono text-[0.66rem] uppercase tracking-[0.1em] text-ink-3"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        className="border border-rule bg-surface px-3 py-2.5 text-[0.95rem] text-ink"
      />
      {hint && <p className="text-[0.8rem] text-ink-3">{hint}</p>}
    </div>
  );
}

export function Submit({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="mt-2 bg-indigo px-5 py-2.5 text-sm font-medium text-surface"
    >
      {label}
    </button>
  );
}

export function GoogleButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="flex w-full items-center justify-center gap-2.5 border border-rule bg-surface px-5 py-2.5 text-sm font-medium"
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

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mb-6 border-l-[3px] border-vermilion bg-vermilion-soft px-4 py-3 text-[0.9rem] text-ink-2">
      {message}
    </p>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mb-6 border-l-[3px] border-moss bg-moss-soft px-4 py-3 text-[0.9rem] text-ink-2">
      {children}
    </p>
  );
}
