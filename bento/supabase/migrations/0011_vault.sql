-- Bento · 0011 · what the gap detector needs to match a booking to a gap
--
-- A booking only closes a gap if we can tell which gap it closes. An
-- accommodation booking covers nights in a city; a transport booking
-- covers a move from one city to another; an activity booking covers a
-- place that requires a ticket. The first was already expressible, the
-- other two were not.

alter table bookings
  -- The far end of a move. city_id is where it leaves from.
  add column to_city_id text references cities (id),
  -- The place a ticket is for, so booking_req = 'required' can be satisfied.
  add column place_id text references places (id),
  -- What the traveller decided about a gap we raised: dismissed gaps stay
  -- dismissed, so the same sentence does not nag every visit.
  add column dismissed_gap text;

create index bookings_dates_idx on bookings (trip_id, starts_at);

comment on column bookings.reference_encrypted is
  'AES-256-GCM, key in BENTO_BOOKING_REF_KEY. Decrypted only to show the '
  'traveller their own reference. Never logged, never placed in a prompt.';

-- Gaps the traveller has seen and chosen to live with ("we are taking the
-- night bus", "staying with a friend"). One row per trip, per gap key.
create table gap_dismissals (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips (id) on delete cascade,
  gap_key    text not null,
  note       text,
  created_at timestamptz not null default now(),
  unique (trip_id, gap_key)
);

create index gap_dismissals_trip_idx on gap_dismissals (trip_id);

alter table gap_dismissals enable row level security;

create policy "own gap_dismissals" on gap_dismissals
  for all to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())));
