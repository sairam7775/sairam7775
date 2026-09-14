-- Bento · 0007 · transit edges carry operator, distance, stops and mode
--
-- Fares in Japan are distance bands per operator, not sums of hops. The
-- engine groups consecutive edges by operator, sums km, and looks the band
-- up; an edge with fare_jpy set is an exact override (intercity legs).

alter table station_edges
  add column operator text,
  add column km       numeric(6,2) check (km >= 0),
  add column stops    int not null default 1 check (stops >= 1),
  add column mode     text not null default 'rail' check (mode in ('rail','walk','ferry','bus'));

comment on column station_edges.fare_jpy is
  'Exact adult IC fare for this edge when set (intercity legs). NULL means '
  'the engine estimates from operator distance bands.';
comment on column station_edges.stops is
  'Station arrivals including the destination. 1 = nonstop hop.';
