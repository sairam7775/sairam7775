-- Bento · 0033 · places only worth visiting in the evening
--
-- A ready-made Kyoto day planned Pontocho at 11:00, though its own note says
-- "Dead by day". The planner now never plans an evening-only place before
-- its evening window: it goes after the day's other stops, or is left out
-- with a reason (src/lib/engine/schedule.ts, eveningFrom).
--
-- It is an explicit flag, set only where the place's own notes say it is
-- dead or closed by day, never inferred from best_window: an evening best
-- window alone (Gion, Umeda Sky, Tokyo Tower) stays a soft preference, and
-- such a place may still be planned by day. A place that opens at 17:00 or
-- later is treated as evening-only by its hours, flag or not.
--
-- It is a fact, like the opening hours, so places_public shows it whatever
-- the verification status.

alter table places add column evening_only boolean not null default false;

comment on column places.evening_only is
  'Only worth visiting in the evening: never planned before its evening window.';

-- Appending a column to the view keeps every existing consumer working.
-- Only change from 0032: p.evening_only at the end.
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
  p.hours_vary, p.closed_yearly, p.evening_only
from places p;

-- 0013's lock, again: the view must stay read-only.
revoke insert, update, delete, truncate, references, trigger
  on public.places_public
  from anon, authenticated;

-- The flags themselves. The seed upsert (seed_places_draft.sql) refreshes
-- drafts only, so it can't reach a place someone has verified: these updates
-- set the same values by id, whatever the status. A row that isn't there yet
-- is simply not updated (the seed brings the value with it). The values are
-- the seeds' (src/lib/places/seed/<city>.ts); evening-only.test.ts keeps the
-- two equal. Each is there because its own notes say so.

-- Kyoto: "Dead by day."
update places set evening_only = true where id = 'kyt-pontocho';

-- Osaka: light art "after dark", entry from 19:45.
update places set evening_only = true where id = 'osk-teamlab-botanical';

-- Tokyo: bars from 19:00, "quiet before nine".
update places set evening_only = true where id = 'tky-golden-gai';

-- Hiroshima: the kagura is a Wednesday evening performance from 19:00; the
-- Nagarekawa bar district is "quiet until eight"; Ogonzan is the city's night
-- view, "otherwise nobody".
update places set evening_only = true where id = 'hir-kagura';
update places set evening_only = true where id = 'hir-nagarekawa';
update places set evening_only = true where id = 'hir-ogonzan';
