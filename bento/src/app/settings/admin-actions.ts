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
 *  can, checked here (not just by hiding the form), and the write goes
 *  through the service role because nobody can write `app_admins` over the
 *  API. Logged with ids only. */
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

  const { error } = await db.from("app_admins").insert({ user_id: target.id, note: `Given in Settings by ${user.id}` });
  if (error?.code === "23505") back({ adminError: "already" });
  if (error) {
    console.error("Giving admin access failed:", error.message);
    back({ adminError: "failed" });
  }
  console.info(`Admin access given to ${target.id} by ${user.id}`);
  back({ admin: "added" });
}

/** Settings → Admin → remove someone's admin access. Never your own (another
 *  admin has to), and never the last one, so curation can't be locked out. */
export async function removeAdmin(formData: FormData) {
  const { user, db } = await requireAdmin();
  const id = z.uuid().safeParse(formData.get("userId"));
  if (!id.success) back({ adminError: "failed" });
  if (id.data === user.id) back({ adminError: "self" });

  const { count, error: countError } = await db.from("app_admins").select("user_id", { count: "exact", head: true });
  if (countError) back({ adminError: "failed" });
  if ((count ?? 0) <= 1) back({ adminError: "last" });

  const { error } = await db.from("app_admins").delete().eq("user_id", id.data);
  if (error) {
    console.error("Removing admin access failed:", error.message);
    back({ adminError: "failed" });
  }
  console.info(`Admin access removed from ${id.data} by ${user.id}`);
  back({ admin: "removed" });
}
