"use client";

import { forgetUser } from "@/lib/analytics/client";
import { copy } from "@/copy";

/** Sign out, and tell analytics the next person here is someone new. */
export function SignOutButton() {
  return (
    <button onClick={forgetUser} className="min-h-10 whitespace-nowrap rounded-full px-2.5 text-[0.85rem] text-ink-2 hover:bg-sunk hover:text-ink sm:px-3">
      {copy.common.signOut}
    </button>
  );
}
