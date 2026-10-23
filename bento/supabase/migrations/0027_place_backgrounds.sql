-- Bento · 0027 · checked place backgrounds
--
-- The lasting story of a place (history, what it is known for), checked by
-- an admin before a traveller sees it. Hours and prices stay on places.
-- Written only by the service role (no policy), like places.

create table place_backgrounds (
  place_id    text primary key references places (id) on delete cascade,
  body        text not null check (char_length(body) between 120 and 900),
  sources     text[] not null check (cardinality(sources) > 0),
  status      text not null default 'draft' check (status in ('draft', 'verified')),
  drafted_by  text not null,
  verified_by text,
  verified_on date,
  updated_at  timestamptz not null default now(),
  constraint place_backgrounds_signed
    check (status = 'draft' or (verified_by is not null and verified_on is not null))
);
alter table place_backgrounds enable row level security;

-- Checked backgrounds of verified places only. Runs as its owner, so the
-- writes Supabase grants by default are taken back (see 0013).
create view place_backgrounds_public as
  select b.place_id, b.body, b.sources
    from place_backgrounds b
    join places p on p.id = b.place_id
   where b.status = 'verified' and p.verification_status = 'verified';
revoke all on place_backgrounds_public from anon, authenticated;
grant select on place_backgrounds_public to authenticated;

-- Which places travellers ask about, per day. No user id, no message text.
create table place_background_asks (
  place_id text not null references places (id) on delete cascade,
  day      date not null default current_date,
  asks     int  not null default 1,
  primary key (place_id, day)
);
alter table place_background_asks enable row level security;

create function note_background_ask(p_place_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into place_background_asks (place_id) values (p_place_id)
  on conflict (place_id, day) do update set asks = place_background_asks.asks + 1;
end;
$$;
revoke all on function note_background_ask(text) from public, anon;
grant execute on function note_background_ask(text) to authenticated;
