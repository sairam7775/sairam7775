-- Bento · 0035 · place data from the read-through of 23 Nov 2026
--
-- 1. many_closed_weekdays: weekdays when a place is open but many of its
--    shops close. Tsukiji Outer Market was pinned on a Wednesday with no
--    word that many stalls shut ("The market is closed on Wednesdays,
--    Sundays, and national holidays, so many shops are closed on those days
--    as well": GO TOKYO, read 23 Nov 2026). Not a closing day: the planner
--    doesn't choose the place then, a pin stays with a warning, and a
--    ready-made start is not refused (src/lib/engine/filter.ts).
-- 2. Omoide Yokocho is evening-only (0033's flag), like Golden Gai.
-- 3. Fudoin gets its station, Fudoin-mae on the Astram Line, two minutes'
--    walk, and its position corrected. The station and its edges come from
--    seed_transit.sql; they are inserted here too (if missing) so the
--    foreign key holds whichever runs first.
-- 4. Tips that changed: Osaka Castle (last entry 17:30), the Kuzuharaoka
--    trail (it can be walked from the Great Buddha end), Omoide Yokocho.
--
-- The seed upsert (seed_places_draft.sql) refreshes drafts only and every
-- one of these rows is verified, so each value is set by id here, equal to
-- the seeds (src/lib/places/seed/<city>.ts); place-data-1123.test.ts keeps
-- the two equal. A row that isn't there is simply not updated.

alter table places add column many_closed_weekdays int[] not null default '{}';

comment on column places.many_closed_weekdays is
  'Weekdays (0 = Sunday) when the place is open but many of its shops close: not chosen by the planner then; a pin stays with a warning.';

-- Appending a column to the view keeps every existing consumer working.
-- Only change from 0033: p.many_closed_weekdays at the end.
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
  p.hours_vary, p.closed_yearly, p.evening_only, p.many_closed_weekdays
from places p;

-- 0013's lock, again: the view must stay read-only.
revoke insert, update, delete, truncate, references, trigger
  on public.places_public
  from anon, authenticated;

-- Tokyo: many Tsukiji shops close on Sundays and Wednesdays.
update places set many_closed_weekdays = '{0,3}' where id = 'tky-tsukiji-outer';

-- Tokyo: Omoide Yokocho wakes up after work (Time Out Tokyo: "When to go?
-- 8pm–early morning"); its tip now says so.
update places set evening_only = true where id = 'tky-omoide-yokocho';
update places set local_tip = 'Yakitori smoke in a narrow lane by the tracks at Shinjuku''s west exit. It comes alive in the evening; by day only a few counters are open. Most counters seat under ten, some charge a small seat fee, and some ask you not to photograph.' where id = 'tky-omoide-yokocho';

-- Hiroshima: the Astram Line station for Fudoin (ekitan.com: Hondori to
-- Fudoin-mae 9 min, ¥260, 4.0 km; position from en.wikipedia).
insert into stations (id, name, name_ja, city_id, coords, lines) values
  ('fudoin-mae', 'Fudoin-mae', '不動院前', 'hiroshima-city', extensions.ST_SetSRID(extensions.ST_MakePoint(132.4692, 34.427), 4326)::extensions.geography, array['Astram Line']::text[])
on conflict (id) do nothing;
insert into station_edges (from_station, to_station, line, mode, operator, km, minutes, fare_jpy, stops, note) values
  ('hondori', 'fudoin-mae', 'Astram Line', 'rail', 'astram', 4, 9, 260, 6, null),
  ('fudoin-mae', 'hondori', 'Astram Line', 'rail', 'astram', 4, 9, 260, 6, null)
on conflict (from_station, to_station, line) do nothing;

-- Fudoin: two minutes from Fudoin-mae (dive-hiroshima.com; ja.wikipedia
-- 「不動院前駅」より徒歩2分, which gives the position 34.427028, 132.471111).
update places set
  nearest_station = 'fudoin-mae',
  station_walk_min = 2,
  coords = extensions.ST_SetSRID(extensions.ST_MakePoint(132.471111, 34.427028), 4326)::extensions.geography,
  sources = array['wikivoyage', 'dive-hiroshima.com']::text[]
where id = 'hir-fudoin';

-- Osaka: hours 9:00–18:00 are right (since 1 Apr 2025); last entry is 17:30
-- (osakacastle.net/guide/).
update places set local_tip = 'The keep is a 1931 concrete reconstruction with a museum inside; the view from the top and the walls and moats outside are the real castle. Walk the outer wall before going in. Last entry is 17:30, and the ticket queue can be closed earlier on busy days.' where id = 'osk-osaka-castle';

-- Kamakura: the trail's signboard gives about 1h10 from the Daibutsu-zaka
-- entrance to Kita-Kamakura (BE-PAL).
update places set
  local_tip = 'About 3 km of dirt trail, roughly an hour and a half, from beside Jochi-ji near Kita-Kamakura Station over Kuzuharaoka Shrine and Genjiyama Park down to the Great Buddha. Wear shoes with grip: roots and clay turn slippery after rain, and hornets are about from summer into autumn. Side paths lead to Zeniarai Benzaiten and Sasuke Inari Shrine. It can be walked the other way too: from the Daibutsu-zaka entrance near the Great Buddha up over Genjiyama Park to Kita-Kamakura Station, about an hour and ten minutes by the signpost. Walk it in daylight.',
  sources = array['trip-kamakura.com/article/95.html', 'bepal.net/play/trekking/13088']::text[]
where id = 'kmk-kuzuharaoka';
