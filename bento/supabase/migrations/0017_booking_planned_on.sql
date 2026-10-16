-- Bento · 0017 · a booking can sit in a day's box
--
-- The traveller drags a booking from the Bookings column into a day. It
-- shows there as a fixed block at its booked time; the engine never moves
-- it and never plans it. planned_on is a date, not a day id: days are
-- rewritten when a proposal is accepted, and a booking must not fall out
-- of its day because of that.
--
-- A booking may only sit on a date it covers: the day it starts, the day it
-- ends, or any day between. Times are wall-clock at the place stored as if
-- UTC (vault/wall-time.ts), so the dates are read in UTC. The app checks
-- this before writing; the constraint makes a wrong date impossible.

alter table bookings
  add column planned_on date;

alter table bookings
  add constraint bookings_planned_on_within_dates check (
    planned_on is null
    or (
      starts_at is not null
      and planned_on between (starts_at at time zone 'UTC')::date
                         and (greatest(coalesce(ends_at, starts_at), starts_at) at time zone 'UTC')::date
    )
  );

create index bookings_planned_idx on bookings (trip_id, planned_on) where planned_on is not null;
