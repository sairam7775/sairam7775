"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { findUserByEmail } from "@/lib/admin-overview";
import type { AdminError } from "./admin-errors";

// Back to the admin section, with what happened. The page turns the key into words.
function back(outcome: { admin: "added" | "removed" } | { adminError: AdminError }): never {
  redirect(`/settings?${new URLSearchParams(outcome)}#admin`);
}

/** Settings → Admin → give an existing account admin access. Only an admin
 *  can, checked here (not just by hiding the form) and again by add_admin
 *  (0021), under the roster lock: an admin removed while this request was
 *  on its way can't still give access. Logged with ids only. */
export async function addAdmin(formData: FormData) {
  const { user, db } = await requireAdmin();
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) back({ adminError: "badEmail" });

  let target;
  try {
    target = await findUserByEmail(db, email.data);
  } catch (e) {
    console.error("Admin lookup failed:", e instanceof Error ? e.message : e);
    back({ adminError: "failed" });
  }
  if (!target) back({ adminError: "noAccount" });

  const { data, error } = await db.rpc("add_admin", { p_actor: user.id, p_target: target.id, p_note: `Given in Settings by ${user.id}` });
  if (error) {
    console.error("Giving admin access failed:", error.message);
    back({ adminError: "failed" });
  }
  if (data === "already") back({ adminError: "already" });
  // No longer an admin by the time it ran.
  if (data !== "added") back({ adminError: "failed" });
  console.info(`Admin access given to ${target.id} by ${user.id}`);
  back({ admin: "added" });
}

/** Settings → Admin → remove someone's admin access. Never your own (another
 *  admin has to), and never the last one, so curation can't be locked out.
 *  The rules live in one locked database function (remove_admin, 0021):
 *  checked here in separate calls, two admins removing each other at once
 *  could both pass and leave none. */
export async function removeAdmin(formData: FormData) {
  const { user, db } = await requireAdmin();
  const id = z.uuid().safeParse(formData.get("userId"));
  if (!id.success) back({ adminError: "failed" });

  const { data, error } = await db.rpc("remove_admin", { p_actor: user.id, p_target: id.data });
  if (error) {
    console.error("Removing admin access failed:", error.message);
    back({ adminError: "failed" });
  }
  if (data === "self") back({ adminError: "self" });
  if (data === "last") back({ adminError: "last" });
  // Removed by someone else meanwhile, or no longer an admin: nothing to do.
  if (data !== "removed") back({ adminError: "failed" });
  console.info(`Admin access removed from ${id.data} by ${user.id}`);
  back({ admin: "removed" });
}
