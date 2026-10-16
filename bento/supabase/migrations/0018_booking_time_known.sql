-- Bento · 0018 · a booking's time can be unknown
--
-- A confirmation often gives a date and no time ("tea ceremony, 7 April").
-- starts_at and ends_at hold a timestamp, so a date alone was stored at
-- 00:00 and shown as a midnight start. These flags say whether the time is
-- real; when false, readers show the date alone and the day box treats the
-- booking as untimed that day. Existing bookings all had times entered.

alter table bookings
  add column starts_time_known boolean not null default true,
  add column ends_time_known   boolean not null default true;
