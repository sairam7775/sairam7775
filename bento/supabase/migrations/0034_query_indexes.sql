-- Bento · 0034 · indexes the app's queries and cascades actually hit
--
-- Supabase's advisor lists ten unindexed foreign keys. Only two places in
-- the app look rows up by a column with no index behind it:
--
--   1. Deleting an itinerary day (apply_proposal drops days the new route
--      gives to another city, 0015/0031; deleting a trip cascades to its
--      days) makes Postgres run, for every deleted day,
--        update bookings set covers_day_id = null where covers_day_id = $1
--      (the "on delete set null" of 0002). With no index that reads the
--      whole bookings table once per day, inside the trip lock. No code
--      writes covers_day_id today, so the index is partial: it holds only
--      the rows that have one, and stays empty and free until then.
--
--   2. Every model call reserves spend (reserve_spend, 0014), which sums
--      the month for the whole project: spend_since_month_start(null),
--        where created_at >= date_trunc('month', now()) ...
--      with no user filter. The only index, (user_id, created_at desc),
--      can't serve a range on created_at alone, so each call read all of
--      api_usage - under the advisory lock every reservation queues on.
--
-- The other eight are left out: nothing a traveller does filters by them,
-- and the rows they point at (cities, places, stations, regions) are only
-- ever deleted by hand, if at all. bookings.city_id / to_city_id /
-- place_id, itinerary_items.place_id, itinerary_days.city_id and
-- trip_cities.city_id are read through their trip or day (trip_id and
-- day_id are indexed); places.nearest_station and prefectures.region_id
-- are reference tables read whole; station_edges is read whole in its
-- primary-key order (from_station, to_station, line).
--
-- The "unused" indexes stay: the counts are from a project with few users.
--
-- write_usage (0029) gets a primary key. Nothing reads it by key - the
-- trigger inserts with named columns, sums by (user_id, at) and purges by
-- ctid - so this changes no behaviour; it is for tools that need a key
-- (replication, the table editor). The table holds a day of charges, so
-- the rewrite is small. It takes an exclusive lock, and every signed-in
-- write's trigger inserts into this table, so the migration gives up after
-- five seconds rather than queue every traveller's writes behind a long
-- transaction; run it again if it does.

set lock_timeout = '5s';

create index if not exists bookings_covers_day_idx on bookings (covers_day_id) where covers_day_id is not null;

create index if not exists api_usage_created_idx on api_usage (created_at);

alter table write_usage add column id bigint generated always as identity primary key;
