-- Bento · 0025 · reviewer notes on drafted places
--
-- Two AI reviewers (Codex and Gemini) checked the drafted places against
-- official sites. Where they disagree about a field, the point lands here
-- for an admin to settle in /admin/review before the record is verified.
--
-- Notes are internal working papers and never reach a traveller: RLS is on
-- with no policies and nothing is granted to anon or authenticated. The
-- admin pages read and settle them with the service role, after
-- requireAdmin(), like every other curation write.

create table place_review_notes (
  id         bigint generated always as identity primary key,
  place_id   text not null references places (id) on delete cascade,
  -- The draft's field name as the reviewers saw it: 'closes', 'cost', 'tip'.
  field      text not null,
  -- 'disagree': one reviewer says the field is wrong, the other says it
  -- isn't. 'different_fix': both say it is wrong but suggest different values.
  kind       text not null check (kind in ('disagree', 'different_fix')),
  -- What the record held when it was reviewed.
  current    jsonb,
  -- Each reviewer's view:
  -- { "suggested"?: any, "keep"?: true, "note"?: text, "source"?: text }.
  -- "suggested" is the value they'd put in the field; "keep" means they say
  -- the record is right. With neither, their view is only in the note.
  codex      jsonb not null default '{}',
  gemini     jsonb not null default '{}',
  -- The admin's call, in their own words, and who made it when.
  decision   text,
  settled_by text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  -- One open point per field, so a re-run of the reviewers updates it
  -- instead of piling up copies.
  unique (place_id, field)
);

comment on table place_review_notes is
  'Points the AI reviewers disagree on, for an admin to settle before '
  'verifying. Service role only: never exposed to travellers.';

alter table place_review_notes enable row level security;
revoke all on place_review_notes from anon, authenticated;
