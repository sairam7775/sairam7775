-- Bento · 0009 · proposals carry a status
--
-- §08: the model never writes the itinerary. It proposes a diff, stored on
-- the assistant message, and the traveller accepts or rejects it. The status
-- lives with the message so the conversation shows what happened to each
-- proposal, and so a proposal cannot be applied twice.

alter table chat_messages
  add column diff_status text
    check (diff_status in ('proposed', 'accepted', 'rejected')),
  add column resolved_at timestamptz;

-- A diff and its status arrive together or not at all.
alter table chat_messages
  add constraint chat_messages_diff_status_pair
    check ((proposed_diff is null) = (diff_status is null));

comment on column chat_messages.proposed_diff is
  'Engine output the traveller has not yet accepted. Applied by the app on accept; never by the model.';

-- Onboarding is a conversation, so "has this person answered anything yet"
-- has to be a fact, not a guess from default values. Standard pace and no
-- interests is a legitimate answer; it must not read as "never asked".
alter table user_preferences
  add column onboarded boolean not null default false;

-- Bento Man states the coverage tier of every city it talks about (§06),
-- and needs the verified count to say "deep, 41 verified places" honestly.
-- curation_progress is admin-only because it counts drafts; this view is
-- the traveller-safe subset: names, tiers, and verified counts. Nothing
-- about drafts, nothing from a judgement field.
create or replace view city_coverage
with (security_invoker = false) as
select
  c.id   as city_id,
  c.name,
  c.name_ja,
  c.coverage_tier,
  c.transit_note,
  count(pl.id) filter (where pl.verification_status = 'verified') as verified_places
from cities c
left join places pl on pl.city_id = c.id
group by c.id, c.name, c.name_ja, c.coverage_tier, c.transit_note;

comment on view city_coverage is
  'Coverage per city for the planner and Bento Man. SECURITY DEFINER to count '
  'verified rows in places; exposes counts and tiers only.';

grant select on city_coverage to authenticated;
