/**
 * Grants curation access to a user, by email.
 *
 *   npx tsx scripts/grant-admin.ts you@example.com
 *   npx tsx scripts/grant-admin.ts you@example.com --revoke
 *
 * Membership of app_admins is deliberately not writable over the API — no
 * RLS policy allows an insert, so there is no "make me an admin" request
 * for anyone to find. It is granted here, with the service role, by someone
 * who already has the key.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email || email.startsWith("--")) {
    console.error("Usage: npx tsx scripts/grant-admin.ts <email> [--revoke]");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  // listUsers paginates; the account count here is small enough to scan.
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`No account for ${email}. Sign up first, then run this.`);
    process.exit(1);
  }

  if (revoke) {
    const { error: delError } = await db.from("app_admins").delete().eq("user_id", user.id);
    if (delError) throw delError;
    console.log(`Revoked curation access for ${email}.`);
    return;
  }

  const { error: insError } = await db
    .from("app_admins")
    .upsert({ user_id: user.id, note: `granted via script` }, { onConflict: "user_id" });
  if (insError) throw insError;

  console.log(`${email} can now curate. /admin is live for them.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
