-- Bento · 0032 · closures that come every year
--
-- The planner only knew weekly closing days. Japan's year-end break (roughly
-- 28 Dec – 4 Jan, different for each place) shuts many museums, castles and
-- gardens, and a trip on 1 Jan 2027 in Osaka was planned into Osaka Castle's
-- main tower and the Osaka Museum of History, both closed.
--
-- closed_yearly holds month-day ranges, 'MM-DD..MM-DD' or one 'MM-DD'. A
-- range whose end is before its start wraps the year: '12-28..01-01' is
-- 28 Dec to 1 Jan. The engine leaves a place out on those dates
-- (src/lib/engine/closures.ts); a pinned one stays, with a warning.
--
-- It is a fact, like closed_weekdays, so places_public shows it whatever the
-- verification status. (The older closed_dates column is for one-off dates.)

alter table places add column closed_yearly text[] not null default '{}';

-- Every element is MM-DD or MM-DD..MM-DD with a month 01–12 and a day 01–31
-- (the app also refuses days a month doesn't have, such as 04-31). No nulls.
alter table places add constraint places_closed_yearly_format check (
  array_position(closed_yearly, null) is null
  and (cardinality(closed_yearly) = 0
       or array_to_string(closed_yearly, ',') ~
          '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])(\.\.(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))?(,(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])(\.\.(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))?)*$')
);

comment on column places.closed_yearly is
  'Closed on these dates every year: MM-DD..MM-DD (an end before the start wraps the year) or MM-DD.';

-- Appending a column to the view keeps every existing consumer working.
-- Only change from 0026: p.closed_yearly at the end.
create or replace view places_public
with (security_invoker = false) as
select
  p.id, p.city_id, p.name, p.name_ja, p.category, p.coords, p.nearest_station, p.station_walk_min,
  p.interest_tags, p.energy, p.crowd_level, p.discovery, p.signature, p.physical_demand,
  case when p.verification_status = 'verified' then p.duration_taste_min   end as duration_taste_min,
  case when p.verification_status = 'verified' then p.duration_typical_min end as duration_typical_min,
  case when p.verification_status = 'verified' then p.duration_full_min    end as duration_full_min,
  case when p.verification_status = 'verified' then p.best_window          end as best_window,
  case when p.verification_status = 'verified' then p.crowd_note           end as crowd_note,
  case when p.verification_status = 'verified' then p.worth_it_if          end as worth_it_if,
  case when p.verification_status = 'verified' then p.skip_if              end as skip_if,
  case when p.verification_status = 'verified' then p.local_tip            end as local_tip,
  p.cost_jpy, p.booking_req, p.booking_lead_days, p.opens_at, p.closes_at, p.closed_weekdays, p.closed_dates,
  p.conflicts_with, p.pairs_with,
  p.verification_status, p.last_verified, p.sources,
  p.seasons,
  p.hours_vary, p.closed_yearly
from places p;

-- 0013's lock, again: the view must stay read-only.
revoke insert, update, delete, truncate, references, trigger
  on public.places_public
  from anon, authenticated;

-- The closures themselves. The seed upsert (seed_places_draft.sql) refreshes
-- drafts only, so it can't reach a place someone has verified: these updates
-- set the same values by id, whatever the status. A row that isn't there yet
-- is simply not updated (the seed brings the value with it). The values are
-- the seeds' (src/lib/places/seed/<city>.ts, where each has its source and
-- the date it was read); yearly-closures.test.ts keeps the two equal.

-- Osaka
update places set closed_yearly = array['12-28..01-01']::text[] where id = 'osk-osaka-castle';
update places set closed_yearly = array['12-28..01-04']::text[] where id = 'osk-museum-of-history';
update places set closed_yearly = array['12-28..01-04']::text[] where id = 'osk-national-museum-art';

-- Kyoto
update places set closed_yearly = array['12-28..12-31']::text[] where id = 'kyt-nanzenji';
update places set closed_yearly = array['12-28..01-01']::text[] where id = 'kyt-national-museum';
update places set closed_yearly = array['12-29..12-31']::text[] where id = 'kyt-nijo-castle';
update places set closed_yearly = array['12-28..01-04']::text[] where id = 'kyt-imperial-palace';
update places set closed_yearly = array['12-30..01-01']::text[] where id = 'kyt-railway-museum';

-- Nara
update places set closed_yearly = array['12-28..01-01']::text[] where id = 'nra-national-museum';
update places set closed_yearly = array['12-29..01-03']::text[] where id = 'nra-heijo-palace';

-- Hiroshima
update places set closed_yearly = array['12-30..12-31']::text[] where id = 'hir-peace-museum';
update places set closed_yearly = array['12-30..12-31']::text[] where id = 'hir-memorial-hall';
update places set closed_yearly = array['12-29..12-31']::text[] where id = 'hir-shukkeien';
update places set closed_yearly = array['12-25..01-01']::text[] where id = 'hir-prefectural-art';
update places set closed_yearly = array['12-27..01-01']::text[] where id = 'hir-mocha';
