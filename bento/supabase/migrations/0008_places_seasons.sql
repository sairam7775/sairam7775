-- Bento · 0008 · seasons on places
--
-- When a place is at its best: 'koyo', 'sakura'. The engine's season_fit
-- term reads this; absent means neutral, never a guess.

alter table places add column seasons text[] not null default '{}';

-- Appending a column to the view keeps every existing consumer working.
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
  p.seasons
from places p;
