"use client";

import { useActionState, useState } from "react";
import { ErrorNote } from "@/app/(auth)/ui";
import { SubmitButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { NAME_MAX } from "@/lib/account/name";
import { copy } from "@/copy";
import { setDisplayName, type NameState } from "../actions";

/** Settings → Personal information → Your name. Says "Saved." once it's
 *  stored, until the name is changed again; says so if it wasn't. */
export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<NameState, FormData>(setDisplayName, null);
  const [edited, setEdited] = useState(false);
  const t = copy.settings.name;
  const shown = pending || edited ? null : state;

  return (
    <>
      {shown === "failed" && <div className="mt-3"><ErrorNote message={t.failed} /></div>}
      <form action={action} onSubmit={() => setEdited(false)} className="mt-4 flex max-w-md flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="display-name" className={fieldLabel}>{t.label}</label>
          {/* Keyed by the saved name, so the field shows it again after saving. */}
          <input key={name} id="display-name" name="name" type="text" defaultValue={name} maxLength={NAME_MAX} autoComplete="given-name" onChange={() => setEdited(true)} className={fieldInput} />
        </div>
        <SubmitButton pending={copy.common.saving} className="min-h-11 rounded-full border border-rule px-5 text-[0.95rem] hover:bg-sunk">
          {t.save}
        </SubmitButton>
        <p role="status" className="min-h-5 w-full text-[0.88rem] font-medium text-edamame">
          {shown === "saved" && <><span aria-hidden>✓ </span>{t.saved}</>}
        </p>
      </form>
    </>
  );
}
