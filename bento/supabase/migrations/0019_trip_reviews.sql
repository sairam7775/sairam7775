-- Bento · 0019 · how the plan held up
--
-- After a trip ends, the traveller can say whether they could follow the
-- plan and what got in the way. One review per trip, changeable later. It
-- is the planner's report card: the answers come back to whoever curates
-- Bento (admin pages, service role), never to other travellers.
--
-- The answer keys are fixed here so a typo in the app can't invent a new
-- category that the admin page then can't count. The words for them live
-- in the app (copy.review).

create table trip_reviews (
  trip_id     uuid primary key references trips (id) on delete cascade,
  outcome     text not null check (outcome in ('as_planned', 'mostly', 'not_really')),
  challenges  text[] not null default '{}' check (
    challenges <@ array['too_much', 'travel_longer', 'place_closed', 'crowds', 'booking', 'walking', 'timing', 'other']::text[]
  ),
  -- The days that were hardest to follow. The app keeps them inside the
  -- trip's dates; a date change later doesn't rewrite what was said.
  hard_days   date[] not null default '{}' check (cardinality(hard_days) <= 60),
  note        text check (char_length(note) <= 2000),
  -- The route and every day's stops as they were when the traveller first
  -- answered, made by the trip_reviews_plan trigger below and never changed
  -- after. The trip can change; the answer is about the plan they followed.
  plan        jsonb check (plan is null or (jsonb_typeof(plan) = 'object' and pg_column_size(plan) <= 200000)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trip_reviews_touch before update on trip_reviews
  for each row execute function touch_updated_at();

-- The plan is made here, from the trip as it stands, when the first answer
-- arrives, and never changes after — whatever a client sends. The shape is
-- lib/trips/review.ts PlanSnapshotSchema. It runs as the traveller (no
-- definer rights): their own trip's rows, city names, and place names
-- through places_public, because places itself is not granted to them.
create or replace function trip_reviews_plan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.trip_id    := old.trip_id;
    new.plan       := old.plan;
    new.created_at := old.created_at;
    return new;
  end if;
  new.plan := jsonb_build_object(
    'start', (select start_date from trips where id = new.trip_id),
    'end',   (select end_date from trips where id = new.trip_id),
    'route', coalesce((
      select jsonb_agg(jsonb_build_object('city', coalesce(c.name, tc.city_id), 'nights', tc.nights) order by tc.sort_order)
      from trip_cities tc left join cities c on c.id = tc.city_id
      where tc.trip_id = new.trip_id), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.date,
        'city', coalesce(c.name, d.city_id),
        'stops', coalesce((
          select jsonb_agg(jsonb_build_object('time', left(i.start_time::text, 5), 'name', coalesce(p.name, i.place_id, '?')) order by i.sort_order)
          from itinerary_items i left join places_public p on p.id = i.place_id
          where i.day_id = d.id), '[]'::jsonb)
      ) order by d.date)
      from itinerary_days d left join cities c on c.id = d.city_id
      where d.trip_id = new.trip_id), '[]'::jsonb)
  );
  return new;
end;
$$;

create trigger trip_reviews_plan before insert or update on trip_reviews
  for each row execute function trip_reviews_plan();

-- A trigger function has no business being callable directly (as 0005).
revoke execute on function trip_reviews_plan() from anon, authenticated, public;

alter table trip_reviews enable row level security;

-- The traveller's own trips only, and only once the trip has ended: a
-- review of a plan nobody has followed yet is a guess.
create policy "own trip_reviews read" on trip_reviews
  for select to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create policy "own trip_reviews write" on trip_reviews
  for insert to authenticated
  with check (exists (
    select 1 from trips t
    where t.id = trip_id and t.user_id = (select auth.uid())
      and t.end_date is not null and t.end_date <= current_date
  ));

create policy "own trip_reviews change" on trip_reviews
  for update to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())))
  with check (exists (
    select 1 from trips t
    where t.id = trip_id and t.user_id = (select auth.uid())
      and t.end_date is not null and t.end_date <= current_date
  ));

-- No delete policy: deleting and answering again would make a new plan.
-- A review goes with its trip, or with the account (the cascade).
